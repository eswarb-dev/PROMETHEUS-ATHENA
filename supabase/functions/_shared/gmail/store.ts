import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'
import { GmailError } from './errors.ts'
import type { GmailStore, InboundMessage } from './types.ts'
export function gmailStore(admin:SupabaseClient):GmailStore {
  const rpc=async(name:string,args:Record<string,unknown>={})=>{const {data,error}=await admin.rpc(name,args);if(error)throw new GmailError('GMAIL_STORAGE');return data}
  return {
    hasRefreshToken:()=>rpc('gmail_has_refresh_token'),
    createState:(hash,verifier)=>rpc('gmail_create_oauth_state',{p_state_hash:hash,p_verifier:verifier}),
    consumeState:hash=>rpc('gmail_consume_oauth_state',{p_state_hash:hash}),
    saveConnection:(mailbox,scopes,refreshToken)=>rpc('gmail_save_connection',{p_mailbox:mailbox,p_scopes:scopes,p_refresh_token:refreshToken??null}),
    readRefreshToken:()=>rpc('gmail_read_refresh_token'),
    async recordRefresh(error){await rpc('gmail_record_token_refresh',{p_error:error??null})},
    storeMessage:(message:InboundMessage)=>rpc('gmail_store_message',{p_message:message}),
  }
}
