export const reminderOptions = [['email', 'Email'], ['whatsapp', 'WhatsApp'], ['both', 'Both — Recommended'], ['none', 'None']]
export const reminderChannel = value => value.reminderChannel ?? (value.email == null ? '' : value.email && value.whatsapp ? 'both' : value.email ? 'email' : value.whatsapp ? 'whatsapp' : 'none')
export const needsWhatsApp = channel => ['whatsapp', 'both'].includes(channel)
export const validPhone = value => /^\+[1-9]\d{7,14}$/.test(value ?? '')
export const maskPhone = value => value ? `${value.slice(0, 3)}••••••${value.slice(-4)}` : ''
export function reminderHelp(channel, capabilities = {}) {
  if (channel === 'none' || !channel) return 'Automated study reminders are disabled.'
  const email = capabilities.emailReminderDelivery === true
  const whatsapp = capabilities.whatsappReminderDelivery === true
  if (channel === 'email') return email ? 'Study reminders will be sent to your verified ATHENA email.' : 'Email reminders will be available after the reminder service is configured.'
  if (channel === 'whatsapp') return whatsapp ? 'Study reminders will be sent through the configured ATHENA WhatsApp reminder channel.' : 'WhatsApp reminders are available after provider setup and number verification. No WhatsApp reminders can be sent yet.'
  return `Recommended — receive important study reminders by email and WhatsApp. ${email ? 'Email reminders are active.' : 'Email delivery needs service setup.'} ${whatsapp ? 'WhatsApp is configured; your number must also be verified.' : 'WhatsApp is available after provider setup and number verification.'}`
}
