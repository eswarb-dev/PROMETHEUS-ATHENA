export class AuthFlowError extends Error {
  constructor(code) { super(code); this.code = code }
}
export function authErrorMessage(error) {
  const code = error?.code
  if (code === 'SUPABASE_NOT_CONFIGURED') return 'Authentication is not connected yet.'
  if (code === 'email_not_confirmed') return 'Verify your email before signing in.'
  if (code === 'invalid_credentials' || error?.message === 'Invalid login credentials') return 'Email or password is incorrect.'
  if (code === 'otp_expired') return 'The code is invalid or has expired. Request a new code.'
  if (code === 'session_missing' || code === 'session_not_found') return 'Your session could not be confirmed. Sign in or request a new link.'
  if (error?.status === 429 || ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(code)) return 'Too many attempts. Try again shortly.'
  if (error?.name === 'AuthRetryableFetchError' || error instanceof TypeError) return "Couldn't reach ATHENA. Check your connection and try again."
  if (code === 'weak_password') return 'Choose a stronger password with at least 8 characters.'
  return 'Could not complete this request. Check your details and try again.'
}
