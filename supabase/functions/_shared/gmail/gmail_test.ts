import { createStartHandler, createCallbackHandler } from './handlers.ts'
import { createOAuthState, requireReadonlyScope, requireSystemMailbox, authorizationUrl } from './oauth.ts'
import { GMAIL_READONLY, SYSTEM_MAILBOX, OAUTH_CALLBACK, BODY_BYTES } from './constants.ts'
import { normalizeGmailMessage, sanitizeMessageHtml, clipUtf8 } from './mime.ts'
import { gmailReadClient } from './client.ts'
import { refreshedAccessToken } from './token.ts'
import { persistInboundMessage } from './ingest.ts'
import type { GmailStore, GmailMessage, InboundMessage } from './types.ts'
const check=(value:unknown)=>{if(!value)throw Error('Assertion failed')}
const rejected=(fn:()=>unknown)=>{try{fn()}catch{return}throw Error('Expected rejection')}
const config={clientId:'fixture.apps.googleusercontent.com',clientSecret:'fixture-client-only'}
const bootstrap='fixture-bootstrap-identity-'.repeat(3)
class MemoryStore implements GmailStore {
  states=new Map<string,{verifier:string;expires:number}>();now=0;connected=false;saves=0;token:string|null=null;lastError?:string;messages:InboundMessage[]=[]
  async hasRefreshToken(){return !!this.token}
  async createState(hash:string,verifier:string){this.states.set(hash,{verifier,expires:this.now+600000});return true}
  async consumeState(hash:string){const state=this.states.get(hash);this.states.delete(hash);return state&&state.expires>this.now?state.verifier:null}
  async saveConnection(_mailbox:string,_scopes:string[],refreshToken?:string){if(refreshToken)this.token=refreshToken;if(!this.token)return false;this.saves++;this.connected=true;return true}
  async readRefreshToken(){return this.token}
  async recordRefresh(error?:string){this.lastError=error}
  async storeMessage(message:InboundMessage){if(this.messages.some(item=>item.providerMessageId===message.providerMessageId))return {stored:false,duplicate:true};this.messages.push(message);return {stored:true,duplicate:false}}
}
const dependencies=(store:MemoryStore,fetcher?:typeof fetch)=>({get:(name:string)=>({GOOGLE_GMAIL_CLIENT_ID:config.clientId,GOOGLE_GMAIL_CLIENT_SECRET:config.clientSecret,GMAIL_OAUTH_BOOTSTRAP_SECRET:bootstrap})[name as 'GOOGLE_GMAIL_CLIENT_ID'],store:()=>store,fetcher})
const startRequest=()=>new Request('https://fixture.invalid/start',{method:'POST',headers:{'x-athena-gmail-bootstrap':bootstrap}})
async function started(store:MemoryStore){const result=await createStartHandler(dependencies(store))(startRequest());check(result.status===200);return new URL((await result.json()).authorizationUrl)}
const callbackRequest=(url:URL)=>new Request(OAUTH_CALLBACK+'?'+new URLSearchParams({state:url.searchParams.get('state')!,code:'fixture-authorization-code'}))
function googleFixture(mailbox=SYSTEM_MAILBOX,scope=GMAIL_READONLY):typeof fetch{return (async(input,options)=>{
  const url=String(input)
  if(url==='https://oauth2.googleapis.com/token'){check(options?.method==='POST');return Response.json({access_token:'fixture-access-only',refresh_token:'fixture-refresh-only',token_type:'Bearer',expires_in:3600,scope})}
  check(url.endsWith('/users/me/profile'));check(options?.method==='GET');return Response.json({emailAddress:mailbox})
}) as typeof fetch}
Deno.test('OAuth uses unpredictable state, PKCE, fixed callback and only readonly offline scope',async()=>{
  const a=await createOAuthState(),b=await createOAuthState();check(a.state!==b.state&&a.verifier!==b.verifier&&a.state!==a.verifier);check(a.hash.length===64)
  const store=new MemoryStore(),url=await started(store)
  check(url.searchParams.get('scope')===GMAIL_READONLY);check(url.searchParams.get('access_type')==='offline');check(url.searchParams.get('redirect_uri')===OAUTH_CALLBACK)
  check(url.searchParams.get('code_challenge_method')==='S256');check(url.searchParams.get('prompt')==='consent')
  check(!authorizationUrl(config,a.state,a.challenge,false).includes('prompt='))
  check(url.searchParams.get('login_hint')===SYSTEM_MAILBOX)
  const unauthorized=await createStartHandler(dependencies(store))(new Request('https://fixture.invalid/start',{method:'POST'}));check(unauthorized.status===401)
})
Deno.test('callback consumes state once, rejects expiry and never returns credentials',async()=>{
  const store=new MemoryStore(),url=await started(store),callback=createCallbackHandler(dependencies(store,googleFixture()))
  const response=await callback(callbackRequest(url)),body=await response.text();check(response.status===200&&store.saves===1)
  check(!body.includes('fixture-access-only')&&!body.includes('fixture-refresh-only')&&!body.includes(config.clientSecret))
  check(response.headers.get('Cache-Control')==='no-store'&&response.headers.get('Referrer-Policy')==='no-referrer')
  check((await callback(callbackRequest(url))).status===400)
  const expired=await started(store);store.now=600001;check((await callback(callbackRequest(expired))).status===400)
  check((await callback(new Request(OAUTH_CALLBACK+'?code=fixture'))).status===400)
})
Deno.test('wrong account, missing or broader scopes and provider errors fail closed',async()=>{
  rejected(()=>requireSystemMailbox('other@example.invalid'));rejected(()=>requireReadonlyScope(undefined));rejected(()=>requireReadonlyScope(GMAIL_READONLY+' other-scope'))
  for(const [mailbox,scope] of [['other@example.invalid',GMAIL_READONLY],[SYSTEM_MAILBOX,'other-scope']]){
    const store=new MemoryStore(),url=await started(store)
    const result=await createCallbackHandler(dependencies(store,googleFixture(mailbox,scope)))(callbackRequest(url));check(result.status===400&&!store.connected&&!store.token)
  }
  const store=new MemoryStore(),url=await started(store)
  const result=await createCallbackHandler(dependencies(store,(async()=>{throw Error('private-provider-detail')}) as typeof fetch))(callbackRequest(url))
  check(result.status===503&&!(await result.text()).includes('private-provider-detail'))
})
Deno.test('refresh credentials remain server-side and missing client configuration performs no OAuth',async()=>{
  const store=new MemoryStore();store.token='fixture-refresh-only'
  check(await refreshedAccessToken(config,store,googleFixture())==='fixture-access-only')
  const handler=createStartHandler({get:()=>undefined,store:()=>{throw Error('must not open storage')}})
  check((await handler(startRequest())).status===503)
  let calls=0
  const client=gmailReadClient('fixture-access-only',(async()=>{calls++;return Response.json({emailAddress:'other@example.invalid'})}) as typeof fetch)
  try{await client.message('fixture-message');throw Error('not rejected')}catch{check(calls===1)}
})
const encoded=(text:string)=>btoa(Array.from(new TextEncoder().encode(text),byte=>String.fromCharCode(byte)).join('')).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
const message=():GmailMessage=>({id:'fixture-message',threadId:'fixture-thread',internalDate:'1792411200000',labelIds:['INBOX'],payload:{mimeType:'multipart/mixed',headers:[{name:'From',value:'"Fixture Sender" <sender@example.invalid>'},{name:'To',value:SYSTEM_MAILBOX},{name:'Subject',value:'Fixture study question'}],parts:[{mimeType:'text/plain',body:{data:encoded('Fixture plain text')}},{mimeType:'text/html',body:{data:encoded('<p onclick="alert(1)">Safe<strong>text</strong><img src="https://tracker.invalid/x"><script>secretScript()</script><iframe>secretFrame</iframe><form>secretForm</form></p>')}},{mimeType:'application/pdf',filename:'fixture.pdf',body:{attachmentId:'fixture-attachment',data:encoded('attachment bytes must not persist')}}]}})
Deno.test('MIME normalization sanitizes HTML, prefers plain text and stores no attachment bytes',async()=>{
  const normalized=normalizeGmailMessage(message());check(normalized.textBody==='Fixture plain text'&&normalized.hasAttachments)
  check(!/onclick|script|iframe|form|img|tracker|secret/i.test(normalized.sanitizedHtmlBody??''));check(normalized.sanitizedHtmlBody?.includes('<strong>text</strong>'))
  check(!JSON.stringify(normalized).includes('attachment bytes')&&!JSON.stringify(normalized).includes('fixture-attachment'))
  const store=new MemoryStore();check((await persistInboundMessage(message(),store)).stored);check((await persistInboundMessage(message(),store)).duplicate)
  const html=message();html.payload!.parts=html.payload!.parts!.filter(part=>part.mimeType==='text/html');check(normalizeGmailMessage(html).textBody?.includes('Safe'))
  const binary=message();binary.payload!.parts=[{mimeType:'application/octet-stream',body:{data:encoded('fixture nameless binary')}}]
  const binaryResult=normalizeGmailMessage(binary);check(binaryResult.hasAttachments&&!binaryResult.textBody&&!JSON.stringify(binaryResult).includes('fixture nameless binary'))
  rejected(()=>normalizeGmailMessage({...message(),labelIds:['SENT']}))
})
Deno.test('body limits count UTF-8 bytes and discard oversized HTML instead of storing a partial document',()=>{
  const text=message();text.payload!.parts=[{mimeType:'text/plain',body:{data:encoded('a'.repeat(BODY_BYTES*2))}}]
  check(new TextEncoder().encode(normalizeGmailMessage(text).textBody!).length===BODY_BYTES)
  check(new TextEncoder().encode(clipUtf8('🙂'.repeat(20000),BODY_BYTES)).length<=BODY_BYTES)
  check(sanitizeMessageHtml('<p>'+'x'.repeat(BODY_BYTES)+'</p>')===null)
  check(!sanitizeMessageHtml('<svg onload="bad()"><script>bad()</script></svg><p>Good</p>')?.includes('bad'))
})
