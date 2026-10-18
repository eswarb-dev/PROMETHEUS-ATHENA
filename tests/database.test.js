import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('migrations, RLS, ownership, snapshots and server-clock mutations in isolated PostgreSQL', async () => {
  const db = new PGlite()
  const a = '10000000-0000-4000-8000-000000000001'
  const b = '10000000-0000-4000-8000-000000000002'
  const roadmapA = '20000000-0000-4000-8000-000000000001'
  const roadmapB = '20000000-0000-4000-8000-000000000002'
  const sectionA = '30000000-0000-4000-8000-000000000001'
  const sectionB = '30000000-0000-4000-8000-000000000002'
  const topicA = '40000000-0000-4000-8000-000000000001'
  const topicB = '40000000-0000-4000-8000-000000000002'
  const task = '50000000-0000-4000-8000-000000000001'
  const conversation = '60000000-0000-4000-8000-000000000002'
  const scalar = async sql => Object.values((await db.query(sql)).rows[0])[0]
  const denied = async (sql, code = '42501') => assert.rejects(db.exec(sql), error => error.code === code)
  try {
    // Only this disposable database receives synthetic Auth users and fixture rows.
    await db.exec(`create role anon nologin; create role authenticated nologin;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,public to anon,authenticated;
      grant execute on function auth.uid() to anon,authenticated;`)
    const directory = new URL('../supabase/migrations/', import.meta.url)
    for (const file of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, directory), 'utf8'))
    const tables = (await db.query("select tablename,rowsecurity from pg_tables where schemaname='public' order by tablename")).rows
    assert.equal(tables.length, 12)
    assert.ok(tables.every(table => table.rowsecurity))
    await db.exec(`insert into auth.users values ('${a}'),('${b}');
      insert into public.profiles(id,name) values('${a}','Owner A'),('${b}','Owner B');
      insert into public.roadmaps(id,user_id,title) values('${roadmapA}','${a}','A roadmap'),('${roadmapB}','${b}','B roadmap');
      insert into public.roadmap_sections(id,roadmap_id,title) values('${sectionA}','${roadmapA}','A section'),('${sectionB}','${roadmapB}','B section');
      insert into public.roadmap_topics(id,roadmap_id,section_id,title) values('${topicA}','${roadmapA}','${sectionA}','A topic'),('${topicB}','${roadmapB}','${sectionB}','B topic');
      insert into public.daily_tasks(id,user_id,roadmap_id,topic_id,title,scheduled_for) values('${task}','${a}','${roadmapA}','${topicA}','A task',(now() at time zone 'Asia/Kolkata')::date);
      insert into public.knowledge_topics(user_id,title) values('${a}','A skill'),('${b}','B skill');
      insert into public.athena_conversations(id,user_id,title) values('${conversation}','${b}','B history');
      insert into public.athena_messages(conversation_id,role,content) values('${conversation}','assistant','Private B answer');`)
    await db.exec('set role anon')
    for (const table of [...tables.map(row => row.tablename), 'user_skills']) await denied(`select * from public.${table}`)
    for (const call of ['get_home_snapshot()', 'get_roadmap_snapshot()', "get_today_snapshot(current_date)", 'get_knowledge_snapshot()', "get_progress_snapshot('7d')", 'get_settings_snapshot()', 'get_athena_snapshot()']) await denied(`select public.${call}`)
    assert.equal((await scalar('select public.project_keepalive()')).ok, true)
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${a}',false)`)
    assert.equal(await scalar('select count(*) from public.profiles'), 1)
    assert.equal(await scalar('select count(*) from public.roadmap_sections'), 1)
    assert.equal(await scalar('select count(*) from public.roadmap_topics'), 1)
    assert.equal(await scalar('select count(*) from public.athena_messages'), 0)
    assert.equal(await scalar('select count(*) from public.athena_conversations'), 0)
    assert.equal(await scalar('select count(*) from public.user_skills'), 1)
    for (const table of ['profiles','study_preferences','notification_preferences','roadmaps','knowledge_topics','daily_tasks','study_sessions','athena_conversations']) {
      const owner = table === 'profiles' ? 'id' : 'user_id'
      assert.equal(await scalar(`select count(*) from public.${table} where ${owner}='${b}'`), 0)
    }
    assert.equal((await db.query(`update public.profiles set name='Intrusion' where id='${b}' returning id`)).rows.length, 0)
    await denied(`insert into public.roadmap_sections(roadmap_id,title) values('${roadmapB}','Intrusion')`)
    await denied(`insert into public.roadmap_topics(roadmap_id,section_id,title) values('${roadmapA}','${sectionB}','Cross roadmap')`, '23503')
    await denied(`insert into public.topic_prerequisites(topic_id,prerequisite_topic_id,roadmap_id) values('${topicA}','${topicB}','${roadmapA}')`, '23503')
    await denied(`insert into public.topic_prerequisites(topic_id,prerequisite_topic_id,roadmap_id) values('${topicA}','${topicA}','${roadmapA}')`, '23514')
    await denied(`update public.knowledge_topics set verified_level='expert'`)
    await denied(`insert into public.knowledge_topics(user_id,title,verification_status) values('${a}','Forged','verified')`)
    await denied(`insert into public.athena_messages(conversation_id,role,content) values('${conversation}','user','Intrusion')`)
    await denied(`update public.study_sessions set started_at=now()-interval '1 hour'`)
    await denied(`select public.set_task_status('${topicB}','completed')`, 'P0002')
    await db.exec("update public.knowledge_topics set self_reported_level='strong' where title='A skill'")
    const knowledge = await scalar('select public.get_knowledge_snapshot()')
    assert.equal(knowledge.topics[0].selfReportedLevel, 'strong')
    assert.equal(knowledge.topics[0].verifiedLevel, null)
    assert.equal(knowledge.topics[0].verificationStatus, 'untested')
    const roadmap = await scalar('select public.get_roadmap_snapshot()')
    assert.equal(roadmap.roadmap.title, 'A roadmap')
    assert.equal(roadmap.topics.length, 1)
    const today = await scalar("select public.get_today_snapshot((now() at time zone 'Asia/Kolkata')::date)")
    assert.equal(today.tasks.length, 1)
    const session = await scalar(`select public.start_focus_session('${task}')`)
    assert.equal(session.taskId, task)
    await denied(`select public.start_focus_session('${task}')`, '23505')
    assert.equal((await scalar(`select public.set_task_status('${task}','completed')`)).status, 'completed')
    const ended = (await db.query('select * from public.study_sessions')).rows[0]
    assert.equal(ended.status, 'completed')
    assert.ok(Number(ended.duration_minutes) >= 0)
    assert.ok(ended.ended_at)
    for (const range of ['7d','30d','90d']) {
      const progress = await scalar(`select public.get_progress_snapshot('${range}')`)
      assert.equal(progress.summary.completedTasks, 1)
      assert.equal(progress.recentSessions.length, 1)
      assert.equal(progress.range, range)
    }
    await denied("select public.get_progress_snapshot('all')", '22023')
    assert.equal((await scalar('select public.get_home_snapshot()')).today.completedTaskCount, 1)
    assert.equal((await scalar('select public.get_settings_snapshot()')).profile.name, 'Owner A')
    assert.deepEqual((await scalar(`select public.get_athena_snapshot('${conversation}')`)).messages, [])
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false)`)
    assert.equal((await scalar('select public.get_athena_snapshot()')).messages[0].content, 'Private B answer')
    await denied(`select public.start_focus_session('${task}')`)
    await db.exec("select set_config('request.jwt.claim.sub','',false)")
    assert.equal(await scalar('select count(*) from public.profiles'), 0)
    assert.equal((await scalar('select public.get_home_snapshot()')).currentRoadmap, null)
    assert.deepEqual((await scalar('select public.get_athena_snapshot()')).messages, [])
  } finally { await db.close() }
})
