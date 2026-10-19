import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { normalizeDirections, toggleDirection } from '../src/domain/learningDirections.js'
import { normalizeOnboarding } from '../src/domain/studyPreferences.js'
import { clearAuthUrlErrors } from '../src/auth/authUrlCleanup.js'
import { confirmationUrl, recoveryUrl } from '../src/auth/authConfig.js'

const choices = [{ name: 'Python systems', source: 'custom', isPrimary: false }, { name: 'Research / Higher Studies', source: 'preset', isPrimary: true }]
const payload = { account: { name: 'Owner', email: 'owner@example.invalid' }, goal: { description: 'Learn fundamentals' }, directions: choices, startingFromScratch: false, skills: [{ name: 'Python', selfReportedLevel: 'comfortable', verifiedLevel: 'ignored' }], studyPreferences: { dailyStudyMinutes: 30, studyPeriod: 'evening', learningStyle: 'balanced', taskSize: 'focused' }, notifications: { studyReminders: false, weeklyReport: false } }

test('direction payload preserves explicit primary, limits selections and rejects scratch/skills conflict', () => {
  const clean=normalizeOnboarding(payload)
  assert.equal(clean.goal.direction,choices[1].name)
  assert.equal(clean.directions[0].isPrimary,false)
  assert.equal('verifiedLevel' in clean.skills[0],false)
  assert.throws(()=>normalizeDirections([]))
  assert.throws(()=>normalizeDirections([...choices,...choices]))
  assert.throws(()=>normalizeDirections(choices.map(item=>({...item,isPrimary:false}))))
  assert.throws(()=>normalizeDirections([{name:' Python  systems ',source:'custom',isPrimary:true},{name:'python systems',source:'custom',isPrimary:false}]))
  assert.throws(()=>normalizeOnboarding({...payload,startingFromScratch:true}))
  assert.deepEqual(normalizeOnboarding({...payload,startingFromScratch:true,skills:[]}).skills,[])
  assert.equal(toggleDirection(choices,choices[1].name).filter(item=>item.isPrimary).length,0)
})

test('successful Auth removes stale errors from search and fragment while retaining application state', () => {
  let replacement
  clearAuthUrlErrors({href:'https://athena.example.invalid/?auth=verify&keep=1&error=access_denied#error_code=otp_expired&error_description=expired'},{replaceState:(_state,_title,url)=>{replacement=url}})
  assert.equal(replacement,'/?auth=verify&keep=1')
  replacement=null
  clearAuthUrlErrors({href:'https://athena.example.invalid/?auth=reset'},{replaceState:()=>{replacement='changed'}})
  assert.equal(replacement,null)
  assert.equal(confirmationUrl('https://athena.example.invalid'),'https://athena.example.invalid/')
  assert.equal(recoveryUrl('https://athena.example.invalid'),'https://athena.example.invalid/?auth=reset')
})

test('learning directions migrate legacy values, enforce primary/ownership and extend snapshots atomically', async () => {
  const db=new PGlite()
  const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002'
  const call=async(name,arg)=> (await db.query(`select public.${name}($1::jsonb) as value`,[JSON.stringify(arg)])).rows[0].value
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
      create table auth.users(id uuid primary key,raw_user_meta_data jsonb,email text,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`)
    const directory=new URL('../supabase/migrations/',import.meta.url)
    const files=(await readdir(directory)).sort()
    const directionIndex=files.findIndex(file=>file.includes('learning_directions'))
    for (const file of files.slice(0,directionIndex)) await db.exec(await readFile(new URL(file,directory),'utf8'))
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now()),($3,$4,now())',[a,'owner@example.invalid',b,'second@example.invalid'])
    await db.query('update public.profiles set direction=$1 where id=$2',['Legacy subject',a])
    for (const file of files.slice(directionIndex)) await db.exec(await readFile(new URL(file,directory),'utf8'))
    assert.equal((await db.query('select name,is_primary from public.user_learning_directions')).rows[0].name,'Legacy subject')
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${a}',false)`)
    assert.equal((await call('complete_onboarding',payload)).completed,true)
    let snapshot=(await db.query('select public.get_settings_snapshot() as value')).rows[0].value
    assert.equal(snapshot.profile.directions.length,2)
    assert.equal(snapshot.profile.direction,choices[1].name)
    assert.equal(snapshot.profile.directions[1].isPrimary,true)
    await db.query('insert into public.roadmaps(user_id,title) values($1,$2)',[a,'Owner roadmap'])
    const roadmap=(await db.query('select public.get_roadmap_snapshot() as value')).rows[0].value
    assert.equal(roadmap.learningProfile.primaryDirection,choices[1].name)
    assert.equal(roadmap.learningProfile.directions.length,2)
    for (const directions of [[],choices.map(item=>({...item,isPrimary:false})),[...choices,...choices],choices.map(item=>({...item,isPrimary:true}))]) await assert.rejects(call('complete_onboarding',{...payload,directions}))
    await assert.rejects(call('complete_onboarding',{...payload,startingFromScratch:true}))
    snapshot=(await db.query('select public.get_settings_snapshot() as value')).rows[0].value
    assert.equal(snapshot.profile.directions.length,2)
    await assert.rejects(db.exec("update public.profiles set direction='Forged'"),{code:'42501'})
    await assert.rejects(db.exec('delete from public.user_learning_directions'),{code:'42501'})
    await assert.rejects(db.exec('select public.complete_onboarding_base(null)'),{code:'42501'})
    const reordered=[{...choices[0],isPrimary:true},{...choices[1],isPrimary:false}]
    assert.equal((await call('update_learning_profile',{directions:reordered})).saved,true)
    snapshot=(await db.query('select public.get_settings_snapshot() as value')).rows[0].value
    assert.equal(snapshot.profile.direction,choices[0].name)
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false)`)
    assert.equal((await db.query('select count(*)::int as count from public.user_learning_directions')).rows[0].count,0)
    await assert.rejects(call('update_learning_profile',{user_id:a,directions:choices}),{code:'22023'})
    await db.exec('set role anon')
    await assert.rejects(db.exec('select public.get_learning_directions()'),{code:'42501'})
    await db.exec(`reset role; begin; update public.user_learning_directions set is_primary=false where user_id='${a}'`)
    await assert.rejects(db.exec('commit'),{code:'23514'})
  } finally { await db.close() }
})
