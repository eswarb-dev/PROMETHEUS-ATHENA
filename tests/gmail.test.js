import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile,readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
const scope='https://www.googleapis.com/auth/gmail.readonly',mailbox='prometheus.inference@gmail.com'
async function fixture(){
 const db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to authenticated,anon,service_role;
   create schema vault;create table vault.secrets(id uuid primary key default gen_random_uuid(),secret text,name text unique,description text);
   create view vault.decrypted_secrets as select id,secret as decrypted_secret,name from vault.secrets;
   create function vault.create_secret(new_secret text,new_name text,new_description text) returns uuid language sql as $$ insert into vault.secrets(secret,name,description) values(new_secret,new_name,new_description) returning id $$;
   create function vault.update_secret(secret_id uuid,new_secret text) returns void language sql as $$ update vault.secrets set secret=new_secret where id=secret_id $$;`)
 // This disposable Vault substitute receives fixture strings only, never real tokens.
 const dir=new URL('../supabase/migrations/',import.meta.url)
 for(const name of (await readdir(dir)).sort())await db.exec(await readFile(new URL(name,dir),'utf8'))
 return db
}
const value=async(db,sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0]
test('Gmail state is private, expires, is single-use and keeps PKCE only in Vault',async()=>{
 const db=await fixture()
 try{
  const hash='a'.repeat(64),verifier='fixture-verifier-'.repeat(3)
  await db.exec('set role service_role')
  assert.equal(await value(db,'select public.gmail_create_oauth_state($1,$2)',[hash,verifier]),true)
  await db.exec('reset role')
  assert.ok(!JSON.stringify((await db.query('select * from public.gmail_oauth_states')).rows).includes(verifier))
  assert.equal(await value(db,'select count(*)::int from vault.secrets'),1)
  for(const role of ['anon','authenticated']){
   await db.exec(`set role ${role}`)
   for(const table of ['gmail_oauth_states','mailbox_connections','mail_threads','mail_messages'])await assert.rejects(db.exec(`select * from public.${table}`),{code:'42501'})
   await assert.rejects(db.query('select public.gmail_consume_oauth_state($1)',[hash]),{code:'42501'})
  }
  await db.exec('set role service_role')
  assert.equal(await value(db,'select public.gmail_consume_oauth_state($1)',[hash]),verifier)
  assert.equal(await value(db,'select public.gmail_consume_oauth_state($1)',[hash]),null)
  const expired='b'.repeat(64)
  await value(db,'select public.gmail_create_oauth_state($1,$2)',[expired,verifier])
  await db.exec("reset role;update public.gmail_oauth_states set expires_at=now()-interval '1 second';set role service_role")
  assert.equal(await value(db,'select public.gmail_consume_oauth_state($1)',[expired]),null)
  await value(db,'select public.gmail_create_oauth_state($1,$2)',['c'.repeat(64),verifier])
  await db.exec('reset role')
  assert.equal(await value(db,'select count(*)::int from vault.secrets'),1)
 }finally{await db.close()}
})
test('Gmail tokens remain in Vault and only the fixed mailbox and readonly scope connect',async()=>{
 const db=await fixture()
 try{
  const token='fixture-refresh-credential-only'
  await db.exec('set role service_role')
  await assert.rejects(db.query('select public.gmail_save_connection($1,$2,$3)',['other@example.invalid',[scope],token]),{code:'22023'})
  await assert.rejects(db.query('select public.gmail_save_connection($1,$2,$3)',[mailbox,['other-scope'],token]),{code:'22023'})
  assert.equal(await value(db,'select public.gmail_save_connection($1,$2,$3)',[mailbox,[scope],null]),false)
  assert.equal(await value(db,'select public.gmail_save_connection($1,$2,$3)',[mailbox,[scope],token]),true)
  assert.equal(await value(db,'select public.gmail_read_refresh_token()'),token)
  await db.exec('reset role')
  assert.ok(!JSON.stringify((await db.query('select * from public.mailbox_connections')).rows).includes(token))
  const columns=(await db.query("select column_name from information_schema.columns where table_name in ('mailbox_connections','mail_threads','mail_messages')")).rows.map(item=>item.column_name)
  assert.ok(!columns.some(name=>/access_token|refresh_token|authorization|credential/.test(name)))
  await db.exec('set role authenticated')
  await assert.rejects(db.exec('select public.gmail_read_refresh_token()'),{code:'42501'})
  await db.exec('set role service_role');await value(db,"select public.gmail_record_token_refresh('GMAIL_REAUTHORIZE')")
  assert.equal(await value(db,'select public.gmail_read_refresh_token()'),null)
 }finally{await db.close()}
})
test('inbound persistence deduplicates messages/threads atomically and rejects browser reads and oversized bodies',async()=>{
 const db=await fixture()
 try{
  await db.exec('set role service_role')
  const message={providerMessageId:'fixture-message',providerThreadId:'fixture-thread',direction:'inbound',senderEmail:'sender@example.invalid',senderName:'Fixture Sender',toAddresses:[mailbox],ccAddresses:[],subject:'Fixture subject',textBody:'Fixture content',sanitizedHtmlBody:'<p>Fixture content</p>',snippet:'Fixture',internalDate:'2026-10-19T12:00:00Z',hasAttachments:true}
  const store=async item=>value(db,'select public.gmail_store_message($1::jsonb)',[JSON.stringify(item)])
  await assert.rejects(store(message),{code:'42501'})
  await value(db,'select public.gmail_save_connection($1,$2,$3)',[mailbox,[scope],'fixture-refresh-only'])
  assert.deepEqual(await store(message),{stored:true,duplicate:false})
  assert.deepEqual(await store(message),{stored:false,duplicate:true})
  assert.equal((await store({...message,providerMessageId:'fixture-message-2'})).stored,true)
  await assert.rejects(store({...message,providerMessageId:'oversized-message',textBody:'x'.repeat(65537)}),{code:'23514'})
  await assert.rejects(store({...message,providerThreadId:'different-thread'}),{code:'22023'})
  await db.exec('reset role')
  assert.equal(await value(db,'select count(*)::int from public.mail_messages'),2)
  assert.equal(await value(db,'select count(*)::int from public.mail_threads'),1)
  assert.equal(await value(db,'select message_count from public.mail_threads'),2)
  assert.equal(await value(db,'select watch_expires_at from public.mailbox_connections'),null)
  for(const role of ['anon','authenticated']){
   await db.exec(`set role ${role}`)
   await assert.rejects(db.exec('select * from public.mail_messages'),{code:'42501'})
   await assert.rejects(store(message),{code:'42501'})
  }
 }finally{await db.close()}
})
