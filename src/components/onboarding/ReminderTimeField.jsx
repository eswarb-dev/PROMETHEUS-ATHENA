import { useId } from 'react'
import { splitReminderTime, joinReminderTime, formatReminderTime } from '../../domain/reminderTime.js'
export default function ReminderTimeField({ value, onChange, disabled = false }) {
  const id = useId(), parts = splitReminderTime(value)
  const update = patch => onChange(joinReminderTime({ ...parts, ...patch }))
  return <fieldset className="reminder-time-field" disabled={disabled}><legend>Preferred reminder time</legend><div className="reminder-time-parts">
    <div><label htmlFor={`${id}-hour`}>Hour</label><select id={`${id}-hour`} value={parts.hour} onChange={event => update({hour:event.target.value})}><option value="">Auto</option>{Array.from({length:12},(_,index)=>index+1).map(hour=><option key={hour} value={hour}>{hour}</option>)}</select></div>
    <div><label htmlFor={`${id}-minute`}>Minute</label><select id={`${id}-minute`} value={parts.minute} disabled={!parts.hour} onChange={event => update({minute:event.target.value})}>{Array.from({length:60},(_,index)=>String(index).padStart(2,'0')).map(minute=><option key={minute}>{minute}</option>)}</select></div>
    <div><label htmlFor={`${id}-period`}>AM/PM</label><select id={`${id}-period`} value={parts.period} disabled={!parts.hour} onChange={event => update({period:event.target.value})}><option>AM</option><option>PM</option></select></div>
  </div><small>{parts.hour ? `${formatReminderTime(value)} overrides your preferred study period for reminders.` : 'Leave empty to use your preferred study period.'}</small></fieldset>
}
