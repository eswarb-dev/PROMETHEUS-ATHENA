alter table public.knowledge_topics add column normalized_name text generated always as (lower(btrim(title))) stored;
alter table public.notification_preferences
  add column whatsapp_number text check (whatsapp_number is null or whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'),
  add column whatsapp_verified boolean not null default false,
  add column preferred_reminder_time time,
  add column timezone text not null default 'Asia/Kolkata',
  add column reminder_channel text generated always as (case when email_enabled and whatsapp_enabled then 'both' when email_enabled then 'email' when whatsapp_enabled then 'whatsapp' else 'none' end) stored;
update public.notification_preferences set study_reminders=coalesce(study_reminders,false),weekly_report=coalesce(weekly_report,false),email_enabled=coalesce(email_enabled,false),whatsapp_enabled=coalesce(whatsapp_enabled,false);
alter table public.notification_preferences alter column study_reminders set default false,alter column weekly_report set default false,alter column email_enabled set default false,alter column whatsapp_enabled set default false;
revoke insert,update on public.notification_preferences from authenticated;
revoke insert(user_id,study_reminders,weekly_report,email_enabled,whatsapp_enabled),update(study_reminders,weekly_report,email_enabled,whatsapp_enabled) on public.notification_preferences from authenticated;

create table public.reminder_runtime (
  singleton boolean primary key default true check(singleton),
  email_delivery boolean not null default false,
  whatsapp_delivery boolean not null default false,
  scheduler_enabled boolean not null default false
);
insert into public.reminder_runtime(singleton) values(true);
alter table public.reminder_runtime enable row level security;
revoke all on public.reminder_runtime from public,anon,authenticated;
create function public.get_reminder_capabilities() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('emailReminderDelivery',email_delivery and scheduler_enabled,'whatsappReminderDelivery',whatsapp_delivery and scheduler_enabled,'whatsappNumberVerification',false,'whatsappChannelMode','REMINDERS_ONLY','profileCompletion',true) from public.reminder_runtime where singleton
$$;
revoke all on function public.get_reminder_capabilities() from public,anon;
grant execute on function public.get_reminder_capabilities() to authenticated;

create function public.save_notification_preferences(p_patch jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); previous public.notification_preferences; channel text; number text; zone text; reminder_time time;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if jsonb_typeof(p_patch) is distinct from 'object' then raise exception 'Invalid notifications' using errcode='22023'; end if;
  if exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('reminderChannel','whatsappNumber','studyReminders','weeklyReport','timezone','preferredReminderTime')) then raise exception 'Invalid notification field' using errcode='22023'; end if;
  perform 1 from public.profiles where id=owner_id for update;
  if not found then raise exception 'Profile unavailable' using errcode='P0002'; end if;
  select * into previous from public.notification_preferences where user_id=owner_id;
  channel:=coalesce(p_patch->>'reminderChannel',previous.reminder_channel,'none');
  if channel not in ('email','whatsapp','both','none') then raise exception 'Invalid reminder channel' using errcode='22023'; end if;
  number:=case when channel in ('whatsapp','both') then btrim(coalesce(p_patch->>'whatsappNumber',previous.whatsapp_number)) else null end;
  if channel in ('whatsapp','both') and (number is null or number !~ '^\+[1-9][0-9]{7,14}$') then raise exception 'Use an international WhatsApp number' using errcode='22023'; end if;
  zone:=coalesce(p_patch->>'timezone',previous.timezone,'Asia/Kolkata');
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=zone) then raise exception 'Invalid timezone' using errcode='22023'; end if;
  if p_patch ? 'studyReminders' and jsonb_typeof(p_patch->'studyReminders') is distinct from 'boolean' or p_patch ? 'weeklyReport' and jsonb_typeof(p_patch->'weeklyReport') is distinct from 'boolean' then raise exception 'Invalid notification consent' using errcode='22023'; end if;
  reminder_time:=case when p_patch ? 'preferredReminderTime' then nullif(p_patch->>'preferredReminderTime','')::time else previous.preferred_reminder_time end;
  insert into public.notification_preferences(user_id,email_enabled,whatsapp_enabled,study_reminders,weekly_report,whatsapp_number,whatsapp_verified,timezone,preferred_reminder_time)
    values(owner_id,channel in ('email','both'),channel in ('whatsapp','both'),coalesce((p_patch->>'studyReminders')::boolean,previous.study_reminders,false),coalesce((p_patch->>'weeklyReport')::boolean,previous.weekly_report,false),number,coalesce(previous.whatsapp_verified,false) and number is not distinct from previous.whatsapp_number,zone,reminder_time)
    on conflict(user_id) do update set email_enabled=excluded.email_enabled,whatsapp_enabled=excluded.whatsapp_enabled,study_reminders=excluded.study_reminders,weekly_report=excluded.weekly_report,whatsapp_number=excluded.whatsapp_number,whatsapp_verified=excluded.whatsapp_verified,timezone=excluded.timezone,preferred_reminder_time=excluded.preferred_reminder_time;
  return jsonb_build_object('saved',true);
end $$;
revoke all on function public.save_notification_preferences(jsonb) from public,anon;
grant execute on function public.save_notification_preferences(jsonb) to authenticated;

alter function public.complete_onboarding(jsonb) rename to complete_onboarding_directions;
revoke all on function public.complete_onboarding_directions(jsonb) from public,anon,authenticated;
create function public.complete_onboarding(p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; notifications jsonb:=p_payload->'notifications'; channel text;
begin
  result:=public.complete_onboarding_directions(p_payload);
  channel:=coalesce(notifications->>'reminderChannel',case when (notifications->>'email')::boolean and (notifications->>'whatsapp')::boolean then 'both' when (notifications->>'email')::boolean then 'email' when (notifications->>'whatsapp')::boolean then 'whatsapp' else 'none' end);
  perform public.save_notification_preferences(jsonb_build_object('reminderChannel',channel,'whatsappNumber',notifications->>'whatsappNumber','studyReminders',channel<>'none','weeklyReport',false,'timezone',coalesce(notifications->>'timezone','Asia/Kolkata')));
  return result;
end $$;
revoke all on function public.complete_onboarding(jsonb) from public,anon;
grant execute on function public.complete_onboarding(jsonb) to authenticated;

create function public.get_user_learning_context() returns jsonb language plpgsql stable security invoker set search_path='' as $$
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
    'studyPreferences',jsonb_build_object('dailyStudyMinutes',budget,'studyPeriod',coalesce(prefs.study_period,'flexible'),'learningStyle',style,'taskSize',coalesce(prefs.task_size,'quick'),'reminderChannel',coalesce(notices.reminder_channel,'none'),'timezone',coalesce(notices.timezone,'Asia/Kolkata')),
    'plannerPolicy',jsonb_build_object('dailyBudgetMinutes',budget,'minimumTaskMinutes',task_min,'maximumTaskMinutes',task_max,'optionalOverflowOnly',true,'suggestionLimit',case when budget<=30 then 1 when budget<=60 then 2 else 3 end,'teachingStrategy',strategy),
    'mentorPolicy',jsonb_build_object('identity','ATHENA — Adaptive Study Mentor','teachingStrategy',strategy,'initialTheory',case when style='build_first' then 'concise' else 'as_needed' end,'exercisesEarly',style in ('build_first','practice_heavy'),'checkpoints',style='practice_heavy'));
end $$;
revoke all on function public.get_user_learning_context() from public,anon;
grant execute on function public.get_user_learning_context() to authenticated;

alter function public.get_settings_snapshot() rename to get_settings_snapshot_before_preferences;
create function public.get_settings_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$
  select public.get_settings_snapshot_before_preferences() || jsonb_build_object('reminderCapabilities',public.get_reminder_capabilities(),
    'learningContext',public.get_user_learning_context(),
    'notifications',(select jsonb_build_object('studyReminders',coalesce(study_reminders,false),'weeklyReport',coalesce(weekly_report,false),'email',email_enabled,'whatsapp',whatsapp_enabled,'reminderChannel',reminder_channel,'whatsappNumber',whatsapp_number,'whatsappVerified',whatsapp_verified,'preferredReminderTime',preferred_reminder_time,'timezone',timezone) from public.notification_preferences where user_id=auth.uid()))
$$;
revoke all on function public.get_settings_snapshot() from public,anon;
grant execute on function public.get_settings_snapshot() to authenticated;

alter table public.daily_tasks add column is_optional boolean not null default false,add column planning_source text not null default 'manual' check(planning_source in ('manual','athena'));
create unique index athena_daily_topic_once on public.daily_tasks(user_id,scheduled_for,topic_id) where planning_source='athena';
create function public.plan_today_from_roadmap(p_date date default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); context jsonb; budget integer; maximum integer; minimum integer; remaining integer; day date; path_id uuid; topic record; duration integer; added integer:=0;
begin
  if owner_id is null or not exists(select 1 from auth.users where id=owner_id and email_confirmed_at is not null) then raise exception 'Verified authentication required' using errcode='42501'; end if;
  perform 1 from public.profiles where id=owner_id and onboarding_completed for update;
  if not found then raise exception 'Complete onboarding first' using errcode='42501'; end if;
  context:=public.get_user_learning_context(); budget:=(context->'plannerPolicy'->>'dailyBudgetMinutes')::integer; maximum:=(context->'plannerPolicy'->>'maximumTaskMinutes')::integer;
  minimum:=(context->'plannerPolicy'->>'minimumTaskMinutes')::integer;
  day:=coalesce(p_date,(now() at time zone (context->'studyPreferences'->>'timezone'))::date);
  if day<>(now() at time zone (context->'studyPreferences'->>'timezone'))::date then raise exception 'Only today can be planned' using errcode='22023'; end if;
  select id into path_id from public.roadmaps where user_id=owner_id and status='active' order by updated_at desc,id limit 1;
  if path_id is null then return jsonb_build_object('created',0,'reason','no_roadmap'); end if;
  select greatest(0,budget-coalesce(sum(estimated_minutes),0))::integer into remaining from public.daily_tasks where user_id=owner_id and scheduled_for=day and not is_optional;
  for topic in select t.* from public.roadmap_topics t where t.roadmap_id=path_id and t.status in ('planned','current','gap') and not exists(select 1 from public.daily_tasks d where d.user_id=owner_id and d.scheduled_for=day and d.topic_id=t.id) and not exists(select 1 from public.topic_prerequisites p join public.roadmap_topics before_topic on before_topic.id=p.prerequisite_topic_id where p.topic_id=t.id and before_topic.status<>'completed') order by case when t.status='current' then 0 else 1 end,t.sort_order,t.id limit 100 loop
    exit when remaining<minimum;
    duration:=least(remaining,maximum,greatest(1,coalesce(nullif(topic.estimated_minutes,0),maximum)));
    insert into public.daily_tasks(user_id,roadmap_id,topic_id,title,description,estimated_minutes,scheduled_for,sort_order,planning_source)
      values(owner_id,path_id,topic.id,topic.title,case context->'studyPreferences'->>'learningStyle' when 'build_first' then 'Start with an implementation exercise, then explain the concepts it uses.' when 'theory_first' then 'Establish the core concepts, then apply them in a small implementation.' when 'practice_heavy' then 'Complete an exercise and check your understanding at a checkpoint.' else 'Combine a concise explanation with a practical exercise.' end,duration,day,added,'athena');
    remaining:=remaining-duration;added:=added+1;
  end loop;
  return jsonb_build_object('created',added,'budgetMinutes',budget,'remainingMinutes',remaining);
end $$;
revoke all on function public.plan_today_from_roadmap(date) from public,anon;
grant execute on function public.plan_today_from_roadmap(date) to authenticated;

alter function public.get_today_snapshot(date) rename to get_today_snapshot_before_preferences;
create function public.get_today_snapshot(p_date date default null) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare context jsonb:=public.get_user_learning_context(); day date; result jsonb; required_minutes integer;
begin
  day:=coalesce(p_date,(now() at time zone (context->'studyPreferences'->>'timezone'))::date);
  result:=public.get_today_snapshot_before_preferences(day);
  select coalesce(sum(estimated_minutes),0)::integer into required_minutes from public.daily_tasks where user_id=auth.uid() and scheduled_for=day and not is_optional;
  return result || jsonb_build_object('timezone',context->'studyPreferences'->>'timezone','learningContext',context,'dailyBudgetMinutes',(context->'plannerPolicy'->>'dailyBudgetMinutes')::integer,'overBudgetMinutes',greatest(0,required_minutes-(context->'plannerPolicy'->>'dailyBudgetMinutes')::integer),
    'tasks',coalesce((select jsonb_agg(item || jsonb_build_object('optional',coalesce((select d.is_optional from public.daily_tasks d where d.id=(item->>'id')::uuid),false) or item->>'estimatedMinutes' is null or total_minutes>(context->'plannerPolicy'->>'dailyBudgetMinutes')::integer) order by position) from (select value item,ordinality position,sum(coalesce((value->>'estimatedMinutes')::integer,0)) over(order by ordinality) total_minutes from jsonb_array_elements(result->'tasks') with ordinality) items),'[]'));
end $$;
revoke all on function public.get_today_snapshot(date) from public,anon;
grant execute on function public.get_today_snapshot(date) to authenticated;

alter function public.get_roadmap_snapshot() rename to get_roadmap_snapshot_before_preferences;
create function public.get_roadmap_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$
  select case when value is null then null else value || jsonb_build_object('pacing',jsonb_build_object('dailyStudyMinutes',(context->'studyPreferences'->>'dailyStudyMinutes')::integer,'taskSize',context->'studyPreferences'->>'taskSize','teachingStrategy',context->'plannerPolicy'->>'teachingStrategy','suggestionLimit',(context->'plannerPolicy'->>'suggestionLimit')::integer,'estimatedStudyDays',ceil((value->'roadmap'->>'estimatedRemainingMinutes')::numeric/(context->'studyPreferences'->>'dailyStudyMinutes')::integer))) end from (select public.get_roadmap_snapshot_before_preferences() value,public.get_user_learning_context() context) s
$$;
revoke all on function public.get_roadmap_snapshot() from public,anon;
grant execute on function public.get_roadmap_snapshot() to authenticated;

alter function public.get_athena_snapshot(uuid) rename to get_athena_snapshot_before_preferences;
create function public.get_athena_snapshot(p_conversation_id uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$
  select public.get_athena_snapshot_before_preferences(p_conversation_id) || jsonb_build_object('learningContext',public.get_user_learning_context())
$$;
revoke all on function public.get_athena_snapshot(uuid) from public,anon;
grant execute on function public.get_athena_snapshot(uuid) to authenticated;
