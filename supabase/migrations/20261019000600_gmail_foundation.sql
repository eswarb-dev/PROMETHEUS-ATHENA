create table public.mailbox_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'gmail' check(provider='gmail'),
  mailbox_address text not null unique check(mailbox_address='prometheus.inference@gmail.com'),
  status text not null check(status in ('connected','needs_reauthorization','disconnected')),
  granted_scopes text[] not null check(granted_scopes=array['https://www.googleapis.com/auth/gmail.readonly']::text[]),
  connected_at timestamptz not null default now(), last_token_refresh_at timestamptz,
  last_watch_started_at timestamptz, watch_expires_at timestamptz, last_history_id text,
  last_sync_at timestamptz,
  last_error_code text check(last_error_code in ('GMAIL_REAUTHORIZE','GMAIL_UNAVAILABLE','GMAIL_STORAGE')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.gmail_oauth_states (
  state_hash text primary key check(state_hash ~ '^[a-f0-9]{64}$'),
  verifier_secret_id uuid not null,
  expires_at timestamptz not null default now()+interval '10 minutes',
  consumed_at timestamptz, created_at timestamptz not null default now()
);
create table public.mail_threads (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.mailbox_connections(id),
  provider text not null default 'gmail' check(provider='gmail'),
  provider_thread_id text not null unique check(provider_thread_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  subject text not null check(octet_length(subject)<=4096),
  participants jsonb not null default '[]' check(jsonb_typeof(participants)='array'),
  first_message_at timestamptz not null, last_message_at timestamptz not null,
  message_count integer not null default 0 check(message_count>=0),
  status text not null default 'received' check(status='received'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.mail_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.mail_threads(id),
  provider text not null default 'gmail' check(provider='gmail'),
  provider_message_id text not null unique check(provider_message_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  direction text not null default 'inbound' check(direction='inbound'),
  sender_email text not null check(length(sender_email)<=320),sender_name text check(octet_length(sender_name)<=1024),
  to_addresses jsonb not null check(jsonb_typeof(to_addresses)='array' and jsonb_array_length(to_addresses)<=100),
  cc_addresses jsonb not null check(jsonb_typeof(cc_addresses)='array' and jsonb_array_length(cc_addresses)<=100),
  subject text not null check(octet_length(subject)<=4096),
  text_body text check(octet_length(text_body)<=65536),
  sanitized_html_body text check(octet_length(sanitized_html_body)<=65536),
  snippet text check(octet_length(snippet)<=1024),
  provider_internal_date timestamptz not null,received_at timestamptz not null default now(),processed_at timestamptz,
  has_attachments boolean not null default false,
  created_at timestamptz not null default now()
);
create index mail_threads_recent on public.mail_threads(last_message_at desc);
create index mail_messages_thread on public.mail_messages(thread_id);
create index mail_messages_received on public.mail_messages(received_at desc);
alter table public.mailbox_connections enable row level security;
alter table public.gmail_oauth_states enable row level security;
alter table public.mail_threads enable row level security;
alter table public.mail_messages enable row level security;
revoke all on public.mailbox_connections,public.gmail_oauth_states,public.mail_threads,public.mail_messages from public,anon,authenticated;
grant select,insert,update,delete on public.mailbox_connections,public.gmail_oauth_states,public.mail_threads,public.mail_messages to service_role;
-- No browser policies: the mailbox is a system resource, not user-owned mail.

create function public.gmail_has_refresh_token() returns boolean language plpgsql security definer set search_path='' as $$
declare present boolean;
begin
  execute 'select exists(select 1 from vault.secrets where name=$1)' into present using 'athena_gmail_refresh_token';
  return present;
end $$;

create function public.gmail_create_oauth_state(p_state_hash text,p_verifier text) returns boolean language plpgsql security definer set search_path='' as $$
declare secret_id uuid; old record;
begin
  if p_state_hash !~ '^[a-f0-9]{64}$' or p_verifier !~ '^[A-Za-z0-9_-]{43,128}$' then raise exception 'Gmail state invalid' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(190006);
  for old in select verifier_secret_id from public.gmail_oauth_states where expires_at<=now() and consumed_at is null loop
    execute 'delete from vault.secrets where id=$1' using old.verifier_secret_id;
  end loop;
  delete from public.gmail_oauth_states where expires_at<=now();
  if (select count(*) from public.gmail_oauth_states where consumed_at is null)>=5 then return false; end if;
  execute 'select vault.create_secret($1,$2,$3)' into secret_id using p_verifier,'athena_gmail_pkce_'||p_state_hash,'Single-use Gmail PKCE verifier';
  insert into public.gmail_oauth_states(state_hash,verifier_secret_id) values(p_state_hash,secret_id);
  return true;
end $$;

create function public.gmail_consume_oauth_state(p_state_hash text) returns text language plpgsql security definer set search_path='' as $$
declare secret_id uuid; verifier text;
begin
  update public.gmail_oauth_states set consumed_at=now() where state_hash=p_state_hash and expires_at>now() and consumed_at is null returning verifier_secret_id into secret_id;
  if secret_id is null then return null; end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where id=$1' into verifier using secret_id;
  execute 'delete from vault.secrets where id=$1' using secret_id;
  return verifier;
end $$;

create function public.gmail_save_connection(p_mailbox text,p_scopes text[],p_refresh_token text default null) returns boolean language plpgsql security definer set search_path='' as $$
declare secret_id uuid;
begin
  if p_mailbox is distinct from 'prometheus.inference@gmail.com' or p_scopes is distinct from array['https://www.googleapis.com/auth/gmail.readonly']::text[] then raise exception 'Gmail connection rejected' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(190007);
  execute 'select id from vault.secrets where name=$1' into secret_id using 'athena_gmail_refresh_token';
  if p_refresh_token is not null then
    if length(p_refresh_token)<1 or length(p_refresh_token)>8192 then raise exception 'Gmail token invalid' using errcode='22023'; end if;
    if secret_id is null then
      execute 'select vault.create_secret($1,$2,$3)' into secret_id using p_refresh_token,'athena_gmail_refresh_token','System Gmail OAuth refresh token';
    else
      execute 'select vault.update_secret($1,$2)' using secret_id,p_refresh_token;
    end if;
  end if;
  if secret_id is null then return false; end if;
  insert into public.mailbox_connections(mailbox_address,status,granted_scopes) values(p_mailbox,'connected',p_scopes)
    on conflict(mailbox_address) do update set status='connected',granted_scopes=excluded.granted_scopes,connected_at=now(),last_error_code=null,updated_at=now();
  return true;
end $$;

create function public.gmail_read_refresh_token() returns text language plpgsql security definer set search_path='' as $$
declare credential text;
begin
  if not exists(select 1 from public.mailbox_connections where status='connected') then return null; end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name=$1' into credential using 'athena_gmail_refresh_token';
  return credential;
end $$;

create function public.gmail_record_token_refresh(p_error text default null) returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_error is not null and p_error not in ('GMAIL_REAUTHORIZE','GMAIL_UNAVAILABLE') then raise exception 'Invalid Gmail error' using errcode='22023'; end if;
  update public.mailbox_connections set status=case when p_error='GMAIL_REAUTHORIZE' then 'needs_reauthorization' else status end,
    last_token_refresh_at=case when p_error is null then now() else last_token_refresh_at end,last_error_code=p_error,updated_at=now();
  return found;
end $$;

create function public.gmail_store_message(p_message jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare connection uuid; thread uuid; message uuid; item record;
begin
  select id into connection from public.mailbox_connections where status='connected' and mailbox_address='prometheus.inference@gmail.com';
  if connection is null then raise exception 'Gmail connection required' using errcode='42501'; end if;
  if p_message->>'direction' is distinct from 'inbound' or jsonb_typeof(p_message->'toAddresses') is distinct from 'array' or jsonb_typeof(p_message->'ccAddresses') is distinct from 'array' then raise exception 'Invalid inbound message' using errcode='22023'; end if;
  insert into public.mail_threads(connection_id,provider_thread_id,subject,first_message_at,last_message_at)
    values(connection,p_message->>'providerThreadId',p_message->>'subject',(p_message->>'internalDate')::timestamptz,(p_message->>'internalDate')::timestamptz)
    on conflict(provider_thread_id) do update set updated_at=public.mail_threads.updated_at returning id into thread;
  insert into public.mail_messages(thread_id,provider_message_id,sender_email,sender_name,to_addresses,cc_addresses,subject,text_body,sanitized_html_body,snippet,provider_internal_date,has_attachments)
    values(thread,p_message->>'providerMessageId',p_message->>'senderEmail',p_message->>'senderName',p_message->'toAddresses',p_message->'ccAddresses',p_message->>'subject',p_message->>'textBody',p_message->>'sanitizedHtmlBody',p_message->>'snippet',(p_message->>'internalDate')::timestamptz,coalesce((p_message->>'hasAttachments')::boolean,false))
    on conflict(provider_message_id) do nothing returning id into message;
  if message is null then
    if not exists(select 1 from public.mail_messages where provider_message_id=p_message->>'providerMessageId' and thread_id=thread) then raise exception 'Message thread mismatch' using errcode='22023'; end if;
    return jsonb_build_object('stored',false,'duplicate',true);
  end if;
  select min(provider_internal_date) first_at,max(provider_internal_date) last_at,count(*)::integer total into item from public.mail_messages where thread_id=thread;
  update public.mail_threads set first_message_at=item.first_at,last_message_at=item.last_at,message_count=item.total,updated_at=now(),
    participants=(select coalesce(jsonb_agg(address order by address),'[]') from (select distinct sender_email address from public.mail_messages where thread_id=thread union select distinct jsonb_array_elements_text(to_addresses) from public.mail_messages where thread_id=thread union select distinct jsonb_array_elements_text(cc_addresses) from public.mail_messages where thread_id=thread) addresses) where id=thread;
  update public.mailbox_connections set last_sync_at=now(),updated_at=now() where id=connection;
  return jsonb_build_object('stored',true,'duplicate',false);
end $$;

revoke all on function public.gmail_has_refresh_token(),public.gmail_create_oauth_state(text,text),public.gmail_consume_oauth_state(text),public.gmail_save_connection(text,text[],text),public.gmail_read_refresh_token(),public.gmail_record_token_refresh(text),public.gmail_store_message(jsonb) from public,anon,authenticated;
grant execute on function public.gmail_has_refresh_token(),public.gmail_create_oauth_state(text,text),public.gmail_consume_oauth_state(text),public.gmail_save_connection(text,text[],text),public.gmail_read_refresh_token(),public.gmail_record_token_refresh(text),public.gmail_store_message(jsonb) to service_role;
