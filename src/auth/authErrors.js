export class AuthFlowError extends Error {
  constructor(code) { super(code); this.code = code }
}
export function authErrorCategory(error) {
  const code = error?.code
  if (error?.status === 429 || ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(code)) return 'AUTH_RATE_LIMITED'
  if (code === 'email_address_not_authorized') return 'AUTH_EMAIL_UNAUTHORIZED'
  if (['email_send_failed', 'smtp_error'].includes(code) || /error sending (confirmation|recovery|magic link|email)/i.test(error?.message ?? '')) return 'AUTH_MAIL_DELIVERY_ERROR'
  if (error?.status >= 500) return 'AUTH_PROVIDER_ERROR'
  if (error instanceof TypeError || (error?.name === 'AuthRetryableFetchError' && !error?.status)) return 'AUTH_NETWORK_ERROR'
  if (error?.status >= 400 || ['weak_password', 'otp_expired', 'invalid_credentials', 'email_not_confirmed'].includes(code)) return 'AUTH_INVALID_REQUEST'
  return 'AUTH_PROVIDER_ERROR'
}
export function authErrorMessage(error) {
  const code = error?.code
  if (code === 'SUPABASE_NOT_CONFIGURED') return 'Authentication is not connected yet.'
  if (code === 'email_not_confirmed') return 'Verify your email before signing in.'
  if (code === 'invalid_credentials' || error?.message === 'Invalid login credentials') return 'Email or password is incorrect.'
  if (code === 'otp_expired') return 'The code is invalid or has expired. Request a new code.'
  if (code === 'session_missing' || code === 'session_not_found') return 'Your session could not be confirmed. Sign in or request a new link.'
  if (error?.status === 429 || ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(code)) return 'Too many attempts. Try again shortly.'
  const category = authErrorCategory(error)
  if (category === 'AUTH_NETWORK_ERROR') return "Couldn't reach ATHENA. Check your connection and try again."
  if (category === 'AUTH_MAIL_DELIVERY_ERROR') return "We couldn't send the email right now. Try again shortly."
  if (category === 'AUTH_EMAIL_UNAUTHORIZED') return 'Email delivery is not available for this address right now.'
  if (error?.status >= 500) return 'Authentication is temporarily unavailable. Try again shortly.'
  if (code === 'weak_password') return 'Choose a stronger password with at least 8 characters.'
  return 'Could not complete this request. Check your details and try again.'
}
