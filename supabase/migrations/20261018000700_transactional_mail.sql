create table public.transactional_mail_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mail_type text not null check (mail_type = 'welcome'),
  status text not null default 'queued' check (status in ('queued','sending','retry_wait','sent','failed','unknown_delivery')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  claim_token uuid,
  next_attempt_at timestamptz not null default now(),
  provider_message_id text,
  error_code text check (error_code in ('MAIL_AUTH','MAIL_RATE_LIMIT','MAIL_CONNECTION','MAIL_PROVIDER','MAIL_UNKNOWN')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  unique(user_id, mail_type)
);
alter table public.transactional_mail_log enable row level security;
revoke all on public.transactional_mail_log from public, anon, authenticated;

create function public.queue_welcome_mail() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.onboarding_completed and not old.onboarding_completed and exists (
    select 1 from auth.users where id=new.id and email_confirmed_at is not null
  ) then
    insert into public.transactional_mail_log(user_id,mail_type) values(new.id,'welcome')
      on conflict(user_id,mail_type) do nothing;
  end if;
  return new;
end $$;
revoke all on function public.queue_welcome_mail() from public,anon,authenticated;
create trigger profile_welcome_mail after update of onboarding_completed on public.profiles
for each row execute function public.queue_welcome_mail();

create function public.claim_welcome_mail(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare item public.transactional_mail_log; recipient text; display_name text;
begin
  select u.email,p.name into recipient,display_name from auth.users u join public.profiles p on p.id=u.id
    where u.id=p_user_id and u.email_confirmed_at is not null and p.onboarding_completed;
  if recipient is null then return null; end if;
  select * into item from public.transactional_mail_log where user_id=p_user_id and mail_type='welcome' for update;
  if not found or item.status not in ('queued','retry_wait') or item.next_attempt_at>now() or item.attempt_count>=3 then return null; end if;
  update public.transactional_mail_log set status='sending',attempt_count=attempt_count+1,
    claim_token=gen_random_uuid(),updated_at=now() where id=item.id returning * into item;
  return jsonb_build_object('id',item.id,'claimToken',item.claim_token,'email',recipient,'name',display_name);
end $$;

create function public.finish_welcome_mail(p_id uuid,p_claim_token uuid,p_status text,p_error_code text default null,p_provider_message_id text default null) returns boolean
language plpgsql security definer set search_path = '' as $$
declare item public.transactional_mail_log;
begin
  if p_status not in ('sent','retry_wait','failed','unknown_delivery') then raise exception 'Invalid mail status' using errcode='22023'; end if;
  select * into item from public.transactional_mail_log where id=p_id and claim_token=p_claim_token and status='sending' for update;
  if not found then return false; end if;
  update public.transactional_mail_log set
    status=case when p_status='retry_wait' and attempt_count>=3 then 'failed' else p_status end,
    error_code=p_error_code,
    provider_message_id=left(p_provider_message_id,200),
    sent_at=case when p_status='sent' then now() else null end,
    next_attempt_at=now()+make_interval(secs => (60*power(2,attempt_count-1))::integer),
    claim_token=null,updated_at=now() where id=p_id;
  return true;
end $$;
revoke all on function public.claim_welcome_mail(uuid) from public,anon,authenticated;
revoke all on function public.finish_welcome_mail(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.claim_welcome_mail(uuid) to service_role;
grant execute on function public.finish_welcome_mail(uuid,uuid,text,text,text) to service_role;
