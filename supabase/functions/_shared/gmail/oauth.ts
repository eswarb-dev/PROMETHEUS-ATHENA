import { AUTHORIZATION_URL, GMAIL_READONLY, OAUTH_CALLBACK, SYSTEM_MAILBOX } from './constants.ts'
import { GmailError } from './errors.ts'
import type { Env, OAuthConfig } from './types.ts'
const base64url=(value:Uint8Array)=>btoa(String.fromCharCode(...value)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
export const randomOAuthValue=()=>base64url(crypto.getRandomValues(new Uint8Array(32)))
export async function stateHash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(byte=>byte.toString(16).padStart(2,'0')).join('')}
export async function createOAuthState(){const state=randomOAuthValue(),verifier=randomOAuthValue();return {state,verifier,hash:await stateHash(state),challenge:base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))}}
export function oauthConfig(get:Env):OAuthConfig {
  const clientId=get('GOOGLE_GMAIL_CLIENT_ID'),clientSecret=get('GOOGLE_GMAIL_CLIENT_SECRET')
  if(!clientId||!clientSecret||!clientId.endsWith('.apps.googleusercontent.com'))throw new GmailError('GMAIL_CONFIG')
  return {clientId,clientSecret}
}
export function authorizationUrl(config:OAuthConfig,state:string,challenge:string,needsConsent:boolean){
  const url=new URL(AUTHORIZATION_URL)
  url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:OAUTH_CALLBACK,response_type:'code',scope:GMAIL_READONLY,access_type:'offline',include_granted_scopes:'false',state,code_challenge:challenge,code_challenge_method:'S256',login_hint:SYSTEM_MAILBOX}).toString()
  if(needsConsent)url.searchParams.set('prompt','consent')
  return url.toString()
}
export function requireReadonlyScope(value:unknown){
  const scopes=typeof value==='string'?value.trim().split(/\s+/):[]
  if(scopes.length!==1||scopes[0]!==GMAIL_READONLY)throw new GmailError('GMAIL_SCOPE')
  return scopes
}
export function requireSystemMailbox(value:unknown){if(value!==SYSTEM_MAILBOX)throw new GmailError('GMAIL_MAILBOX');return SYSTEM_MAILBOX}
export async function bootstrapAuthorized(provided:string|null,expected:string|undefined){
  if(!expected||expected.length<32)throw new GmailError('GMAIL_CONFIG')
  if(!provided||provided.length>512)return false
  const a=await stateHash(provided),b=await stateHash(expected);let difference=0
  for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i)
  return difference===0
}
