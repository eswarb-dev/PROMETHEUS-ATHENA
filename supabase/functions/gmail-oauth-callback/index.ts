import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { createCallbackHandler } from '../_shared/gmail/handlers.ts'
import { gmailStore } from '../_shared/gmail/store.ts'
const get=(name:string)=>Deno.env.get(name)
Deno.serve(createCallbackHandler({get,store:()=>gmailStore(createClient(get('SUPABASE_URL')!,get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}}))}))
