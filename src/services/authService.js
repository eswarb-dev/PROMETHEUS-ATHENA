import { supabase } from '../lib/supabase/client.js'
import { AuthFlowError } from '../auth/authErrors.js'
import { otpLength, recoveryUrl, confirmationUrl } from '../auth/authConfig.js'

export function createAuthService(client = supabase) {
  const auth = () => { if (!client) throw new AuthFlowError('SUPABASE_NOT_CONFIGURED'); return client.auth }
  const unwrap = async request => { const { data, error } = await request; if (error) throw error; return data }
  const confirmed = data => {
    if (!data?.session?.access_token || !data.session.user?.id || !data.user?.id || data.user.id !== data.session.user.id) throw new AuthFlowError('session_missing')
    return data
  }
  return {
    getAuthCapabilities: () => ({ configured: !!client, otpLength }),
    signIn: async (email, password) => confirmed(await unwrap(auth().signInWithPassword({ email: email.trim(), password }))),
    signUp: ({ name, email, password }) => unwrap(auth().signUp({ email: email.trim(), password, options: { data: { name: name.trim() }, ...(globalThis.location?.origin ? { emailRedirectTo: confirmationUrl() } : {}) } })),
    verifySignupOtp: async ({ email, token }) => {
      if (!new RegExp(`^\\d{${otpLength}}$`).test(token)) throw new AuthFlowError('otp_expired')
      return confirmed(await unwrap(auth().verifyOtp({ email: email.trim(), token, type: 'email' })))
    },
    resendSignupOtp: email => unwrap(auth().resend({ type: 'signup', email: email.trim() })),
    requestPasswordReset: email => unwrap(auth().resetPasswordForEmail(email.trim(), { redirectTo: recoveryUrl() })),
    updateRecoveredPassword: password => unwrap(auth().updateUser({ password })),
    signOut: () => unwrap(auth().signOut()),
  }
}
export const authService = createAuthService()
