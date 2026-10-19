import { useId } from 'react'
import { personalEmailRecommendation, reminderHelp } from '../../domain/reminderPreferences.js'
import ReminderTimeField from './ReminderTimeField.jsx'
export default function ReminderFields({ value, onChange, capabilities, disabled = false, email, verified = false, includeWeekly = false }) {
  const id = useId()
  return <fieldset className="athena-reminder-fields" disabled={disabled}><legend className="sr-only">Email reminder preferences</legend>
    {[['studyReminders','Study reminders'],...(includeWeekly ? [['weeklyReport','Weekly progress report']] : [])].map(([key,label])=><div className="settings-notification" key={key}><label htmlFor={`${id}-${key}`}>{label}</label><input id={`${id}-${key}`} type="checkbox" role="switch" checked={!!value[key]} onChange={event=>onChange({...value,[key]:event.target.checked})} /></div>)}
    <small>{reminderHelp(capabilities)}</small>
    <ReminderTimeField value={value.preferredReminderTime} onChange={preferredReminderTime=>onChange({...value,preferredReminderTime})} />
    <div className="onboarding-field"><label htmlFor={`${id}-timezone`}>Timezone</label><input id={`${id}-timezone`} value={value.timezone??'Asia/Kolkata'} onChange={event=>onChange({...value,timezone:event.target.value})} required /></div>
    <div className="onboarding-field"><label htmlFor={`${id}-email`}>Reminder email</label><input id={`${id}-email`} type="email" value={email??''} readOnly /><small>{verified ? 'Verified' : 'Email verification is required before reminder delivery.'}</small><small>{personalEmailRecommendation}</small></div>
  </fieldset>
}
