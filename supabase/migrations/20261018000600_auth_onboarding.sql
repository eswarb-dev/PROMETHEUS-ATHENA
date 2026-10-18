alter table public.profiles add column onboarding_completed boolean not null default false;

create function public.create_auth_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,name) values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),nullif(split_part(new.email,'@',1),''),'Learner'),200)) on conflict(id) do nothing;
  return new;
end $$;
revoke execute on function public.create_auth_profile() from public,anon,authenticated;
create trigger athena_auth_profile after insert on auth.users for each row execute function public.create_auth_profile();

-- Existing Auth users may predate the trigger. Provision only the current owner.
create function public.get_auth_profile() returns jsonb language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid(); result jsonb;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  insert into public.profiles(id,name)
    select id,left(coalesce(nullif(trim(raw_user_meta_data->>'name'),''),nullif(split_part(email,'@',1),''),'Learner'),200) from auth.users where id=owner_id
    on conflict(id) do nothing;
  select jsonb_build_object('id',id,'name',name,'onboardingCompleted',onboarding_completed) into result from public.profiles where id=owner_id;
  if result is null then raise exception 'Profile unavailable' using errcode='P0002'; end if;
  return result;
end $$;

create function public.complete_onboarding(p_payload jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid(); skill jsonb; prefs jsonb := p_payload->'studyPreferences'; identity_name text := trim(p_payload->'account'->>'name'); profile_direction text := trim(p_payload->'goal'->>'direction'); profile_goal text := trim(p_payload->'goal'->>'description');
begin
  if owner_id is null or not exists(select 1 from auth.users where id=owner_id and email_confirmed_at is not null) then raise exception 'Verified authentication required' using errcode='42501'; end if;
  if identity_name is null or length(identity_name) not between 1 and 200 or profile_direction is null or length(profile_direction) not between 1 and 200 or profile_goal is null or length(profile_goal) not between 1 and 1000 then raise exception 'Invalid profile' using errcode='22023'; end if;
  if jsonb_typeof(p_payload->'skills') is distinct from 'array' or jsonb_array_length(p_payload->'skills') > 100 then raise exception 'Invalid skills' using errcode='22023'; end if;
  if (prefs->>'dailyStudyMinutes') is null or (prefs->>'studyPeriod') is null or (prefs->>'learningStyle') is null or (prefs->>'taskSize') is null then raise exception 'Incomplete preferences' using errcode='22023'; end if;
  if jsonb_typeof(p_payload->'notifications'->'email') is distinct from 'boolean' or jsonb_typeof(p_payload->'notifications'->'whatsapp') is distinct from 'boolean' then raise exception 'Invalid notification consent' using errcode='22023'; end if;
  perform public.get_auth_profile();
  -- Serialize simultaneous submissions for the same owner.
  perform 1 from public.profiles where id=owner_id for update;
  update public.profiles set name=identity_name,direction=profile_direction,goal=profile_goal where id=owner_id;
  insert into public.study_preferences(user_id,daily_study_minutes,study_period,learning_style,task_size)
    values(owner_id,(prefs->>'dailyStudyMinutes')::integer,prefs->>'studyPeriod',prefs->>'learningStyle',prefs->>'taskSize')
    on conflict(user_id) do update set daily_study_minutes=excluded.daily_study_minutes,study_period=excluded.study_period,learning_style=excluded.learning_style,task_size=excluded.task_size;
  insert into public.notification_preferences(user_id,email_enabled,whatsapp_enabled)
    values(owner_id,(p_payload->'notifications'->>'email')::boolean,(p_payload->'notifications'->>'whatsapp')::boolean)
    on conflict(user_id) do update set email_enabled=excluded.email_enabled,whatsapp_enabled=excluded.whatsapp_enabled;
  for skill in select value from jsonb_array_elements(p_payload->'skills') loop
    if nullif(trim(skill->>'name'),'') is null or length(trim(skill->>'name'))>200 or coalesce(skill->>'selfReportedLevel','') not in ('not_rated','beginner','comfortable','strong') then raise exception 'Invalid skill' using errcode='22023'; end if;
    insert into public.knowledge_topics(user_id,title,self_reported_level) values(owner_id,trim(skill->>'name'),skill->>'selfReportedLevel')
      on conflict(user_id,(lower(trim(title)))) do update set self_reported_level=excluded.self_reported_level;
  end loop;
  update public.profiles set onboarding_completed=true where id=owner_id;
  return jsonb_build_object('completed',true,'profileId',owner_id);
end $$;
revoke execute on function public.get_auth_profile(),public.complete_onboarding(jsonb) from public,anon;
grant execute on function public.get_auth_profile(),public.complete_onboarding(jsonb) to authenticated;
