import { STATE_TTL_SECONDS } from './constants.ts'
import { GmailError, safeGmailError } from './errors.ts'
import { authorizationUrl, bootstrapAuthorized, createOAuthState, oauthConfig, stateHash } from './oauth.ts'
import { exchangeCode } from './token.ts'
import { gmailReadClient } from './client.ts'
import type { Env, GmailStore } from './types.ts'
type Dependencies={get:Env;store:()=>GmailStore;fetcher?:typeof fetch}
const headers={'Content-Type':'application/json','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'}
const reply=(status:number,data:Record<string,unknown>)=>new Response(JSON.stringify(data),{status,headers})
export function createStartHandler({get,store}:Dependencies){return async(request:Request)=>{
  try{
    if(request.method!=='POST')throw new GmailError('GMAIL_METHOD')
    if(request.headers.has('origin'))throw new GmailError('GMAIL_UNAUTHORIZED')
    if(!await bootstrapAuthorized(request.headers.get('x-athena-gmail-bootstrap'),get('GMAIL_OAUTH_BOOTSTRAP_SECRET')))throw new GmailError('GMAIL_UNAUTHORIZED')
    if(request.body)throw new GmailError('GMAIL_MESSAGE')
    const config=oauthConfig(get),storage=store(),state=await createOAuthState()
    const needsConsent=!await storage.hasRefreshToken()
    if(!await storage.createState(state.hash,state.verifier))throw new GmailError('GMAIL_STATE')
    return reply(200,{authorizationUrl:authorizationUrl(config,state.state,state.challenge,needsConsent),expiresIn:STATE_TTL_SECONDS})
  }catch(error){const {code,status}=safeGmailError(error);return reply(status,{code})}
}}
export function createCallbackHandler({get,store,fetcher=fetch}:Dependencies){return async(request:Request)=>{
  try{
    if(request.method!=='GET')throw new GmailError('GMAIL_METHOD')
    const url=new URL(request.url),state=url.searchParams.get('state')
    if(!state||!/^[A-Za-z0-9_-]{43}$/.test(state)||url.searchParams.getAll('state').length!==1)throw new GmailError('GMAIL_STATE')
    const storage=store(),verifier=await storage.consumeState(await stateHash(state))
    if(!verifier)throw new GmailError('GMAIL_STATE')
    if(url.searchParams.has('error'))throw new GmailError('GMAIL_REAUTHORIZE')
    const code=url.searchParams.get('code')
    if(!code||code.length>4096||url.searchParams.getAll('code').length!==1)throw new GmailError('GMAIL_STATE')
    const tokens=await exchangeCode(oauthConfig(get),code,verifier,fetcher)
    const {mailbox}=await gmailReadClient(tokens.accessToken,fetcher).profile()
    if(!await storage.saveConnection(mailbox,tokens.scopes,tokens.refreshToken))throw new GmailError('GMAIL_REAUTHORIZE')
    return reply(200,{status:'connected',message:'System mailbox authorization stored securely. Mail ingestion is not running.'})
  }catch(error){const {code,status}=safeGmailError(error);return reply(status,{code})}
}}
