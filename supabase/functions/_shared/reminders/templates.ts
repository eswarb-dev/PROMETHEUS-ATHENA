export const reminderKinds = ['study_task_due','study_plan_available','missed_study_window','weekly_progress_ready'] as const
export type ReminderKind = typeof reminderKinds[number]
export const escape = (value: string) => value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
export function reminderTemplate(kind: ReminderKind, budget: number, appUrl: string, isTest = false) {
  if (!reminderKinds.includes(kind)) throw Error('INVALID_REMINDER_KIND')
  const url = new URL(appUrl)
  if (url.username || url.password || !['https:','http:'].includes(url.protocol) || url.protocol === 'http:' && !['localhost','127.0.0.1'].includes(url.hostname)) throw Error('INVALID_APP_URL')
  const copy = {study_task_due:'Your study tasks are ready when you are.',study_plan_available:'Your study plan is available.',missed_study_window:'Your study plan is still available. Continue when it suits you.',weekly_progress_ready:'Your weekly progress is ready to review.'}[kind]
  const summary = `${isTest ? 'This is your requested ATHENA test reminder. ' : ''}${copy} Your daily study budget is ${Number.isInteger(budget) && budget > 0 ? budget : 30} minutes.`
  return {subject:isTest?'Your ATHENA test reminder':'Your ATHENA study reminder',text:`PROMETHEUS // ATHENA\n\n${summary}\n\nOpen ATHENA: ${url.origin}/\nManage reminder channels in Settings → Notifications.`,html:`<!doctype html><html lang="en"><body style="margin:0;background:#080D1A;color:#F5F7FF;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellpadding="24"><tr><td align="center"><table role="presentation" width="100%" cellpadding="24" style="max-width:560px;background:#12182B"><tr><td><p style="color:#37D7FF">PROMETHEUS // ATHENA</p><h1 style="font-size:24px">Your study reminder</h1><p>${escape(summary)}</p><p><a href="${escape(url.origin)}/" style="color:#C4BBFF">Open ATHENA</a></p><p style="color:#9EA8C7">Manage reminder channels in Settings → Notifications.</p></td></tr></table></td></tr></table></body></html>`}
}
