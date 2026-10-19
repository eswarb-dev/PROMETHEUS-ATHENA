create table public.reminder_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check(kind in ('study_task_due','study_plan_available','missed_study_window','weekly_progress_ready')),
  window_key text not null,
  target_key text not null,
  scheduled_for timestamptz not null,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id,kind,window_key,target_key),unique(id,user_id)
);
create table public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  reminder_job_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check(channel in ('email','whatsapp')),
  status text not null default 'queued' check(status in ('queued','sending','retry_wait','sent','failed','blocked','cancelled','unknown_delivery')),
  attempt_count integer not null default 0 check(attempt_count between 0 and 3),
  claim_token uuid,
  next_attempt_at timestamptz not null default now(),
  provider_message_id text,
  error_code text check(error_code in ('MAIL_AUTH','MAIL_RATE_LIMIT','MAIL_CONNECTION','MAIL_PROVIDER','MAIL_UNKNOWN','CHANNEL_NOT_READY','CONSENT_WITHDRAWN','DELIVERY_EXPIRED','WHATSAPP_PROVIDER','WHATSAPP_RATE_LIMIT','WHATSAPP_UNKNOWN')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz,
  unique(reminder_job_id,channel),
  foreign key(reminder_job_id,user_id) references public.reminder_jobs(id,user_id) on delete cascade
);
create index reminder_deliveries_due on public.reminder_deliveries(next_attempt_at) where status in ('queued','retry_wait');
alter table public.reminder_jobs enable row level security;
alter table public.reminder_deliveries enable row level security;
revoke all on public.reminder_jobs,public.reminder_deliveries from public,anon,authenticated;
grant select on public.reminder_jobs,public.reminder_deliveries to authenticated;
create policy reminder_jobs_owner on public.reminder_jobs for select to authenticated using(user_id=auth.uid());
create policy reminder_deliveries_owner on public.reminder_deliveries for select to authenticated using(user_id=auth.uid());

create function public.enqueue_reminder(p_owner uuid,p_kind text,p_window text,p_target text,p_at timestamptz,p_test boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare job_id uuid; prefs public.notification_preferences; runtime public.reminder_runtime;
begin
  select * into prefs from public.notification_preferences where user_id=p_owner;
  if not found or prefs.reminder_channel='none' or not (case when p_kind='weekly_progress_ready' then coalesce(prefs.weekly_report,false) else coalesce(prefs.study_reminders,false) end) then return null; end if;
  if not exists(select 1 from auth.users u join public.profiles p on p.id=u.id where u.id=p_owner and u.email_confirmed_at is not null and p.onboarding_completed) then return null; end if;
  select * into runtime from public.reminder_runtime where singleton;
  insert into public.reminder_jobs(user_id,kind,window_key,target_key,scheduled_for,is_test)
    values(p_owner,p_kind,p_window,p_target,p_at,p_test) on conflict(user_id,kind,window_key,target_key) do nothing returning id into job_id;
  if job_id is null then return null; end if;
  if prefs.email_enabled then
    insert into public.reminder_deliveries(reminder_job_id,user_id,channel,status,error_code,next_attempt_at)
      values(job_id,p_owner,'email',case when runtime.email_delivery and runtime.scheduler_enabled then 'queued' else 'blocked' end,case when runtime.email_delivery and runtime.scheduler_enabled then null else 'CHANNEL_NOT_READY' end,p_at);
  end if;
  if prefs.whatsapp_enabled then
    insert into public.reminder_deliveries(reminder_job_id,user_id,channel,status,error_code,next_attempt_at)
      values(job_id,p_owner,'whatsapp',case when runtime.whatsapp_delivery and runtime.scheduler_enabled and prefs.whatsapp_verified and prefs.whatsapp_number is not null then 'queued' else 'blocked' end,case when runtime.whatsapp_delivery and runtime.scheduler_enabled and prefs.whatsapp_verified and prefs.whatsapp_number is not null then null else 'CHANNEL_NOT_READY' end,p_at);
  end if;
  return job_id;
end $$;
revoke all on function public.enqueue_reminder(uuid,text,text,text,timestamptz,boolean) from public,anon,authenticated;

create function public.schedule_due_reminders(p_now timestamptz default now()) returns jsonb language plpgsql security definer set search_path='' as $$
declare person record; local_day date; local_time timestamp; window_at timestamptz; kind text; task_count integer; jobs integer:=0; created uuid;
begin
  if not exists(select 1 from public.reminder_runtime where singleton and scheduler_enabled) then return jsonb_build_object('queued',0); end if;
  for person in select n.*,s.study_period,s.daily_study_minutes from public.notification_preferences n join public.study_preferences s using(user_id) join public.profiles p on p.id=n.user_id join auth.users u on u.id=n.user_id where n.reminder_channel<>'none' and (n.study_reminders or n.weekly_report) and p.onboarding_completed and u.email_confirmed_at is not null loop
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
revoke all on function public.schedule_due_reminders(timestamptz) from public,anon,authenticated;
grant execute on function public.schedule_due_reminders(timestamptz) to service_role;

create function public.queue_reminder_test(p_user_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare job_id uuid; local_day date;
begin
  perform 1 from public.profiles where id=p_user_id for update;
  if not found then return jsonb_build_object('queued',false); end if;
  select (now() at time zone timezone)::date into local_day from public.notification_preferences where user_id=p_user_id;
  job_id:=public.enqueue_reminder(p_user_id,'study_plan_available','test:'||local_day::text,'manual-test',now(),true);
  return jsonb_build_object('queued',job_id is not null);
end $$;
revoke all on function public.queue_reminder_test(uuid) from public,anon,authenticated;
grant execute on function public.queue_reminder_test(uuid) to service_role;

create function public.claim_reminder_deliveries(p_user_id uuid default null,p_limit integer default 20) returns setof jsonb language plpgsql security definer set search_path='' as $$
declare item record; token uuid; consent boolean; ready boolean;
begin
  for item in select d.id,d.channel,d.user_id,j.kind,j.is_test,j.scheduled_for,n.email_enabled,n.whatsapp_enabled,n.whatsapp_number,n.whatsapp_verified,n.study_reminders,n.weekly_report,r.email_delivery,r.whatsapp_delivery,r.scheduler_enabled,u.email,u.email_confirmed_at,p.name,s.daily_study_minutes
    from public.reminder_deliveries d join public.reminder_jobs j on j.id=d.reminder_job_id join public.notification_preferences n on n.user_id=d.user_id join public.profiles p on p.id=d.user_id join auth.users u on u.id=d.user_id join public.study_preferences s on s.user_id=d.user_id cross join public.reminder_runtime r
    where d.status in ('queued','retry_wait') and d.attempt_count<3 and d.next_attempt_at<=now() and j.scheduled_for<=now() and (p_user_id is null or d.user_id=p_user_id)
    order by j.scheduled_for,d.id limit least(greatest(p_limit,1),25) for update of d skip locked loop
    consent:=item.email_confirmed_at is not null and case when item.kind='weekly_progress_ready' then coalesce(item.weekly_report,false) else coalesce(item.study_reminders,false) end and case when item.channel='email' then item.email_enabled else item.whatsapp_enabled end;
    ready:=item.scheduler_enabled and case when item.channel='email' then item.email_delivery else item.whatsapp_delivery and item.whatsapp_verified and item.whatsapp_number is not null end;
    if not consent then update public.reminder_deliveries set status='cancelled',error_code='CONSENT_WITHDRAWN' where id=item.id; continue; end if;
    if not ready then update public.reminder_deliveries set status='blocked',error_code='CHANNEL_NOT_READY' where id=item.id; continue; end if;
    if item.scheduled_for<now()-interval '24 hours' then update public.reminder_deliveries set status='cancelled',error_code='DELIVERY_EXPIRED' where id=item.id; continue; end if;
    token:=gen_random_uuid();
    update public.reminder_deliveries set status='sending',claim_token=token,attempt_count=attempt_count+1 where id=item.id;
    return next jsonb_build_object('id',item.id,'claimToken',token,'channel',item.channel,'kind',item.kind,'isTest',item.is_test,'recipientEmail',case when item.channel='email' then item.email end,'recipientPhone',case when item.channel='whatsapp' then item.whatsapp_number end,'name',item.name,'dailyStudyMinutes',item.daily_study_minutes);
  end loop;
end $$;
revoke all on function public.claim_reminder_deliveries(uuid,integer) from public,anon,authenticated;
grant execute on function public.claim_reminder_deliveries(uuid,integer) to service_role;

create function public.finish_reminder_delivery(p_id uuid,p_claim_token uuid,p_status text,p_error_code text default null,p_provider_message_id text default null) returns boolean language plpgsql security definer set search_path='' as $$
declare item public.reminder_deliveries;
begin
  if p_status not in ('sent','retry_wait','failed','blocked','unknown_delivery') then raise exception 'Invalid delivery status' using errcode='22023'; end if;
  select * into item from public.reminder_deliveries where id=p_id and claim_token=p_claim_token and status='sending' for update;
  if not found then return false; end if;
  update public.reminder_deliveries set status=case when p_status='retry_wait' and attempt_count>=3 then 'failed' else p_status end,error_code=p_error_code,provider_message_id=left(p_provider_message_id,200),claim_token=null,
    sent_at=case when p_status='sent' then now() end,failed_at=case when p_status in ('failed','unknown_delivery') or p_status='retry_wait' and attempt_count>=3 then now() end,
    next_attempt_at=now()+make_interval(secs=>(60*power(2,attempt_count-1))::integer) where id=p_id;
  return true;
end $$;
revoke all on function public.finish_reminder_delivery(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.finish_reminder_delivery(uuid,uuid,text,text,text) to service_role;

create function public.cancel_withdrawn_reminders() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.reminder_deliveries d set status='cancelled',error_code='CONSENT_WITHDRAWN' from public.reminder_jobs j where j.id=d.reminder_job_id and d.user_id=new.user_id and d.status in ('queued','retry_wait') and (not case when j.kind='weekly_progress_ready' then coalesce(new.weekly_report,false) else coalesce(new.study_reminders,false) end or d.channel='email' and not new.email_enabled or d.channel='whatsapp' and not new.whatsapp_enabled);
  return new;
end $$;
revoke all on function public.cancel_withdrawn_reminders() from public,anon,authenticated;
create trigger notification_withdrawal after update on public.notification_preferences for each row execute function public.cancel_withdrawn_reminders();

-- Platform extensions are unavailable in the isolated PostgreSQL test runtime.
do $$ begin
  if exists(select 1 from pg_available_extensions where name='pg_cron') then create extension if not exists pg_cron; end if;
  if exists(select 1 from pg_available_extensions where name='pg_net') then create extension if not exists pg_net with schema extensions; end if;
end $$;
create function public.invoke_reminder_dispatcher() returns bigint language plpgsql security definer set search_path='' as $$
declare endpoint text; credential text; request_id bigint;
begin
  if not exists(select 1 from public.reminder_runtime where singleton and scheduler_enabled) then return null; end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name=$1 limit 1' into endpoint using 'athena_reminder_endpoint';
  execute 'select decrypted_secret from vault.decrypted_secrets where name=$1 limit 1' into credential using 'athena_reminder_scheduler_secret';
  if endpoint is null or credential is null then return null; end if;
  execute 'select net.http_post(url:=$1,headers:=$2,body:=$3,timeout_milliseconds:=60000)' into request_id using endpoint,jsonb_build_object('Content-Type','application/json','x-athena-scheduler',credential),'{}'::jsonb;
  return request_id;
end $$;
revoke all on function public.invoke_reminder_dispatcher() from public,anon,authenticated;
