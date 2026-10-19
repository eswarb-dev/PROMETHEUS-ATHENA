const pad = value => String(value).padStart(2, '0')
export function splitReminderTime(value) {
  if (!value) return { hour: '', minute: '00', period: 'AM' }
  if (!/^([01]\d|2[0-3]):[0-5]\d(:00)?$/.test(value)) throw Error('INVALID_REMINDER_TIME')
  const hour = Number(value.slice(0, 2))
  return { hour: String(hour % 12 || 12), minute: value.slice(3, 5), period: hour >= 12 ? 'PM' : 'AM' }
}
export function joinReminderTime({ hour, minute, period }) {
  if (!hour) return ''
  if (!/^(?:[1-9]|1[0-2])$/.test(String(hour)) || !/^[0-5]\d$/.test(minute) || !['AM','PM'].includes(period)) throw Error('INVALID_REMINDER_TIME')
  return `${pad(Number(hour) % 12 + (period === 'PM' ? 12 : 0))}:${minute}`
}
export function formatReminderTime(value) {
  const { hour, minute, period } = splitReminderTime(value)
  return hour ? `${hour}:${minute} ${period}` : 'Preferred study period'
}
