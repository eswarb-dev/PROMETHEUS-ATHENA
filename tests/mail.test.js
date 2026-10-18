import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { readFile, readdir } from 'node:fs/promises'

test('welcome queue is verified, atomic, private and bounded; accepted/unknown delivery cannot be reclaimed', async () => {
  const db = new PGlite()
  const owner = '10000000-0000-4000-8000-000000000001'
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
      create table auth.users(id uuid primary key,raw_user_meta_data jsonb,email text,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`)
    const directory = new URL('../supabase/migrations/',import.meta.url)
    for (const file of (await readdir(directory)).sort()) await db.exec(await readFile(new URL(file,directory),'utf8'))
    await db.query('insert into auth.users(id,email) values($1,$2)',[owner,'owner@example.invalid'])
    await db.query('update public.profiles set onboarding_completed=true where id=$1',[owner])
    assert.equal((await db.query('select count(*)::int as count from public.transactional_mail_log')).rows[0].count,0)
    await db.query('update public.profiles set onboarding_completed=false where id=$1',[owner])
    await db.query('update auth.users set email_confirmed_at=now() where id=$1',[owner])
    await db.exec('begin')
    await db.query('update public.profiles set onboarding_completed=true where id=$1',[owner])
    await db.exec('rollback')
    assert.equal((await db.query('select count(*)::int as count from public.transactional_mail_log')).rows[0].count,0)
    await db.query('update public.profiles set onboarding_completed=true where id=$1',[owner])
    await db.query('update public.profiles set onboarding_completed=true where id=$1',[owner])
    assert.equal((await db.query('select count(*)::int as count from public.transactional_mail_log')).rows[0].count,1)
    await db.exec('set role authenticated')
    await assert.rejects(db.query('select public.claim_welcome_mail($1)',[owner]),{ code: '42501' })
    await assert.rejects(db.query('select * from public.transactional_mail_log'),{ code: '42501' })
    await db.exec('set role service_role')
    const claim = async () => (await db.query('select public.claim_welcome_mail($1) as value',[owner])).rows[0].value
    let item = await claim()
    assert.equal(item.email,'owner@example.invalid')
    assert.equal(await claim(),null)
    const finish = (item,status) => db.query('select public.finish_welcome_mail($1,$2,$3,$4,$5) as value',[item.id,item.claimToken,status,status === 'retry_wait' ? 'MAIL_CONNECTION' : null,null])
    assert.equal((await finish({ ...item,claimToken: '20000000-0000-4000-8000-000000000001' },'sent')).rows[0].value,false)
    await finish(item,'retry_wait')
    assert.equal(await claim(),null)
    for (let attempt=2;attempt<=3;attempt++) {
      await db.exec('reset role; update public.transactional_mail_log set next_attempt_at=now(); set role service_role')
      item=await claim()
      await finish(item,'retry_wait')
    }
    assert.equal(await claim(),null)
    await db.exec('reset role')
    assert.equal((await db.query('select status from public.transactional_mail_log')).rows[0].status,'failed')
    await db.exec("update public.transactional_mail_log set status='queued',attempt_count=0,next_attempt_at=now(); set role service_role")
    item=await claim()
    await finish(item,'unknown_delivery')
    assert.equal(await claim(),null)
    await db.exec("reset role; update public.transactional_mail_log set status='queued',attempt_count=0,next_attempt_at=now(); set role service_role")
    item=await claim()
    await finish(item,'sent')
    assert.equal(await claim(),null)
    await db.exec('reset role')
    const columns=(await db.query("select column_name from information_schema.columns where table_name='transactional_mail_log'")).rows.map(x=>x.column_name)
    assert.ok(!columns.some(name=>/email$|body|password|otp/.test(name)))
  } finally { await db.close() }
})
