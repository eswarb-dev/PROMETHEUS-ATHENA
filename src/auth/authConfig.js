// The linked ATHENA project was inspected: email OTP length is eight digits.
const length = Number(import.meta.env?.VITE_AUTH_OTP_LENGTH ?? 8)
export const otpLength = Number.isInteger(length) && length >= 6 && length <= 10 ? length : 8
export const maskEmail = email => {
  const [name, domain] = email.split('@')
  return domain ? `${name.slice(0, 2)}***@${domain}` : 'your email'
}
export function recoveryUrl(origin = globalThis.location?.origin) {
  const url = new URL(origin)
  if (!['https:', 'http:'].includes(url.protocol)) throw Error('Invalid application origin')
  return `${url.origin}/?auth=reset`
}
export function initialAuthView(search = globalThis.location?.search ?? '') {
  const view = new URLSearchParams(search).get('auth')
  return ({ login: 'login', signup: 'signup', verify: 'login', forgot: 'forgot', reset: 'reset' })[view] ?? 'login'
}
