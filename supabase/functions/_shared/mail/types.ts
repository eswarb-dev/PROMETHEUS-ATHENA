export type MailFailure = { code: 'MAIL_AUTH' | 'MAIL_RATE_LIMIT' | 'MAIL_CONNECTION' | 'MAIL_PROVIDER' | 'MAIL_UNKNOWN'; status: 'retry_wait' | 'failed' | 'unknown_delivery' }
export type WelcomeClaim = { id: string; claimToken: string; email: string; name: string }
