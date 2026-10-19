export type GmailErrorCode = 'GMAIL_CONFIG'|'GMAIL_UNAUTHORIZED'|'GMAIL_STATE'|'GMAIL_SCOPE'|'GMAIL_MAILBOX'|'GMAIL_REAUTHORIZE'|'GMAIL_UNAVAILABLE'|'GMAIL_STORAGE'|'GMAIL_MESSAGE'|'GMAIL_METHOD'
export class GmailError extends Error {
  constructor(public readonly code: GmailErrorCode) { super(code); this.name='GmailError' }
}
export function safeGmailError(error: unknown) {
  const code=error instanceof GmailError ? error.code : 'GMAIL_UNAVAILABLE'
  const status=code==='GMAIL_METHOD'?405:code==='GMAIL_UNAUTHORIZED'?401:['GMAIL_STATE','GMAIL_SCOPE','GMAIL_MAILBOX','GMAIL_MESSAGE'].includes(code)?400:503
  return {code,status}
}
