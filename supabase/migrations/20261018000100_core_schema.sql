create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  avatar_url text, direction text, goal text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.study_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_study_minutes integer check (daily_study_minutes between 1 and 1440),
  study_period text check (study_period in ('morning','afternoon','evening','night','flexible')),
  learning_style text check (learning_style in ('build_first','theory_first','balanced','practice_heavy')),
  task_size text check (task_size in ('quick','focused','deep')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  study_reminders boolean, weekly_report boolean, email_enabled boolean, whatsapp_enabled boolean,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.roadmaps (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check(length(trim(title)) > 0), goal text,
  status text not null default 'active' check(status in ('active','archived','completed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id)
);
create table public.roadmap_sections (
  id uuid primary key default gen_random_uuid(), roadmap_id uuid not null references public.roadmaps(id) on delete cascade,
  title text not null, sort_order integer not null default 0, unique(id,roadmap_id)
);
create table public.roadmap_topics (
  id uuid primary key default gen_random_uuid(), roadmap_id uuid not null references public.roadmaps(id) on delete cascade,
  section_id uuid not null, title text not null, description text,
  status text not null default 'planned' check(status in ('planned','current','completed','suggested','gap')),
  topic_type text, sort_order integer not null default 0,
  estimated_minutes integer check(estimated_minutes >= 0), suggested_by_athena boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,roadmap_id), foreign key(section_id,roadmap_id) references public.roadmap_sections(id,roadmap_id) on delete cascade
);
create table public.topic_prerequisites (
  topic_id uuid not null, prerequisite_topic_id uuid not null, roadmap_id uuid not null,
  primary key(topic_id,prerequisite_topic_id), check(topic_id <> prerequisite_topic_id),
  foreign key(topic_id,roadmap_id) references public.roadmap_topics(id,roadmap_id) on delete cascade,
  foreign key(prerequisite_topic_id,roadmap_id) references public.roadmap_topics(id,roadmap_id) on delete cascade
);
-- Skills are knowledge topics, rather than a second store of ratings and verification.
create table public.knowledge_topics (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check(length(trim(title)) > 0), description text,
  knowledge_state text not null default 'unclassified' check(knowledge_state in ('unclassified','known','learning','suggested','gap')),
  self_reported_level text not null default 'not_rated' check(self_reported_level in ('not_rated','beginner','comfortable','strong')),
  verified_level text, verified_confidence numeric check(verified_confidence between 0 and 1),
  verification_status text not null default 'untested' check(verification_status in ('untested','verified','needs_review')),
  source text not null default 'self_report', roadmap_id uuid, roadmap_topic_id uuid,
  suggested_by_athena boolean not null default false, gap_reason text, last_studied_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(roadmap_topic_id is null or roadmap_id is not null),
  foreign key(roadmap_id,user_id) references public.roadmaps(id,user_id),
  foreign key(roadmap_topic_id,roadmap_id) references public.roadmap_topics(id,roadmap_id)
);
create unique index knowledge_topics_user_name on public.knowledge_topics(user_id,lower(trim(title)));
create view public.user_skills with (security_invoker = true) as
  select id,user_id,title as name,self_reported_level,verified_level,verified_confidence,verification_status,created_at,updated_at from public.knowledge_topics;
create table public.daily_tasks (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  roadmap_id uuid, topic_id uuid, title text not null, description text,
  status text not null default 'planned' check(status in ('planned','in_progress','completed','missed')),
  priority text, estimated_minutes integer check(estimated_minutes >= 0), actual_minutes numeric check(actual_minutes >= 0),
  scheduled_for date not null, sort_order integer not null default 0, completed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id), unique(id,topic_id),
  check(topic_id is null or roadmap_id is not null),
  foreign key(roadmap_id,user_id) references public.roadmaps(id,user_id),
  foreign key(topic_id,roadmap_id) references public.roadmap_topics(id,roadmap_id)
);
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid, topic_id uuid references public.roadmap_topics(id),
  started_at timestamptz not null default now(), ended_at timestamptz,
  duration_minutes numeric generated always as (case when ended_at is not null then greatest(0,extract(epoch from (ended_at-started_at))/60) end) stored,
  status text not null default 'active' check(status in ('active','completed','cancelled')),
  created_at timestamptz not null default now(),
  foreign key(task_id,user_id) references public.daily_tasks(id,user_id),
  check(ended_at is null or ended_at >= started_at),
  check((status='active' and ended_at is null) or (status <> 'active' and ended_at is not null))
);
create unique index one_active_session_per_user on public.study_sessions(user_id) where status='active';
create function public.check_session_references() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.topic_id is not null and not exists (
    select 1 from public.roadmap_topics t join public.roadmaps r on r.id=t.roadmap_id where t.id=new.topic_id and r.user_id=new.user_id
  ) then raise exception 'Session topic owner mismatch' using errcode='23503'; end if;
  if new.task_id is not null and not exists (
    select 1 from public.daily_tasks t where t.id=new.task_id and t.user_id=new.user_id and t.topic_id is not distinct from new.topic_id
  ) then raise exception 'Session task topic mismatch' using errcode='23503'; end if;
  return new;
end $$;
create trigger session_references before insert or update on public.study_sessions for each row execute function public.check_session_references();
create table public.athena_conversations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.athena_messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.athena_conversations(id) on delete cascade,
  role text not null check(role in ('user','assistant')), content text not null check(length(content) <= 50000),
  status text not null default 'completed' check(status in ('pending','completed','error','stopped')),
  created_at timestamptz not null default now()
);
create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['profiles','study_preferences','notification_preferences','roadmaps','roadmap_topics','knowledge_topics','daily_tasks','athena_conversations'] loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',t);
  end loop;
end $$;
