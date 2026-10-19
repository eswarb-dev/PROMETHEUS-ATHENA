import { GMAIL_API } from './constants.ts'
import { GmailError } from './errors.ts'
import { readJson } from './http.ts'
import { requireSystemMailbox } from './oauth.ts'
import type { GmailMessage } from './types.ts'
export function gmailReadClient(accessToken:string,fetcher:typeof fetch=fetch){
  const get=async(path:string,maxBytes=65536)=>{
    let response:Response
    try{response=await fetcher(GMAIL_API+path,{method:'GET',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${accessToken}`}})}catch{throw new GmailError('GMAIL_UNAVAILABLE')}
    if(!response.ok){await response.body?.cancel();throw new GmailError(response.status===401||response.status===403?'GMAIL_REAUTHORIZE':'GMAIL_UNAVAILABLE')}
    return readJson(response,maxBytes)
  }
  return {
    async profile(){const profile=await get('profile');return {mailbox:requireSystemMailbox(profile.emailAddress)}},
    async message(id:string):Promise<GmailMessage>{
      if(!/^[A-Za-z0-9_-]{1,128}$/.test(id))throw new GmailError('GMAIL_MESSAGE')
      // Guard every future message read against a wrong-account token.
      await this.profile()
      return await get(`messages/${encodeURIComponent(id)}?format=full`,2*1024*1024) as unknown as GmailMessage
    },
  }
}
