-- Read-only metadata checks; safe for a linked project with real users.
begin read only;
select jsonb_build_object(
 'tables',(select jsonb_agg(to_jsonb(metadata)) from (
   select t.tablename,t.rowsecurity,count(p.policyname) as policy_count,
     has_table_privilege('anon',format('public.%I',t.tablename),'select') as anon_select
   from pg_tables t left join pg_policies p on p.schemaname=t.schemaname and p.tablename=t.tablename
   where t.schemaname='public' and t.tablename in (
    'profiles','study_preferences','notification_preferences','roadmaps','roadmap_sections','roadmap_topics',
    'topic_prerequisites','knowledge_topics','daily_tasks','study_sessions','athena_conversations','athena_messages')
   group by t.tablename,t.rowsecurity order by t.tablename
 ) metadata),
 'functions',(select jsonb_agg(to_jsonb(metadata)) from (
   select p.proname,p.prosecdef as security_definer,
     has_function_privilege('anon',p.oid,'execute') as anon_execute,
     has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and (p.proname like 'get_%_snapshot' or p.proname in ('set_task_status','start_focus_session','project_keepalive','get_auth_profile','complete_onboarding'))
   order by p.proname
 ) metadata),
 'keepalive',public.project_keepalive()
) as verification;
commit;
