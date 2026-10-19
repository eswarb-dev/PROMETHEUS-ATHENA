-- Preserve explicit email consent; a legacy phone-only preference is not email consent.
update public.notification_preferences set study_reminders=coalesce(email_enabled,false) and coalesce(study_reminders,false),weekly_report=coalesce(email_enabled,false) and coalesce(weekly_report,false),whatsapp_enabled=false,whatsapp_verified=false;
update public.reminder_runtime set whatsapp_delivery=false;
comment on column public.notification_preferences.reminder_channel is 'Deprecated compatibility field. Product logic uses study_reminders and weekly_report.';
comment on column public.notification_preferences.email_enabled is 'Deprecated compatibility mirror of email event consent.';
comment on column public.notification_preferences.whatsapp_enabled is 'Deprecated. Delivery removed; retained for migration compatibility.';
comment on column public.notification_preferences.whatsapp_number is 'Deprecated private legacy data. Not exposed in product snapshots or delivery paths.';
comment on column public.notification_preferences.whatsapp_verified is 'Deprecated. No active verification or delivery integration.';
comment on column public.reminder_runtime.whatsapp_delivery is 'Deprecated. No active provider or delivery path.';
update public.reminder_deliveries set status='cancelled',error_code='CHANNEL_NOT_READY' where channel<>'email' and status in ('queued','retry_wait','blocked');
-- Historical non-email outcomes remain readable, but new rows must be email.
alter table public.reminder_deliveries add constraint reminder_deliveries_email_only check(channel='email') not valid;

create or replace function public.get_reminder_capabilities() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('emailReminderDelivery',email_delivery and scheduler_enabled,'profileCompletion',true) from public.reminder_runtime where singleton
$$;

create or replace function public.save_notification_preferences(p_patch jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); previous public.notification_preferences; zone text; reminder_time time; study boolean; weekly boolean;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if jsonb_typeof(p_patch) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('studyReminders','weeklyReport','timezone','preferredReminderTime')) then raise exception 'Invalid notification field' using errcode='22023'; end if;
  perform 1 from public.profiles where id=owner_id for update;
  if not found then raise exception 'Profile unavailable' using errcode='P0002'; end if;
  select * into previous from public.notification_preferences where user_id=owner_id;
  zone:=coalesce(p_patch->>'timezone',previous.timezone,'Asia/Kolkata');
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=zone) then raise exception 'Invalid timezone' using errcode='22023'; end if;
  if p_patch ? 'studyReminders' and jsonb_typeof(p_patch->'studyReminders') is distinct from 'boolean' or p_patch ? 'weeklyReport' and jsonb_typeof(p_patch->'weeklyReport') is distinct from 'boolean' then raise exception 'Invalid notification consent' using errcode='22023'; end if;
  if p_patch ? 'preferredReminderTime' and coalesce(p_patch->>'preferredReminderTime','')<>'' and (jsonb_typeof(p_patch->'preferredReminderTime')<>'string' or (p_patch->>'preferredReminderTime') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then raise exception 'Invalid reminder time' using errcode='22023'; end if;
  reminder_time:=case when p_patch ? 'preferredReminderTime' then nullif(p_patch->>'preferredReminderTime','')::time else previous.preferred_reminder_time end;
  study:=coalesce((p_patch->>'studyReminders')::boolean,previous.study_reminders,false);
  weekly:=coalesce((p_patch->>'weeklyReport')::boolean,previous.weekly_report,false);
  insert into public.notification_preferences(user_id,email_enabled,whatsapp_enabled,study_reminders,weekly_report,timezone,preferred_reminder_time)
    values(owner_id,study or weekly,false,study,weekly,zone,reminder_time)
    on conflict(user_id) do update set email_enabled=excluded.email_enabled,whatsapp_enabled=false,study_reminders=excluded.study_reminders,weekly_report=excluded.weekly_report,timezone=excluded.timezone,preferred_reminder_time=excluded.preferred_reminder_time;
  return jsonb_build_object('saved',true);
end $$;

create or replace function public.complete_onboarding(p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; notifications jsonb:=p_payload->'notifications'; already_completed boolean; study boolean; weekly boolean; patch jsonb; bridge jsonb;
begin
  select onboarding_completed into already_completed from public.profiles where id=auth.uid() for update;
  -- Adapt legacy boolean input only at this compatibility boundary.
  patch:=jsonb_build_object('studyReminders',coalesce(notifications->'studyReminders',notifications->'email','false'::jsonb),'weeklyReport',coalesce(notifications->'weeklyReport','false'::jsonb),'timezone',coalesce(notifications->>'timezone','Asia/Kolkata'),'preferredReminderTime',notifications->>'preferredReminderTime');
  if jsonb_typeof(patch->'studyReminders') is distinct from 'boolean' or jsonb_typeof(patch->'weeklyReport') is distinct from 'boolean' then raise exception 'Invalid notification consent' using errcode='22023'; end if;
  study:=(patch->>'studyReminders')::boolean; weekly:=(patch->>'weeklyReport')::boolean;
  bridge:=jsonb_set(p_payload,'{notifications}',jsonb_build_object('email',study or weekly,'whatsapp',false));
  result:=public.complete_onboarding_directions(bridge);
  if not coalesce(already_completed,false) then perform public.save_notification_preferences(patch); end if;
  return result;
end $$;

create or replace function public.get_user_learning_context() returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare prefs public.study_preferences; notices public.notification_preferences; budget integer; style text; task_min integer; task_max integer; strategy text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into prefs from public.study_preferences where user_id=auth.uid();
  select * into notices from public.notification_preferences where user_id=auth.uid();
  budget:=coalesce(prefs.daily_study_minutes,30); style:=coalesce(prefs.learning_style,'balanced');
  task_min:=least(budget,case prefs.task_size when 'deep' then 60 when 'focused' then 30 else 15 end);
  task_max:=least(budget,case prefs.task_size when 'deep' then 120 when 'focused' then 60 else 25 end);
  strategy:=case style when 'build_first' then 'implementation_first' when 'theory_first' then 'concept_first' when 'practice_heavy' then 'exercise_and_checkpoint' else 'concept_and_implementation' end;
  return jsonb_build_object('directions',public.get_learning_directions(),'goal',(select goal from public.profiles where id=auth.uid()),
    'skills',coalesce((select jsonb_agg(jsonb_build_object('name',title,'normalizedName',normalized_name,'selfReportedLevel',self_reported_level,'verifiedLevel',verified_level,'verificationStatus',verification_status) order by normalized_name,id) from public.knowledge_topics where user_id=auth.uid()),'[]'),
    'studyPreferences',jsonb_build_object('dailyStudyMinutes',budget,'studyPeriod',coalesce(prefs.study_period,'flexible'),'learningStyle',style,'taskSize',coalesce(prefs.task_size,'quick'),'timezone',coalesce(notices.timezone,'Asia/Kolkata')),
    'plannerPolicy',jsonb_build_object('dailyBudgetMinutes',budget,'minimumTaskMinutes',task_min,'maximumTaskMinutes',task_max,'optionalOverflowOnly',true,'suggestionLimit',case when budget<=30 then 1 when budget<=60 then 2 else 3 end,'teachingStrategy',strategy),
    'mentorPolicy',jsonb_build_object('identity','ATHENA — Adaptive Study Mentor','teachingStrategy',strategy,'initialTheory',case when style='build_first' then 'concise' else 'as_needed' end,'exercisesEarly',style in ('build_first','practice_heavy'),'checkpoints',style='practice_heavy'));
end $$;

create or replace function public.get_settings_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$
  select public.get_settings_snapshot_before_preferences() || jsonb_build_object('reminderCapabilities',public.get_reminder_capabilities(),'learningContext',public.get_user_learning_context(),
    'notifications',(select jsonb_build_object('studyReminders',coalesce(study_reminders,false),'weeklyReport',coalesce(weekly_report,false),'preferredReminderTime',to_char(preferred_reminder_time,'HH24:MI'),'timezone',timezone) from public.notification_preferences where user_id=auth.uid()))
$$;

create or replace function public.enqueue_reminder(p_owner uuid,p_kind text,p_window text,p_target text,p_at timestamptz,p_test boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare job_id uuid; prefs public.notification_preferences; runtime public.reminder_runtime;
begin
  select * into prefs from public.notification_preferences where user_id=p_owner;
  if not found or not (case when p_kind='weekly_progress_ready' then coalesce(prefs.weekly_report,false) else coalesce(prefs.study_reminders,false) end) then return null; end if;
  if not exists(select 1 from auth.users u join public.profiles p on p.id=u.id where u.id=p_owner and u.email_confirmed_at is not null and p.onboarding_completed) then return null; end if;
  select * into runtime from public.reminder_runtime where singleton;
  insert into public.reminder_jobs(user_id,kind,window_key,target_key,scheduled_for,is_test)
    values(p_owner,p_kind,p_window,p_target,p_at,p_test) on conflict(user_id,kind,window_key,target_key) do nothing returning id into job_id;
  if job_id is null then return null; end if;
  insert into public.reminder_deliveries(reminder_job_id,user_id,channel,status,error_code,next_attempt_at)
    values(job_id,p_owner,'email',case when runtime.email_delivery and runtime.scheduler_enabled then 'queued' else 'blocked' end,case when runtime.email_delivery and runtime.scheduler_enabled then null else 'CHANNEL_NOT_READY' end,p_at);
  return job_id;
end $$;

create or replace function public.schedule_due_reminders(p_now timestamptz default now()) returns jsonb language plpgsql security definer set search_path='' as $$
declare person record; local_day date; local_time timestamp; window_at timestamptz; kind text; task_count integer; jobs integer:=0; created uuid;
begin
  if not exists(select 1 from public.reminder_runtime where singleton and scheduler_enabled) then return jsonb_build_object('queued',0); end if;
  for person in select n.user_id,n.study_reminders,n.weekly_report,n.timezone,n.preferred_reminder_time,s.study_period,s.daily_study_minutes from public.notification_preferences n join public.study_preferences s using(user_id) join public.profiles p on p.id=n.user_id join auth.users u on u.id=n.user_id where (n.study_reminders or n.weekly_report) and p.onboarding_completed and u.email_confirmed_at is not null loop
    local_time:=p_now at time zone person.timezone; local_day:=local_time::date;
    window_at:=(local_day+coalesce(person.preferred_reminder_time,case person.study_period when 'morning' then time '09:00' when 'afternoon' then time '14:00' when 'evening' then time '18:00' when 'night' then time '21:00' else time '18:00' end)) at time zone person.timezone;
    select count(*) into task_count from public.daily_tasks where user_id=person.user_id and scheduled_for=local_day and status in ('planned','in_progress') and not is_optional;
    if person.study_reminders and task_count>0 and window_at<=p_now and window_at>p_now-interval '15 minutes' then
      kind:=case when exists(select 1 from public.daily_tasks where user_id=person.user_id and scheduled_for=local_day and planning_source='athena') then 'study_plan_available' else 'study_task_due' end;
      created:=public.enqueue_reminder(person.user_id,kind,local_day::text,'daily-plan',window_at);
      if created is not null then jobs:=jobs+1; end if;
    end if;
    if person.study_reminders and person.daily_study_minutes>60 and task_count>0 and window_at+interval '2 hours'<=p_now and window_at+interval '2 hours'>p_now-interval '15 minutes' and not exists(select 1 from public.study_sessions where user_id=person.user_id and (started_at at time zone person.timezone)::date=local_day) then
      created:=public.enqueue_reminder(person.user_id,'missed_study_window',local_day::text,'daily-plan',window_at+interval '2 hours');
      if created is not null then jobs:=jobs+1; end if;
    end if;
    if person.weekly_report and extract(isodow from local_day)=7 and window_at<=p_now and window_at>p_now-interval '15 minutes' and exists(select 1 from public.study_sessions where user_id=person.user_id and status='completed' and started_at>=p_now-interval '7 days') then
      created:=public.enqueue_reminder(person.user_id,'weekly_progress_ready',local_day::text,'weekly-progress',window_at);
      if created is not null then jobs:=jobs+1; end if;
    end if;
  end loop;
  return jsonb_build_object('queued',jobs);
end $$;

create or replace function public.claim_reminder_deliveries(p_user_id uuid default null,p_limit integer default 20) returns setof jsonb language plpgsql security definer set search_path='' as $$
declare item record; token uuid; consent boolean;
begin
  for item in select d.id,d.user_id,j.kind,j.is_test,j.scheduled_for,n.study_reminders,n.weekly_report,r.email_delivery,r.scheduler_enabled,u.email,u.email_confirmed_at,p.onboarding_completed,s.daily_study_minutes
    from public.reminder_deliveries d join public.reminder_jobs j on j.id=d.reminder_job_id join public.notification_preferences n on n.user_id=d.user_id join public.profiles p on p.id=d.user_id join auth.users u on u.id=d.user_id join public.study_preferences s on s.user_id=d.user_id cross join public.reminder_runtime r
    where d.channel='email' and d.status in ('queued','retry_wait') and d.attempt_count<3 and d.next_attempt_at<=now() and j.scheduled_for<=now() and (p_user_id is null or d.user_id=p_user_id)
    order by j.scheduled_for,d.id limit least(greatest(p_limit,1),25) for update of d skip locked loop
    consent:=item.email_confirmed_at is not null and item.onboarding_completed and (case when item.kind='weekly_progress_ready' then coalesce(item.weekly_report,false) else coalesce(item.study_reminders,false) end);
    if not consent then update public.reminder_deliveries set status='cancelled',error_code='CONSENT_WITHDRAWN' where id=item.id; continue; end if;
    if not (item.scheduler_enabled and item.email_delivery) then update public.reminder_deliveries set status='blocked',error_code='CHANNEL_NOT_READY' where id=item.id; continue; end if;
    if item.scheduled_for<now()-interval '24 hours' then update public.reminder_deliveries set status='cancelled',error_code='DELIVERY_EXPIRED' where id=item.id; continue; end if;
    token:=gen_random_uuid(); update public.reminder_deliveries set status='sending',claim_token=token,attempt_count=attempt_count+1 where id=item.id;
    return next jsonb_build_object('id',item.id,'claimToken',token,'channel','email','kind',item.kind,'isTest',item.is_test,'recipientEmail',item.email,'dailyStudyMinutes',item.daily_study_minutes);
  end loop;
end $$;

create or replace function public.cancel_withdrawn_reminders() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.reminder_deliveries d set status='cancelled',error_code='CONSENT_WITHDRAWN' from public.reminder_jobs j where j.id=d.reminder_job_id and d.user_id=new.user_id and d.channel='email' and d.status in ('queued','retry_wait') and not (case when j.kind='weekly_progress_ready' then coalesce(new.weekly_report,false) else coalesce(new.study_reminders,false) end);
  return new;
end $$;
