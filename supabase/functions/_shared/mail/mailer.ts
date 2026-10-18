import type { MailFailure } from './types.ts'
export const SENDER = 'prometheus.inference@gmail.com'
export function mailConfig(get: (key: string) => string | undefined) {
  const from = get('PROMETHEUS_MAIL_FROM')
  const host = get('PROMETHEUS_SMTP_HOST')
  const port = Number(get('PROMETHEUS_SMTP_PORT'))
  const user = get('PROMETHEUS_SMTP_USER')
  const pass = get('PROMETHEUS_SMTP_PASSWORD')?.replace(/ /g,'')
  if (from !== SENDER || user !== SENDER || host !== 'smtp.gmail.com' || port !== 465 || !pass || pass.length !== 16) throw Error('MAIL_CONFIG')
  return { from: `PROMETHEUS // ATHENA <${SENDER}>`, host, port, secure: true, auth: { user, pass }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000, logger: false, debug: false }
}
export function mailFailure(error: unknown): MailFailure {
  const e = error as { code?: string; command?: string; responseCode?: number }
  if (e?.code === 'EAUTH') return { code: 'MAIL_AUTH', status: 'failed' }
  // A disconnect during/after DATA can follow acceptance: never automatically resend it.
  if (!e?.responseCode && (!e?.command || /DATA/i.test(e.command))) return { code: 'MAIL_UNKNOWN', status: 'unknown_delivery' }
  if (e?.responseCode && e.responseCode >= 400 && e.responseCode < 500) return { code: 'MAIL_RATE_LIMIT', status: 'retry_wait' }
  if (['ETIMEDOUT','ECONNECTION','ESOCKET','EDNS'].includes(e?.code ?? '')) return { code: 'MAIL_CONNECTION', status: 'retry_wait' }
  return { code: 'MAIL_PROVIDER', status: 'failed' }
}
