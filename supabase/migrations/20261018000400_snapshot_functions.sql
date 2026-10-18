create function public.get_roadmap_snapshot() returns jsonb language sql stable security invoker set search_path = '' as $$
  with active as (select * from public.roadmaps where user_id=auth.uid() and status='active' order by updated_at desc,id limit 1)
  select (select jsonb_build_object(
    'roadmap',jsonb_build_object('id',r.id,'title',r.title,'goal',r.goal,
      'progressPercent',(select round(100.0*count(*) filter(where status='completed')/nullif(count(*),0)) from public.roadmap_topics where roadmap_id=r.id),
      'estimatedRemainingMinutes',(select sum(estimated_minutes) from public.roadmap_topics where roadmap_id=r.id and status<>'completed')),
    'sections',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'roadmapId',s.roadmap_id,'title',s.title,'order',s.sort_order) order by s.sort_order,s.id) from public.roadmap_sections s where s.roadmap_id=r.id),'[]'),
    'topics',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'sectionId',t.section_id,'title',t.title,'description',t.description,'status',t.status,'order',t.sort_order,'estimatedMinutes',t.estimated_minutes,'suggestedByAthena',t.suggested_by_athena,
      'prerequisiteTopicIds',coalesce((select jsonb_agg(p.prerequisite_topic_id) from public.topic_prerequisites p where p.topic_id=t.id),'[]')) order by t.sort_order,t.id) from public.roadmap_topics t where t.roadmap_id=r.id),'[]')
  ) from active r)
$$;
create function public.get_today_snapshot(p_date date) returns jsonb language sql stable security invoker set search_path = '' as $$
  with tasks as (select * from public.daily_tasks where user_id=auth.uid() and scheduled_for=p_date)
  select jsonb_build_object('date',p_date,'timezone','Asia/Kolkata',
    'taskCount',count(*),'completedTaskCount',count(*) filter(where status='completed'),
    'plannedMinutes',sum(estimated_minutes),'completedMinutes',sum(actual_minutes) filter(where status='completed'),
    'tasks',coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'description',description,'status',status,'priority',priority,'estimatedMinutes',estimated_minutes,'actualMinutes',actual_minutes,'scheduledFor',scheduled_for,'order',sort_order,'completedAt',completed_at,'topicId',topic_id,'roadmapId',roadmap_id) order by sort_order,id),'[]'),
    'activeSession',(select jsonb_build_object('id',s.id,'taskId',s.task_id,'startedAt',s.started_at) from public.study_sessions s where s.user_id=auth.uid() and s.status='active' limit 1),
    'capabilities',jsonb_build_object('updateTask',true,'focusSessions',true)) from tasks
$$;
create function public.get_knowledge_snapshot() returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('summary',jsonb_build_object('totalTopics',count(*),'knownCount',count(*) filter(where knowledge_state='known'),'learningCount',count(*) filter(where knowledge_state='learning'),'suggestedCount',count(*) filter(where knowledge_state='suggested'),'gapCount',count(*) filter(where knowledge_state='gap'),'verifiedCount',count(*) filter(where verification_status='verified')),
    'topics',coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'description',description,'knowledgeState',knowledge_state,'selfReportedLevel',self_reported_level,'verifiedLevel',verified_level,'verifiedConfidence',verified_confidence,'verificationStatus',verification_status,'source',source,'roadmapId',roadmap_id,'roadmapTopicId',roadmap_topic_id,'suggestedByAthena',suggested_by_athena,'gapReason',gap_reason,'lastStudiedAt',last_studied_at,'updatedAt',updated_at) order by lower(title),id),'[]'),
    'capabilities',jsonb_build_object('updateSelfReport',true,'diagnostics',false))
  from public.knowledge_topics where user_id=auth.uid()
$$;
create function public.get_progress_snapshot(p_range text default '7d') returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare since_date date; end_date date := (now() at time zone 'Asia/Kolkata')::date; result jsonb;
begin
  if p_range not in ('7d','30d','90d') or p_range is null then raise exception 'Invalid range' using errcode='22023'; end if;
  since_date := end_date - (replace(p_range,'d','')::integer-1);
  with tasks as (select * from public.daily_tasks where user_id=auth.uid() and scheduled_for between since_date and end_date),
  sessions as (select * from public.study_sessions where user_id=auth.uid() and (started_at at time zone 'Asia/Kolkata')::date between since_date and end_date),
  topics as (select t.* from public.roadmap_topics t join public.roadmaps r on r.id=t.roadmap_id where r.user_id=auth.uid()),
  dates as (select scheduled_for as d from tasks union select (started_at at time zone 'Asia/Kolkata')::date from sessions),
  days as (select d,(select count(*) from tasks where scheduled_for=d) as planned_count,
    (select count(*) from tasks where scheduled_for=d and status='completed') as completed_count,
    (select sum(duration_minutes) from sessions where (started_at at time zone 'Asia/Kolkata')::date=d) as minutes,
    (select count(*) from sessions where (started_at at time zone 'Asia/Kolkata')::date=d) as session_count from dates)
  select jsonb_build_object('range',p_range,'hasHistory',exists(select 1 from tasks) or exists(select 1 from sessions) or exists(select 1 from topics),
    'summary',jsonb_build_object('completedTasks',(select count(*) from tasks where status='completed'),
      'totalStudyMinutes',(select sum(duration_minutes) from sessions),'averageSessionMinutes',(select avg(duration_minutes) from sessions where status='completed'),
      'studySessions',(select count(*) from sessions where status='completed'),'topicsCompleted',(select count(*) from topics where status='completed'),'totalTopics',(select count(*) from topics),
      'roadmapCompletionPercent',(select round(100.0*count(*) filter(where status='completed')/nullif(count(*),0)) from topics),
      'knowledgeVerified',(select count(*) from public.knowledge_topics where user_id=auth.uid() and verification_status='verified'),
      'knowledgeTotal',(select count(*) from public.knowledge_topics where user_id=auth.uid())),
    'weeklyActivity',coalesce((select jsonb_agg(jsonb_build_object('date',d,'studyMinutes',minutes,'tasksCompleted',completed_count,'sessions',session_count) order by d) from days where d>=end_date-6),'[]'),
    'topicProgress',coalesce((select jsonb_agg(jsonb_build_object('topicId',id,'title',title,'status',status,'order',sort_order,'updatedAt',updated_at,'progressPercent',case when status='completed' then 100 else null end) order by sort_order,id) from topics),'[]'),
    'consistency',coalesce((select jsonb_agg(jsonb_build_object('date',d,'planned',planned_count>0,'studied',coalesce(minutes,0)>0,'completedPlannedTasks',completed_count,'plannedTasks',planned_count) order by d) from days),'[]'),
    'recentSessions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'startedAt',s.started_at,'durationMinutes',s.duration_minutes,'taskTitle',t.title,'topicTitle',rt.title) order by s.started_at desc,s.id) from (select * from sessions order by started_at desc,id limit 50) s left join public.daily_tasks t on t.id=s.task_id left join public.roadmap_topics rt on rt.id=s.topic_id),'[]'),
    'capabilities',jsonb_build_object('rangeQueries',true)) into result;
  return result;
end $$;
create function public.get_settings_snapshot() returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'profile',(select jsonb_build_object('id',p.id,'name',p.name,'avatarUrl',p.avatar_url,'direction',p.direction,'goal',p.goal,'skills',coalesce((select jsonb_agg(jsonb_build_object('name',title,'selfReportedLevel',self_reported_level) order by lower(title),id) from public.knowledge_topics where user_id=auth.uid()),'[]')) from public.profiles p where p.id=auth.uid()),
    'studyPreferences',(select jsonb_build_object('dailyStudyMinutes',daily_study_minutes,'studyPeriod',study_period,'learningStyle',learning_style,'taskSize',task_size) from public.study_preferences where user_id=auth.uid()),
    'notifications',(select jsonb_build_object('studyReminders',study_reminders,'weeklyReport',weekly_report,'email',email_enabled,'whatsapp',whatsapp_enabled,'emailSupported',false,'whatsappSupported',false) from public.notification_preferences where user_id=auth.uid()),
    'account',null,'capabilities',jsonb_build_object('profileWrite',true,'preferencesWrite',true,'notificationsWrite',true,'avatarUpload',false,'passwordChange',false,'accountDeletion',false,'accountNameWrite',false))
$$;
create function public.get_home_snapshot() returns jsonb language sql stable security invoker set search_path = '' as $$
  with today as (select public.get_today_snapshot((now() at time zone 'Asia/Kolkata')::date) as value),
  progress as (select public.get_progress_snapshot('7d') as value),
  knowledge as (select public.get_knowledge_snapshot() as value)
  select jsonb_build_object('profile',(select jsonb_build_object('name',name) from public.profiles where id=auth.uid()),
    'today',case when (today.value->>'taskCount')::integer>0 then today.value end,
    'weeklyProgress',case when (progress.value->>'hasHistory')::boolean then progress.value->'summary' end,
    'knowledgeRadar',case when (knowledge.value->'summary'->>'totalTopics')::integer>0 then knowledge.value->'summary' end,
    'currentRoadmap',public.get_roadmap_snapshot(), 'athenaSuggestion',null,
    'studyActivity',case when jsonb_array_length(progress.value->'recentSessions')>0 then progress.value->'weeklyActivity' end)
  from today,progress,knowledge
$$;
create function public.get_athena_snapshot(p_conversation_id uuid default null) returns jsonb language sql stable security invoker set search_path = '' as $$
  with conversation as (select * from public.athena_conversations where user_id=auth.uid() and (p_conversation_id is null or id=p_conversation_id) order by updated_at desc,id limit 1)
  select jsonb_build_object('conversation',(select jsonb_build_object('id',id,'title',title) from conversation),
    'messages',coalesce((select jsonb_agg(jsonb_build_object('id',id,'role',role,'content',content,'status',status,'createdAt',created_at) order by created_at,id)
      from (select m.* from public.athena_messages m join conversation c on c.id=m.conversation_id order by m.created_at desc,m.id desc limit 100) recent),'[]'))
$$;
-- SECURITY DEFINER is limited to task/session writes because the browser must not
-- supply elapsed time, completion timestamps, or another user's task identity.
create function public.set_task_status(p_task_id uuid,p_status text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare task public.daily_tasks;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_status not in ('planned','in_progress','completed','missed') or p_status is null then raise exception 'Invalid task status' using errcode='22023'; end if;
  select * into task from public.daily_tasks where id=p_task_id and user_id=auth.uid() for update;
  if not found then raise exception 'Task not found' using errcode='P0002'; end if;
  if p_status in ('completed','planned','missed') then
    update public.study_sessions set ended_at=clock_timestamp(),status=case when p_status='completed' then 'completed' else 'cancelled' end where task_id=p_task_id and user_id=auth.uid() and status='active';
  end if;
  update public.daily_tasks set status=p_status,completed_at=case when p_status='completed' then coalesce(completed_at,clock_timestamp()) else null end,
    actual_minutes=(select sum(duration_minutes) from public.study_sessions where task_id=p_task_id and user_id=auth.uid() and status='completed') where id=p_task_id and user_id=auth.uid() returning * into task;
  return jsonb_build_object('id',task.id,'status',task.status);
end $$;
create function public.start_focus_session(p_task_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare task public.daily_tasks; session public.study_sessions;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into task from public.daily_tasks where id=p_task_id and user_id=auth.uid() for update;
  if not found or task.status='completed' then raise exception 'Task unavailable' using errcode='42501'; end if;
  insert into public.study_sessions(user_id,task_id,topic_id) values(auth.uid(),task.id,task.topic_id) returning * into session;
  update public.daily_tasks set status='in_progress' where id=task.id and user_id=auth.uid();
  return jsonb_build_object('id',session.id,'taskId',session.task_id,'startedAt',session.started_at);
end $$;
-- Functions are not executable by PUBLIC (PostgreSQL's default).
revoke execute on function public.get_home_snapshot(), public.get_roadmap_snapshot(),public.get_today_snapshot(date),public.get_knowledge_snapshot(),public.get_progress_snapshot(text),public.get_settings_snapshot(),public.get_athena_snapshot(uuid),public.set_task_status(uuid,text),public.start_focus_session(uuid) from public,anon;
grant execute on function public.get_home_snapshot(), public.get_roadmap_snapshot(),public.get_today_snapshot(date),public.get_knowledge_snapshot(),public.get_progress_snapshot(text),public.get_settings_snapshot(),public.get_athena_snapshot(uuid),public.set_task_status(uuid,text),public.start_focus_session(uuid) to authenticated;
