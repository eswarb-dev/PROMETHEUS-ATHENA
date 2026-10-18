import { createAccountRequest, AccountServiceError } from './accountRequest.js'
import { normalizeOnboarding } from '../domain/studyPreferences.js'

export function createOnboardingService(baseUrl = import.meta.env?.VITE_API_BASE_URL, fetchImpl = globalThis.fetch) {
  const request = createAccountRequest(baseUrl, fetchImpl)
  const gate = enabled => { if (enabled !== true) throw new AccountServiceError('CAPABILITY_UNAVAILABLE') }
  const api = {
    async getOnboardingCapabilities(options) { const value = await request('/onboarding/capabilities', options); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AccountServiceError('INVALID_ONBOARDING_RESPONSE'); return Object.fromEntries(['accountCreation', 'profileCompletion', 'emailNotifications', 'whatsappNotifications'].map(key => [key, value[key] === true])) },
    async createAccount(account, { enabled, signal } = {}) {
      gate(enabled)
      if (!account?.name?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email) || typeof account.password !== 'string' || account.password.length < 8) throw new AccountServiceError('INVALID_ACCOUNT_PAYLOAD')
      const result = await request('/onboarding/accounts', { method: 'POST', signal, body: { name: account.name.trim(), email: account.email.trim(), password: account.password } })
      if (typeof result?.id !== 'string' || !result.id.trim() || result.email !== account.email.trim()) throw new AccountServiceError('INVALID_ACCOUNT_RESPONSE')
      return { id: result.id, email: result.email }
    },
    async completeProfile(payload, { enabled, signal } = {}) {
      gate(enabled)
      const clean = normalizeOnboarding({ ...payload, goal: { ...payload.goal, customDirection: payload.goal.direction } })
      const result = await request('/onboarding/profile', { method: 'POST', signal, body: clean })
      if (result?.completed !== true || typeof result.profileId !== 'string' || !result.profileId.trim()) throw new AccountServiceError('INVALID_ONBOARDING_RESPONSE')
      return { completed: true, profileId: result.profileId }
    },
    completeOnboarding(payload, options) { return api.completeProfile(payload, options) },
  }
  return api
}
export const onboardingService = createOnboardingService()
