import SettingsUnavailableState from './SettingsUnavailableState.jsx'

const labels = [['studyReminders', 'Study reminders'], ['weeklyReport', 'Weekly progress report'], ['email', 'Email notifications'], ['whatsapp', 'WhatsApp notifications']]
export default function NotificationSettings({ settings }) {
  const saved = settings.data.notifications
  if (!saved) return <SettingsUnavailableState section="Notifications" />
  const available = labels.filter(([key]) => typeof saved[key] === 'boolean' && (key !== 'email' || saved.emailSupported === true) && (key !== 'whatsapp' || saved.whatsappSupported === true))
  return <section className="settings-panel"><h2>Notifications</h2>{available.length === 0 && <p>No notification channels are available.</p>}{available.map(([key, label]) => <div className="settings-notification" key={key}><label htmlFor={`notification-${key}`}>{label}</label><input id={`notification-${key}`} type="checkbox" role="switch" aria-checked={saved[key]} checked={saved[key]} disabled={!settings.data.capabilities.notificationsWrite || settings.pending[`notification:${key}`] === true} onChange={event => settings.updateNotification(key, event.target.checked)} />{settings.errors[`notification:${key}`] && <p role="alert" className="settings-error">{settings.errors[`notification:${key}`]}</p>}</div>)}{!settings.data.capabilities.notificationsWrite && <p className="settings-help">Notification preferences are read-only.</p>}</section>
}
