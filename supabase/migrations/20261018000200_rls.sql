revoke all on public.profiles,public.study_preferences,public.notification_preferences,public.roadmaps,public.roadmap_sections,public.roadmap_topics,public.topic_prerequisites,public.knowledge_topics,public.user_skills,public.daily_tasks,public.study_sessions,public.athena_conversations,public.athena_messages from public, anon, authenticated;
do $$ declare t text; col text; begin
  foreach t in array array['profiles','study_preferences','notification_preferences','roadmaps','knowledge_topics','daily_tasks','study_sessions','athena_conversations'] loop
    col := case when t='profiles' then 'id' else 'user_id' end;
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy owner on public.%I for all to authenticated using ((select auth.uid()) = %I) with check ((select auth.uid()) = %I)',t,col,col);
  end loop;
  foreach t in array array['roadmap_sections','roadmap_topics','topic_prerequisites'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy owner on public.%I for all to authenticated using (exists(select 1 from public.roadmaps r where r.id=roadmap_id and r.user_id=(select auth.uid()))) with check (exists(select 1 from public.roadmaps r where r.id=roadmap_id and r.user_id=(select auth.uid())))',t);
  end loop;
end $$;
alter table public.athena_messages enable row level security;
create policy owner on public.athena_messages for select to authenticated using (
  exists(select 1 from public.athena_conversations c where c.id=conversation_id and c.user_id=(select auth.uid()))
);
grant select on public.profiles,public.study_preferences,public.notification_preferences,public.roadmaps,public.roadmap_sections,public.roadmap_topics,public.topic_prerequisites,public.knowledge_topics,public.user_skills,public.daily_tasks,public.study_sessions,public.athena_conversations,public.athena_messages to authenticated;
grant insert(id,name,direction,goal), update(name,direction,goal) on public.profiles to authenticated;
grant insert(user_id,daily_study_minutes,study_period,learning_style,task_size), update(daily_study_minutes,study_period,learning_style,task_size) on public.study_preferences to authenticated;
grant insert(user_id,study_reminders,weekly_report,email_enabled,whatsapp_enabled), update(study_reminders,weekly_report,email_enabled,whatsapp_enabled) on public.notification_preferences to authenticated;
grant insert(user_id,title,description,self_reported_level), update(self_reported_level), delete on public.knowledge_topics to authenticated;
grant insert(user_id,title,goal,status), update(title,goal,status), delete on public.roadmaps to authenticated;
grant insert(roadmap_id,title,sort_order), update(title,sort_order), delete on public.roadmap_sections to authenticated;
grant insert(roadmap_id,section_id,title,description,sort_order,estimated_minutes,topic_type), update(status,title,description,sort_order,estimated_minutes), delete on public.roadmap_topics to authenticated;
grant insert,delete on public.topic_prerequisites to authenticated;
-- Task/session writes go through atomic RPCs. Assistant messages and verification
-- fields have no browser write grants; a later trusted backend must own them.
revoke execute on function public.touch_updated_at() from public,anon,authenticated;
revoke execute on function public.check_session_references() from public,anon,authenticated;
