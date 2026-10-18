import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { readFile, readdir } from 'node:fs/promises'

test('verified onboarding is atomic, idempotent, owner-scoped and never establishes diagnostic verification', async () => {
  const db = new PGlite()
  const a = '10000000-0000-4000-8000-000000000001', b = '10000000-0000-4000-8000-000000000002'
  const value = async sql => Object.values((await db.query(sql)).rows[0])[0]
  const payload = { account: { name: 'Verified Owner', email: 'owner@example.invalid' }, goal: { direction: 'Research', description: 'Learn the fundamentals' }, skills: [{ name: 'Test skill', selfReportedLevel: 'beginner', verifiedLevel: 'ignored' }], studyPreferences: { dailyStudyMinutes: 30, studyPeriod: 'evening', learningStyle: 'balanced', taskSize: 'focused' }, notifications: { email: false, whatsapp: false } }
  const complete = data => db.query('select public.complete_onboarding($1::jsonb) as value', [JSON.stringify(data)])
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb,email text,email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth,public to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`)
    const directory = new URL('../supabase/migrations/', import.meta.url)
    for (const file of (await readdir(directory)).sort()) await db.exec(await readFile(new URL(file,directory),'utf8'))
    await db.exec(`insert into auth.users(id,email,raw_user_meta_data) values('${a}','owner@example.invalid','{"name":"Verified Owner","onboarding_completed":true}'),('${b}','second@example.invalid','{"name":"Second Owner"}'); set role authenticated; select set_config('request.jwt.claim.sub','${a}',false);`)
    assert.equal((await value('select public.get_auth_profile()')).onboardingCompleted, false)
    await value('select public.get_auth_profile()')
    assert.equal(await value('select count(*) from public.profiles'), 1)
    await assert.rejects(complete(payload), error => error.code === '42501')
    await assert.rejects(db.exec('update public.profiles set onboarding_completed=true'), error => error.code === '42501')
    await db.exec(`reset role; update auth.users set email_confirmed_at=now() where id='${a}'; set role authenticated`)
    await assert.rejects(complete({ ...payload, skills: [{ name: 'Bad', selfReportedLevel: 'expert' }] }), error => error.code === '22023')
    assert.equal(await value('select count(*) from public.study_preferences'), 0)
    assert.equal((await value('select public.get_auth_profile()')).onboardingCompleted, false)
    assert.equal((await complete(payload)).rows[0].value.completed, true)
    await complete(payload)
    assert.equal((await value('select public.get_auth_profile()')).onboardingCompleted, true)
    for (const table of ['study_preferences','notification_preferences','knowledge_topics']) assert.equal(await value(`select count(*) from public.${table}`), 1)
    assert.equal(await value('select verified_level from public.knowledge_topics'), null)
    assert.equal(await value('select verification_status from public.knowledge_topics'), 'untested')
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false)`)
    assert.equal((await value('select public.get_auth_profile()')).onboardingCompleted, false)
    assert.equal(await value('select count(*) from public.knowledge_topics'), 0)
    await assert.rejects(complete(payload), error => error.code === '42501')
    await db.exec("set role anon; select set_config('request.jwt.claim.sub','',false)")
    await assert.rejects(db.exec('select public.get_auth_profile()'), error => error.code === '42501')
    await assert.rejects(complete(payload), error => error.code === '42501')
  } finally { await db.close() }
})
