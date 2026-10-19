import { useState } from 'react'
import SettingsUnavailableState from './SettingsUnavailableState.jsx'
import SettingsSaveButton from './SettingsSaveButton.jsx'
import ReminderFields from '../onboarding/ReminderFields.jsx'
import { needsWhatsApp, validPhone } from '../../domain/reminderPreferences.js'
import { settingsService } from '../../services/settingsService.js'

export default function NotificationSettings({ settings }) {
  const saved = settings.data.notifications
  const [localDraft,setDraft]=useState(null)
  const [notice,setNotice]=useState('')
  const [testing,setTesting]=useState(false)
  if (!saved) return <SettingsUnavailableState section="Notifications" />
  const draft=localDraft??saved,capabilities=settings.data.reminderCapabilities??{}
  const dirty=JSON.stringify(draft)!==JSON.stringify(saved)
  const valid=!needsWhatsApp(draft.reminderChannel)||validPhone(draft.whatsappNumber)
  const testAvailable=saved.studyReminders && ['email','both'].includes(saved.reminderChannel) && capabilities.emailReminderDelivery
  return <form className="settings-panel" onSubmit={async event=>{event.preventDefault();if(!dirty||!valid||settings.pending.notifications)return;const value=draft;const payload=Object.fromEntries(['reminderChannel','whatsappNumber','studyReminders','weeklyReport','preferredReminderTime','timezone'].map(key=>[key,value[key]]));if(await settings.updateNotifications(payload)){setDraft(null);setNotice('Reminder preferences saved.')}}}>
    <h2>Notifications</h2><ReminderFields value={draft} onChange={setDraft} capabilities={capabilities} disabled={!settings.data.capabilities.notificationsWrite} />
    {[['studyReminders','Study reminders'],['weeklyReport','Weekly progress report']].map(([key,label])=><div className="settings-notification" key={key}><label htmlFor={`notification-${key}`}>{label}</label><input id={`notification-${key}`} type="checkbox" role="switch" checked={!!draft[key]} aria-checked={!!draft[key]} onChange={event=>setDraft({...draft,[key]:event.target.checked})} /></div>)}
    <div className="athena-preference-fields"><div className="onboarding-field"><label htmlFor="reminder-time">Preferred reminder time (optional)</label><input id="reminder-time" type="time" value={draft.preferredReminderTime?.slice(0,5)??''} onChange={event=>setDraft({...draft,preferredReminderTime:event.target.value})} /><small>Leave empty to use your preferred study period.</small></div><div className="onboarding-field"><label htmlFor="reminder-timezone">Timezone</label><input id="reminder-timezone" list="athena-timezones" value={draft.timezone??'Asia/Kolkata'} onChange={event=>setDraft({...draft,timezone:event.target.value})} required /><datalist id="athena-timezones">{['Asia/Kolkata','UTC','Europe/London','America/New_York','America/Los_Angeles'].map(zone=><option value={zone} key={zone}/>)}</datalist></div></div>
    <div className="settings-actions"><button type="button" className="settings-button" onClick={()=>{setDraft(null);setNotice('Unsaved changes discarded.')}}>Cancel</button><SettingsSaveButton disabled={!dirty||!valid||settings.pending.notifications}>{settings.pending.notifications?'Saving…':'Save reminders'}</SettingsSaveButton></div>
    <p className="settings-help">WhatsApp is reminder-only. Number status: {saved.whatsappVerified?'verified by provider':'not verified'}. Disabling reminders cancels queued sends; a send already in progress cannot be recalled.</p>
    <button type="button" className="settings-button" disabled={!testAvailable||testing||dirty} onClick={async()=>{setTesting(true);try{const result=await settingsService.testReminder();setNotice(result.deliveries?.some(item=>item.channel==='email'&&item.status==='sent')?'Test reminder accepted by the email provider. Check your inbox.':result.status==='no_delivery_due'?'No test reminder is due. Tests are limited to once per day.':'The reminder could not be sent. Check channel setup and try later.')}catch{setNotice('The reminder service is unavailable. Try again later.')}finally{setTesting(false)}}}>{testing?'Sending…':'Send test email reminder'}</button>
    <p className="settings-help">Sends only to your verified ATHENA email, once per day.</p>
    {settings.errors.notifications&&<p className="settings-error" role="alert">{settings.errors.notifications}</p>}<p role="status" className="settings-notice">{notice}</p>
  </form>
}
