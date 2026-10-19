import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { readFile,readdir } from 'node:fs/promises'
import { validPhone, reminderHelp, maskPhone } from '../src/domain/reminderPreferences.js'
import { normalizeOnboarding } from '../src/domain/studyPreferences.js'

const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002'
const payload=(minutes,style,size,notifications)=>({account:{name:'Fixture Owner',email:'owner@example.invalid'},directions:[{name:'Research',source:'custom',isPrimary:true}],goal:{description:'Learn the fundamentals'},skills:[{name:'Docker',selfReportedLevel:'beginner'}],studyPreferences:{dailyStudyMinutes:minutes,studyPeriod:'morning',learningStyle:style,taskSize:size},notifications})
async function setup(){
 const db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to authenticated,anon,service_role;`)
 const dir=new URL('../supabase/migrations/',import.meta.url)
 for(const file of (await readdir(dir)).sort())await db.exec(await readFile(new URL(file,dir),'utf8'))
 await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now()),($3,$4,now())',[a,'owner-a@example.invalid',b,'owner-b@example.invalid'])
 return db
}
const asUser=async(db,id)=>db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`)
const rpc=async(db,name,body)=>(await db.query(`select public.${name}($1::jsonb) value`,[JSON.stringify(body)])).rows[0].value
const scalar=async(db,sql)=>Object.values((await db.query(sql)).rows[0])[0]

test('reminder validation and disclosure preserve explicit choice and mask private phone',()=>{
 assert.equal(validPhone('+15555550123'),true)
 assert.equal(validPhone('5555550123'),false)
 assert.equal(maskPhone('+15555550123').includes('555555'),false)
 assert.ok(reminderHelp('both',{emailReminderDelivery:true}).includes('after provider setup'))
 assert.throws(()=>normalizeOnboarding(payload(30,'build_first','quick',{email:true,whatsapp:true,whatsappNumber:'123'})))
 const normalized=normalizeOnboarding(payload(30,'build_first','quick',{email:false,whatsapp:false}))
 assert.equal(normalized.notifications.reminderChannel,'none')
 assert.equal(normalized.skills[0].normalizedName,'docker')
})

test('server context personalizes task generation, pacing and mentor strategy without exposing phones',async()=>{
 const db=await setup()
 try{
  await asUser(db,a);await rpc(db,'complete_onboarding',payload(30,'build_first','quick',{email:true,whatsapp:true,whatsappNumber:'+15555550123'}))
  const ca=await scalar(db,'select public.get_user_learning_context()')
  assert.equal(ca.plannerPolicy.maximumTaskMinutes,25);assert.equal(ca.plannerPolicy.dailyBudgetMinutes,30);assert.equal(ca.mentorPolicy.teachingStrategy,'implementation_first');assert.equal(ca.plannerPolicy.suggestionLimit,1)
  assert.ok(!JSON.stringify(ca).includes('+15555550123'));assert.ok(!JSON.stringify(ca).includes('whatsappNumber'))
  await asUser(db,b);await rpc(db,'complete_onboarding',payload(90,'theory_first','deep',{email:false,whatsapp:false}))
  const cb=await scalar(db,'select public.get_user_learning_context()')
  assert.equal(cb.plannerPolicy.maximumTaskMinutes,90);assert.equal(cb.mentorPolicy.teachingStrategy,'concept_first');assert.equal(cb.plannerPolicy.suggestionLimit,3)
  assert.equal((await scalar(db,'select public.get_settings_snapshot()')).notifications.reminderChannel,'none')
  await db.exec('reset role')
  for(const owner of [a,b]){
   const road=(await db.query('insert into public.roadmaps(user_id,title) values($1,$2) returning id',[owner,'Fixture roadmap'])).rows[0].id
   const section=(await db.query('insert into public.roadmap_sections(roadmap_id,title) values($1,$2) returning id',[road,'Section'])).rows[0].id
   for(let order=0;order<3;order++)await db.query('insert into public.roadmap_topics(roadmap_id,section_id,title,sort_order,estimated_minutes) values($1,$2,$3,$4,120)',[road,section,'Topic '+order,order])
  }
  await asUser(db,a)
  assert.equal((await scalar(db,'select public.plan_today_from_roadmap()')).created,1)
  assert.equal(await scalar(db,'select sum(estimated_minutes)::int from public.daily_tasks'),25)
  assert.equal((await scalar(db,'select public.plan_today_from_roadmap()')).created,0)
  assert.equal((await scalar(db,'select public.get_roadmap_snapshot()')).pacing.dailyStudyMinutes,30)
  await db.exec("update public.study_preferences set daily_study_minutes=15,learning_style='practice_heavy'")
  const changed=await scalar(db,'select public.get_user_learning_context()')
  assert.equal(changed.mentorPolicy.teachingStrategy,'exercise_and_checkpoint')
  assert.equal((await scalar(db,'select public.get_today_snapshot()')).tasks[0].optional,true)
  await asUser(db,b)
  assert.equal((await scalar(db,'select public.plan_today_from_roadmap()')).created,1)
  assert.equal(await scalar(db,'select sum(estimated_minutes)::int from public.daily_tasks'),90)
  assert.ok((await scalar(db,'select description from public.daily_tasks limit 1')).includes('core concepts'))
  await asUser(db,a)
  await assert.rejects(rpc(db,'save_notification_preferences',{reminderChannel:'whatsapp',whatsappNumber:'123'}),{code:'22023'})
  await assert.rejects(rpc(db,'save_notification_preferences',{whatsappVerified:true}),{code:'22023'})
  await assert.rejects(rpc(db,'save_notification_preferences',{timezone:'Not/AZone'}),{code:'22023'})
  await assert.rejects(db.exec('update public.notification_preferences set whatsapp_verified=true'),{code:'42501'})
  await rpc(db,'save_notification_preferences',{reminderChannel:'both',whatsappNumber:'+15555550124',timezone:'America/New_York'})
  const settings=await scalar(db,'select public.get_settings_snapshot()')
  assert.equal(settings.notifications.whatsappVerified,false)
  await rpc(db,'complete_onboarding',payload(30,'build_first','quick',{email:true,whatsapp:true,reminderChannel:'both',whatsappNumber:'+15555550123'}))
  assert.equal((await scalar(db,'select public.get_settings_snapshot()')).notifications.whatsappNumber,'+15555550124')
  assert.equal((await scalar(db,'select public.get_today_snapshot()')).timezone,'America/New_York')
 }finally{await db.close()}
})

test('reminder fan-out is owner-scoped, gated, deduplicated and independently logged with bounded retries',async()=>{
 const db=await setup()
 try{
  await asUser(db,a);await rpc(db,'complete_onboarding',payload(30,'build_first','quick',{email:true,whatsapp:true,whatsappNumber:'+15555550123'}))
  await db.exec('reset role;update public.reminder_runtime set email_delivery=true,scheduler_enabled=true;set role service_role')
  assert.equal((await db.query('select public.queue_reminder_test($1) value',[a])).rows[0].value.queued,true)
  assert.equal((await db.query('select public.queue_reminder_test($1) value',[a])).rows[0].value.queued,false)
  await db.exec('reset role')
  let rows=(await db.query('select channel,status from public.reminder_deliveries order by channel')).rows
  assert.deepEqual(rows,[{channel:'email',status:'queued'},{channel:'whatsapp',status:'blocked'}])
  await asUser(db,b)
  assert.equal(await scalar(db,'select count(*)::int from public.reminder_jobs'),0)
  assert.equal(await scalar(db,'select count(*)::int from public.reminder_deliveries'),0)
  await assert.rejects(db.query('select public.claim_reminder_deliveries($1,20)',[a]),{code:'42501'})
  await assert.rejects(db.exec('select * from public.reminder_runtime'),{code:'42501'})
  await db.exec('set role service_role')
  const claim=async()=> (await db.query('select public.claim_reminder_deliveries($1,20) value',[a])).rows.map(row=>row.value)
  let items=await claim();assert.equal(items.length,1);assert.equal(items[0].recipientEmail,'owner-a@example.invalid');assert.equal((await claim()).length,0)
  const finish=async(item,status,code=null)=>(await db.query('select public.finish_reminder_delivery($1,$2,$3,$4,$5) value',[item.id,item.claimToken,status,code,null])).rows[0].value
  assert.equal(await finish({...items[0],claimToken:b},'sent'),false)
  await finish(items[0],'retry_wait','MAIL_CONNECTION');assert.equal((await claim()).length,0)
  for(let attempt=2;attempt<=3;attempt++){
   await db.exec('reset role;update public.reminder_deliveries set next_attempt_at=now();set role service_role')
   items=await claim();assert.equal(items.length,1);await finish(items[0],'retry_wait','MAIL_CONNECTION')
  }
  assert.equal((await claim()).length,0)
  await db.exec('reset role')
  assert.equal(await scalar(db,"select status from public.reminder_deliveries where channel='email'"),'failed')
  await asUser(db,a);await rpc(db,'save_notification_preferences',{reminderChannel:'email',studyReminders:false})
  await db.exec('reset role')
  assert.equal(await scalar(db,`select public.enqueue_reminder('${a}','study_task_due','none-test','fixture',now()) is null`),true)
  await asUser(db,a);await rpc(db,'save_notification_preferences',{reminderChannel:'both',whatsappNumber:'+15555550123',studyReminders:true})
  await db.exec("reset role;update public.notification_preferences set whatsapp_verified=true;update public.reminder_runtime set whatsapp_delivery=true")
  await scalar(db,`select public.enqueue_reminder('${a}','study_task_due','fan-out-test','fixture',now())`)
  await db.exec('set role service_role')
  items=await claim();assert.equal(items.length,2)
  for(const item of items)await finish(item,item.channel==='email'?'failed':'sent',item.channel==='email'?'MAIL_PROVIDER':null)
  await db.exec('reset role')
  rows=(await db.query("select channel,status from public.reminder_deliveries where reminder_job_id=(select id from public.reminder_jobs where window_key='fan-out-test') order by channel")).rows
  assert.deepEqual(rows,[{channel:'email',status:'failed'},{channel:'whatsapp',status:'sent'}])
  await scalar(db,`select public.enqueue_reminder('${a}','study_task_due','cancel-test','fixture',now())`)
  await asUser(db,a);await rpc(db,'save_notification_preferences',{reminderChannel:'none',studyReminders:false})
  assert.equal(await scalar(db,"select count(*)::int from public.reminder_deliveries where status='queued'"),0)
  const logColumns=(await db.query("select column_name from information_schema.columns where table_name='reminder_deliveries'")).rows.map(row=>row.column_name)
  assert.ok(!logColumns.some(name=>/phone|email|body|password|otp/.test(name)))
 }finally{await db.close()}
})

test('scheduler uses stored timezone and consent, with repeat runs producing no duplicate jobs',async()=>{
 const db=await setup()
 try{
  await asUser(db,a);await rpc(db,'complete_onboarding',payload(30,'build_first','quick',{email:true,whatsapp:false,timezone:'America/New_York'}))
  await db.exec(`reset role;update public.reminder_runtime set email_delivery=true,scheduler_enabled=true;insert into public.daily_tasks(user_id,title,estimated_minutes,scheduled_for) values('${a}','Timezone fixture',20,date '2026-10-19');set role service_role`)
  const at=async time=>(await db.query('select public.schedule_due_reminders($1::timestamptz) value',[time])).rows[0].value
  assert.equal((await at('2026-10-19T09:02:00Z')).queued,0)
  assert.equal((await at('2026-10-19T13:02:00Z')).queued,1)
  assert.equal((await at('2026-10-19T13:03:00Z')).queued,0)
 }finally{await db.close()}
})
