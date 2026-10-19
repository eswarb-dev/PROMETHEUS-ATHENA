import { OAUTH_CALLBACK, TOKEN_URL } from './constants.ts'
import { GmailError } from './errors.ts'
import { readJson } from './http.ts'
import { requireReadonlyScope } from './oauth.ts'
import type { OAuthConfig, OAuthTokens, GmailStore } from './types.ts'
async function tokenRequest(config:OAuthConfig,parameters:Record<string,string>,fetcher:typeof fetch):Promise<OAuthTokens>{
  let response:Response
  try{response=await fetcher(TOKEN_URL,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,...parameters})})}catch{throw new GmailError('GMAIL_UNAVAILABLE')}
  if(!response.ok){await response.body?.cancel();throw new GmailError(response.status>=500||response.status===429?'GMAIL_UNAVAILABLE':'GMAIL_REAUTHORIZE')}
  const data=await readJson(response)
  const scopes=requireReadonlyScope(data.scope)
  if(typeof data.access_token!=='string'||!data.access_token||data.access_token.length>8192||data.token_type!=='Bearer'||typeof data.expires_in!=='number'||data.expires_in<=0||data.expires_in>86400)throw new GmailError('GMAIL_REAUTHORIZE')
  if(data.refresh_token!==undefined&&(typeof data.refresh_token!=='string'||!data.refresh_token||data.refresh_token.length>8192))throw new GmailError('GMAIL_REAUTHORIZE')
  return {accessToken:data.access_token,refreshToken:data.refresh_token as string|undefined,expiresIn:data.expires_in,scopes}
}
export function exchangeCode(config:OAuthConfig,code:string,verifier:string,fetcher:typeof fetch=fetch){return tokenRequest(config,{grant_type:'authorization_code',code,code_verifier:verifier,redirect_uri:OAUTH_CALLBACK},fetcher)}
export async function refreshedAccessToken(config:OAuthConfig,store:GmailStore,fetcher:typeof fetch=fetch){
  const refreshToken=await store.readRefreshToken()
  if(!refreshToken)throw new GmailError('GMAIL_REAUTHORIZE')
  try{
    const tokens=await tokenRequest(config,{grant_type:'refresh_token',refresh_token:refreshToken},fetcher)
    if(tokens.refreshToken)await store.saveConnection('prometheus.inference@gmail.com',tokens.scopes,tokens.refreshToken)
    await store.recordRefresh();return tokens.accessToken
  }catch(error){await store.recordRefresh(error instanceof GmailError&&error.code==='GMAIL_REAUTHORIZE'?'GMAIL_REAUTHORIZE':'GMAIL_UNAVAILABLE');throw error}
}
