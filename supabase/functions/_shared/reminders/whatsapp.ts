import { reminderKinds, type ReminderKind } from './templates.ts'
export const WHATSAPP_CHANNEL_MODE = 'REMINDERS_ONLY'
// No incoming-message handler or mentor/model call belongs in this channel.
export const EMAIL_AI_ENABLED = false
export function whatsappProvider(get: (key: string) => string | undefined, fetcher: typeof fetch = fetch) {
  const endpoint = get('ATHENA_WHATSAPP_PROVIDER_URL'), token = get('ATHENA_WHATSAPP_PROVIDER_TOKEN'), sender = get('ATHENA_WHATSAPP_SENDER_ID')
  return {
    configured: !!endpoint && !!token && !!sender,
    async sendTemplateReminder(input: { deliveryId: string; recipientPhone: string; template: ReminderKind; dailyStudyMinutes: number; appUrl: string }) {
      if (!endpoint || !token || !sender) return { status: 'blocked', code: 'CHANNEL_NOT_READY' }
      if (!/^\+[1-9]\d{7,14}$/.test(input.recipientPhone) || !reminderKinds.includes(input.template)) return { status: 'failed', code: 'WHATSAPP_PROVIDER' }
      const url = new URL(endpoint)
      if (url.protocol !== 'https:' || url.username || url.password) return { status: 'blocked', code: 'CHANNEL_NOT_READY' }
      try {
        const response = await fetcher(url,{ method: 'POST', signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': input.deliveryId }, body: JSON.stringify({ senderId: sender, to: input.recipientPhone, template: input.template, variables: { dailyStudyMinutes: input.dailyStudyMinutes, appUrl: new URL(input.appUrl).origin }, channelMode: WHATSAPP_CHANNEL_MODE }) })
        if (response.status === 429) return { status: 'retry_wait', code: 'WHATSAPP_RATE_LIMIT' }
        if (response.status >= 500) return { status: 'unknown_delivery', code: 'WHATSAPP_UNKNOWN' }
        if (!response.ok) return { status: 'failed', code: 'WHATSAPP_PROVIDER' }
        const result = await response.json()
        if (typeof result.messageId !== 'string' || result.messageId.length>200) return { status: 'unknown_delivery', code: 'WHATSAPP_UNKNOWN' }
        return { status: 'sent', messageId: result.messageId }
      } catch { return { status: 'unknown_delivery', code: 'WHATSAPP_UNKNOWN' } }
    },
  }
}
