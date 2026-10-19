import { useRef, useState } from 'react'
import SettingsUnavailableState from './SettingsUnavailableState.jsx'
import SettingsSaveButton from './SettingsSaveButton.jsx'
import ReminderFields from '../onboarding/ReminderFields.jsx'
import { notificationFields } from '../../domain/reminderPreferences.js'
import { settingsService } from '../../services/settingsService.js'

export default function NotificationSettings({ settings }) {
  const saved = settings.data.notifications
  const [localDraft,setDraft]=useState(null), [notice,setNotice]=useState(''), [testing,setTesting]=useState(false)
  const revision=useRef(0)
  if (!saved) return <SettingsUnavailableState section="Notifications" />
  const draft=localDraft??saved, capabilities=settings.data.reminderCapabilities??{}
  const dirty=notificationFields.some(key=>draft[key]!==saved[key])
  const pending=settings.pending.notifications, writable=settings.data.capabilities.notificationsWrite
  const testAvailable=saved.studyReminders && capabilities.emailReminderDelivery && settings.data.account.emailVerified
  return <form className="settings-panel" onSubmit={async event=>{
    event.preventDefault(); if(!dirty||pending||!writable)return
    const current=revision.current, payload=Object.fromEntries(notificationFields.map(key=>[key,draft[key]]))
    if(await settings.updateNotifications(payload)){if(revision.current===current)setDraft(null);setNotice('Reminder preferences saved.')}
  }}>
    <h2>Notifications</h2><ReminderFields value={draft} onChange={value=>{revision.current++;setDraft(value);setNotice('')}} capabilities={capabilities} disabled={!writable||pending} email={settings.data.account.email} verified={settings.data.account.emailVerified} includeWeekly />
    <div className="settings-actions"><button type="button" className="settings-button" onClick={()=>{revision.current++;setDraft(null);setNotice('Unsaved changes discarded.')}}>Cancel</button><SettingsSaveButton disabled={!dirty||pending||!writable}>{pending?'Saving…':'Save reminders'}</SettingsSaveButton></div>
    <p className="settings-help">Disabling reminders cancels queued sends; a send already in progress cannot be recalled.</p>
    <button type="button" className="settings-button" disabled={!testAvailable||testing||dirty} onClick={async()=>{setTesting(true);try{const result=await settingsService.testReminder();setNotice(result.deliveries?.some(item=>item.status==='sent')?'Test reminder accepted by the email provider. Check your inbox.':result.status==='no_delivery_due'?'No test reminder is due. Tests are limited to once per day.':'The reminder could not be sent. Check email delivery setup and try later.')}catch{setNotice('The reminder service is unavailable. Try again later.')}finally{setTesting(false)}}}>{testing?'Sending…':'Send test email reminder'}</button>
    <p className="settings-help">Sends only to your verified ATHENA email, once per day.</p>
    {settings.errors.notifications&&<p className="settings-error" role="alert">{settings.errors.notifications}</p>}<p role="status" className="settings-notice">{notice}</p>
  </form>
}
