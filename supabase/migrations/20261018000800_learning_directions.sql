create table public.user_learning_directions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  normalized_name text generated always as (lower(regexp_replace(btrim(name),'\s+',' ','g'))) stored,
  is_primary boolean not null default false,
  source text not null check (source in ('preset','custom')),
  sort_order integer not null check (sort_order between 0 and 2),
  created_at timestamptz not null default now(),
  unique(user_id,normalized_name), unique(user_id,sort_order)
);
create unique index learning_direction_one_primary on public.user_learning_directions(user_id) where is_primary;
alter table public.user_learning_directions enable row level security;
revoke all on public.user_learning_directions from public,anon,authenticated;
grant select on public.user_learning_directions to authenticated;
create policy learning_directions_owner on public.user_learning_directions for select to authenticated using(user_id=auth.uid());

insert into public.user_learning_directions(user_id,name,is_primary,source,sort_order)
select id,btrim(direction),true,case when btrim(direction)=any(array['AI / Machine Learning','Full-Stack Development','Data Science','Mobile Development','Cybersecurity','Cloud / DevOps','Research / Higher Studies','Placement Preparation']) then 'preset' else 'custom' end,0
from public.profiles where nullif(btrim(direction),'') is not null;

create function public.enforce_learning_direction_set() returns trigger language plpgsql security definer set search_path='' as $$
declare owner_id uuid := coalesce(new.user_id,old.user_id); total integer; primaries integer;
begin
  select count(*),count(*) filter(where is_primary) into total,primaries from public.user_learning_directions where user_id=owner_id;
  if total>3 or (total>0 and primaries<>1) then raise exception 'Choose one primary among one to three directions' using errcode='23514'; end if;
  return null;
end $$;
revoke all on function public.enforce_learning_direction_set() from public,anon,authenticated;
create constraint trigger learning_direction_set_valid after insert or update or delete on public.user_learning_directions
deferrable initially deferred for each row execute function public.enforce_learning_direction_set();

create function public.replace_learning_directions(p_owner uuid,p_directions jsonb) returns void language plpgsql security definer set search_path='' as $$
declare item jsonb; position integer := 0; primary_name text;
begin
  if jsonb_typeof(p_directions) is distinct from 'array' then raise exception 'Invalid directions' using errcode='22023'; end if;
  if jsonb_array_length(p_directions) not between 1 and 3 then raise exception 'Choose one to three directions' using errcode='22023'; end if;
  if (select count(*) from jsonb_array_elements(p_directions) d where d->'isPrimary'='true'::jsonb)<>1 then raise exception 'Choose exactly one primary' using errcode='22023'; end if;
  perform 1 from public.profiles where id=p_owner for update;
  delete from public.user_learning_directions where user_id=p_owner;
  for item in select value from jsonb_array_elements(p_directions) loop
    if jsonb_typeof(item->'name') is distinct from 'string' or length(btrim(item->>'name')) not between 1 and 200 or jsonb_typeof(item->'isPrimary') is distinct from 'boolean' or coalesce(item->>'source','') not in ('preset','custom') then raise exception 'Invalid direction' using errcode='22023'; end if;
    if item->>'source'='preset' and not (item->>'name'=any(array['AI / Machine Learning','Full-Stack Development','Data Science','Mobile Development','Cybersecurity','Cloud / DevOps','Research / Higher Studies','Placement Preparation'])) then raise exception 'Invalid preset' using errcode='22023'; end if;
    insert into public.user_learning_directions(user_id,name,is_primary,source,sort_order) values(p_owner,regexp_replace(btrim(item->>'name'),'\s+',' ','g'),(item->>'isPrimary')::boolean,item->>'source',position);
    if (item->>'isPrimary')::boolean then primary_name:=regexp_replace(btrim(item->>'name'),'\s+',' ','g'); end if;
    position:=position+1;
  end loop;
  update public.profiles set direction=primary_name where id=p_owner;
end $$;
revoke all on function public.replace_learning_directions(uuid,jsonb) from public,anon,authenticated;

-- Retain the verified, atomic onboarding implementation and extend its payload.
alter function public.complete_onboarding(jsonb) rename to complete_onboarding_base;
revoke all on function public.complete_onboarding_base(jsonb) from public,anon,authenticated;
create function public.complete_onboarding(p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); directions jsonb:=p_payload->'directions'; primary_name text; result jsonb;
begin
  if owner_id is null or not exists(select 1 from auth.users where id=owner_id and email_confirmed_at is not null) then raise exception 'Verified authentication required' using errcode='42501'; end if;
  if p_payload ? 'startingFromScratch' and jsonb_typeof(p_payload->'startingFromScratch') is distinct from 'boolean' then raise exception 'Invalid scratch mode' using errcode='22023'; end if;
  if p_payload->'startingFromScratch'='true'::jsonb and (jsonb_typeof(p_payload->'skills') is distinct from 'array' or jsonb_array_length(p_payload->'skills')<>0) then raise exception 'Scratch mode cannot include skills' using errcode='22023'; end if;
  -- Older clients submit one direction; preserve that contract during rollout.
  if directions is null then directions:=jsonb_build_array(jsonb_build_object('name',p_payload->'goal'->>'direction','isPrimary',true,'source','custom')); end if;
  perform public.get_auth_profile();
  perform public.replace_learning_directions(owner_id,directions);
  select name into primary_name from public.user_learning_directions where user_id=owner_id and is_primary;
  result:=public.complete_onboarding_base(jsonb_set(p_payload,'{goal,direction}',to_jsonb(primary_name)));
  return result;
end $$;
revoke all on function public.complete_onboarding(jsonb) from public,anon;
grant execute on function public.complete_onboarding(jsonb) to authenticated;
revoke update(direction),insert(direction) on public.profiles from authenticated;

create function public.update_learning_profile(p_patch jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid();
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if jsonb_typeof(p_patch) is distinct from 'object' then raise exception 'Invalid profile patch' using errcode='22023'; end if;
  if exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('name','goal','directions')) then raise exception 'Invalid profile field' using errcode='22023'; end if;
  perform 1 from public.profiles where id=owner_id for update;
  if not found then raise exception 'Profile unavailable' using errcode='P0002'; end if;
  if p_patch ? 'name' then
    if jsonb_typeof(p_patch->'name') is distinct from 'string' or length(btrim(p_patch->>'name')) not between 1 and 200 then raise exception 'Invalid name' using errcode='22023'; end if;
    update public.profiles set name=btrim(p_patch->>'name') where id=owner_id;
  end if;
  if p_patch ? 'goal' then
    if jsonb_typeof(p_patch->'goal') is distinct from 'string' or length(btrim(p_patch->>'goal')) not between 1 and 1000 then raise exception 'Invalid goal' using errcode='22023'; end if;
    update public.profiles set goal=btrim(p_patch->>'goal') where id=owner_id;
  end if;
  if p_patch ? 'directions' then perform public.replace_learning_directions(owner_id,p_patch->'directions'); end if;
  return jsonb_build_object('saved',true);
end $$;
revoke all on function public.update_learning_profile(jsonb) from public,anon;
grant execute on function public.update_learning_profile(jsonb) to authenticated;

create function public.get_learning_directions() returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('name',name,'isPrimary',is_primary,'source',source,'sortOrder',sort_order) order by sort_order,id),'[]') from public.user_learning_directions where user_id=auth.uid()
$$;
revoke all on function public.get_learning_directions() from public,anon;
grant execute on function public.get_learning_directions() to authenticated;

alter function public.get_settings_snapshot() rename to get_settings_snapshot_base;
create function public.get_settings_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$
  select case when value->'profile' <> 'null'::jsonb then jsonb_set(value,'{profile,directions}',public.get_learning_directions()) else value end from (select public.get_settings_snapshot_base() value) s
$$;
revoke all on function public.get_settings_snapshot() from public,anon;
grant execute on function public.get_settings_snapshot() to authenticated;

alter function public.get_roadmap_snapshot() rename to get_roadmap_snapshot_base;
create function public.get_roadmap_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$
  select case when value is null then null else value || jsonb_build_object('learningProfile',jsonb_build_object('directions',public.get_learning_directions(),'primaryDirection',(select name from public.user_learning_directions where user_id=auth.uid() and is_primary))) end from (select public.get_roadmap_snapshot_base() value) s
$$;
revoke all on function public.get_roadmap_snapshot() from public,anon;
grant execute on function public.get_roadmap_snapshot() to authenticated;
