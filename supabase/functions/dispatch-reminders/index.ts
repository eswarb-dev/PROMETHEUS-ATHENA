import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { mailConfig, mailFailure } from '../_shared/mail/mailer.ts'
import { createMailTransport } from '../_shared/mail/transport.ts'
import { reminderTemplate, type ReminderKind } from '../_shared/reminders/templates.ts'
import { schedulerAuthorized } from '../_shared/reminders/authorization.ts'

type Delivery = { id: string; claimToken: string; channel: 'email'; kind: ReminderKind; isTest: boolean; recipientEmail: string; dailyStudyMinutes: number }
Deno.serve(async request => {
  const appUrl = Deno.env.get('ATHENA_APP_URL')!
  const origin = request.headers.get('origin')
  const headers: Record<string,string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' }
  const respond = (status: number, payload: unknown) => new Response(JSON.stringify(payload),{status,headers})
  try {
    const allowed = [new URL(appUrl).origin,'http://localhost:5173','http://127.0.0.1:5173']
    if (origin && !allowed.includes(origin)) return respond(403,{status:'forbidden'})
    if (origin) headers['Access-Control-Allow-Origin']=origin
    if (request.method==='OPTIONS') return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST'}})
    if (request.method!=='POST') return respond(405,{status:'method_not_allowed'})
    const scheduler = await schedulerAuthorized(request.headers.get('x-athena-scheduler'),Deno.env.get('ATHENA_REMINDER_SCHEDULER_SECRET'))
    const admin = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}})
    let owner: string|null=null
    if (!scheduler) {
      const bearer=request.headers.get('authorization')
      if (!bearer?.startsWith('Bearer ')) return respond(401,{status:'unauthorized'})
      const {data:{user},error}=await admin.auth.getUser(bearer.slice(7))
      if (error || !user?.email_confirmed_at) return respond(401,{status:'unauthorized'})
      owner=user.id
    }
    const body = await request.text()
    if (body.length>100 || !scheduler && body.trim()!=='{"action":"test"}' || scheduler && body.trim()!=='' && body.trim()!=='{}') return respond(400,{status:'invalid_request'})
    // Validate shared SMTP before claiming: a configuration failure must not consume an attempt.
    mailConfig(key=>Deno.env.get(key))
    reminderTemplate('study_plan_available',30,appUrl)
    const rpc = async(name: string,args: Record<string,unknown>={})=>{const {data,error}=await admin.rpc(name,args);if(error)throw Error('REMINDER_DATABASE');return data}
    if (scheduler) await rpc('schedule_due_reminders')
    else await rpc('queue_reminder_test',{p_user_id:owner})
    const claims = await rpc('claim_reminder_deliveries',{p_user_id:owner,p_limit:3}) as Delivery[]
    const transport = createMailTransport(key=>Deno.env.get(key))
    const deliveries: Array<{channel:string;status:string}>=[]
    try {
      for (const claim of claims) {
        let result: {status:string;code?:string;messageId?:string}
        if (claim.channel!=='email') throw Error('UNSUPPORTED_DELIVERY')
        try { const sent=await transport.sendTransactionalMail(claim.recipientEmail,reminderTemplate(claim.kind,claim.dailyStudyMinutes,appUrl,claim.isTest)); result={status:'sent',messageId:sent.messageId} }
        catch(error){result=mailFailure(error)}
        const recorded=await rpc('finish_reminder_delivery',{p_id:claim.id,p_claim_token:claim.claimToken,p_status:result.status,p_error_code:result.code??null,p_provider_message_id:result.messageId??null})
        if (!recorded) throw Error('REMINDER_ACK')
        deliveries.push({channel:claim.channel,status:result.status})
      }
    } finally {transport.close()}
    return respond(200,{status:deliveries.length?'processed':'no_delivery_due',deliveries})
  } catch {return respond(503,{status:'reminder_service_unavailable'})}
})
