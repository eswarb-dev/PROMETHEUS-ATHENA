import { schedulerAuthorized } from './authorization.ts'
import { reminderTemplate } from './templates.ts'
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
