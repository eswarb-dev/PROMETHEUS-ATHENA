import { schedulerAuthorized } from './authorization.ts'
import { reminderTemplate } from './templates.ts'
import { whatsappProvider, WHATSAPP_CHANNEL_MODE, EMAIL_AI_ENABLED } from './whatsapp.ts'
const check=(value:unknown)=>{if(!value)throw Error('Assertion failed')}
Deno.test('scheduler authorization rejects missing and wrong secrets',async()=>{
 check(!await schedulerAuthorized(null,undefined))
 check(!await schedulerAuthorized('wrong','test-scheduler-identity-'.repeat(3)))
 check(await schedulerAuthorized('test-scheduler-identity-'.repeat(3),'test-scheduler-identity-'.repeat(3)))
})
Deno.test('reminder templates are concise, untracked and non-manipulative',()=>{
 for(const kind of ['study_task_due','study_plan_available','missed_study_window','weekly_progress_ready'] as const){
  const message=reminderTemplate(kind,30,'https://athena.example.invalid')
  check(!/<script|<img|utm_/i.test(message.html))
  check(message.text.includes('30 minutes'))
 }
 check(reminderTemplate('missed_study_window',30,'https://athena.example.invalid').text.includes('when it suits you'))
})
Deno.test('WhatsApp is reminder-only and cannot fake configured or successful delivery',async()=>{
 check(WHATSAPP_CHANNEL_MODE==='REMINDERS_ONLY');check(!EMAIL_AI_ENABLED)
 const none=whatsappProvider(()=>undefined)
 check(!none.configured)
 const input={deliveryId:'fixture-delivery',recipientPhone:'+15555550123',template:'study_task_due' as const,dailyStudyMinutes:30,appUrl:'https://athena.example.invalid'}
 check((await none.sendTemplateReminder(input)).status==='blocked')
 const values:Record<string,string>={ATHENA_WHATSAPP_PROVIDER_URL:'https://provider.example.invalid/reminders',ATHENA_WHATSAPP_PROVIDER_TOKEN:'fixture-provider-credential',ATHENA_WHATSAPP_SENDER_ID:'fixture-sender'}
 let posted:Record<string,unknown>|undefined
 const provider=whatsappProvider(key=>values[key],async(_url,options)=>{posted=JSON.parse(options!.body as string);return new Response(JSON.stringify({messageId:'fixture-message'}),{status:200})})
 check((await provider.sendTemplateReminder(input)).status==='sent')
 check(posted?.channelMode==='REMINDERS_ONLY')
 check(!('conversation' in posted!));check(!('prompt' in posted!))
 const limited=whatsappProvider(key=>values[key],async()=>new Response('',{status:429}))
 check((await limited.sendTemplateReminder(input)).status==='retry_wait')
 const uncertain=whatsappProvider(key=>values[key],async()=>{throw Error('private provider detail')})
 check((await uncertain.sendTemplateReminder(input)).status==='unknown_delivery')
})
