import { selfReportedLevels, preferenceDefinitions, validPreference } from '../domain/studyPreferences.js'
import { AccountServiceError, createAccountRequest } from './accountRequest.js'
const invalid = () => { throw new AccountServiceError('INVALID_SETTINGS_RESPONSE') }
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const text = value => typeof value === 'string'
const optional = (value, check) => value == null || check(value)
const email = value => text(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const timestamp = value => text(value) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
const bool = value => typeof value === 'boolean'
const capabilityKeys = ['profileWrite', 'preferencesWrite', 'notificationsWrite', 'passwordChange', 'accountDeletion', 'avatarUpload', 'accountNameWrite']
export const notificationKeys = ['studyReminders', 'weeklyReport', 'email', 'whatsapp']
const pick = (value, keys) => Object.fromEntries(keys.filter(key => value[key] != null).map(key => [key, value[key]]))
function avatarUrl(value) { try { const url = new URL(value, globalThis.location?.origin ?? 'https://placeholder.invalid'); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password } catch { return false } }
function profile(value) {
  if (!object(value) || ['id', 'name', 'direction', 'goal'].some(key => !optional(value[key], text)) || !optional(value.email, email) || !optional(value.avatarUrl, avatarUrl) || !optional(value.skills, Array.isArray)) invalid()
  const result = pick(value, ['id', 'name', 'email', 'direction', 'goal', 'avatarUrl'])
  if (value.avatarUrl === null) result.avatarUrl = null
  if (value.skills != null) {
    if (value.skills.some(skill => !object(skill) || !text(skill.name) || !skill.name.trim() || !optional(skill.selfReportedLevel, level => selfReportedLevels.includes(level)))) invalid()
    if (new Set(value.skills.map(skill => skill.name.toLowerCase())).size !== value.skills.length) invalid()
    result.skills = value.skills.map(skill => pick(skill, ['name', 'selfReportedLevel']))
  }
  return result
}
function preferences(value) { if (!object(value) || preferenceDefinitions.some(([key]) => !optional(value[key], item => validPreference(key, item)))) invalid(); return pick(value, preferenceDefinitions.map(([key]) => key)) }
function notifications(value) { if (!object(value) || [...notificationKeys, 'emailSupported', 'whatsappSupported'].some(key => !optional(value[key], bool))) invalid(); return pick(value, [...notificationKeys, 'emailSupported', 'whatsappSupported']) }
function account(value) { if (!object(value) || !optional(value.email, email) || !optional(value.name, text) || !optional(value.createdAt, timestamp) || !optional(value.authProvider, text)) invalid(); return pick(value, ['name', 'email', 'createdAt', 'authProvider']) }
const validators = { profile, studyPreferences: preferences, notifications, account }
export function normalizeSettings(value) {
  if (!object(value) || !optional(value.capabilities, object) || capabilityKeys.some(key => !optional(value.capabilities?.[key], bool))) invalid()
  const result = { capabilities: Object.fromEntries(capabilityKeys.map(key => [key, value.capabilities?.[key] === true])) }
  for (const [key, validate] of Object.entries(validators)) {
    try { result[key] = value[key] == null ? null : validate(value[key]) }
    catch { result[key] = null }
  }
  return result
}
export function createSettingsService(baseUrl = import.meta.env?.VITE_API_BASE_URL, fetchImpl = globalThis.fetch) {
  const request = createAccountRequest(baseUrl, fetchImpl)
  const gate = enabled => { if (enabled !== true) throw new AccountServiceError('CAPABILITY_UNAVAILABLE') }
  async function patch(section, payload, keys, { enabled, signal } = {}) {
    gate(enabled)
    if (!object(payload) || !Object.keys(payload).length || Object.keys(payload).some(key => !keys.includes(key))) throw new AccountServiceError('INVALID_SETTINGS_PAYLOAD')
    validators[section](payload)
    if (section === 'profile' && Object.values(payload).some(value => !text(value) || !value.trim())) throw new AccountServiceError('INVALID_SETTINGS_PAYLOAD')
    const result = validators[section](await request(`/settings/${section === 'studyPreferences' ? 'study-preferences' : section}`, { signal, method: 'PATCH', body: payload }))
    if (Object.keys(payload).some(key => result[key] !== payload[key])) invalid()
    return result
  }
  const api = {
    async getSettings(options) { return normalizeSettings(await request('/settings', options)) },
    async getProfile(options) { return (await api.getSettings(options)).profile },
    async getStudyPreferences(options) { return (await api.getSettings(options)).studyPreferences },
    async getNotificationPreferences(options) { return (await api.getSettings(options)).notifications },
    async getAccountInfo(options) { return (await api.getSettings(options)).account },
    async getCapabilities(options) { return (await api.getSettings(options)).capabilities },
    updateProfile(payload, options) { return patch('profile', payload, ['name', 'direction', 'goal'], options) },
    updateStudyPreferences(payload, options) { return patch('studyPreferences', payload, preferenceDefinitions.map(([key]) => key), options) },
    updateNotificationPreferences(payload, options) { return patch('notifications', payload, notificationKeys, options) },
    async uploadAvatar(file, { enabled, signal } = {}) {
      gate(enabled)
      if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size >= 5 * 1024 * 1024) throw new AccountServiceError('INVALID_AVATAR')
      const body = new FormData(); body.append('avatar', file)
      const result = profile(await request('/settings/profile/avatar', { method: 'POST', signal, body }))
      if (!result.avatarUrl) invalid()
      return result.avatarUrl
    },
    async updateAccountName(payload, { enabled, signal } = {}) { gate(enabled); if (!text(payload?.name) || !payload.name.trim()) throw new AccountServiceError('INVALID_SETTINGS_PAYLOAD'); const result = account(await request('/settings/account/name', { signal, method: 'PATCH', body: { name: payload.name.trim() } })); if (result.name !== payload.name.trim()) invalid(); return result },
    async changePassword(payload, { enabled, signal } = {}) { gate(enabled); if (!text(payload?.currentPassword) || !payload.currentPassword || !text(payload.newPassword) || payload.newPassword.length < 8) throw new AccountServiceError('INVALID_PASSWORD'); const result = await request('/settings/account/password', { signal, method: 'POST', body: { currentPassword: payload.currentPassword, newPassword: payload.newPassword } }); if (result?.changed !== true) invalid(); return true },
    async deleteAccount(payload, { enabled, signal } = {}) { gate(enabled); if (payload?.confirmation !== 'DELETE') throw new AccountServiceError('CONFIRMATION_REQUIRED'); const result = await request('/settings/account', { signal, method: 'DELETE', body: { confirmation: 'DELETE' } }); if (result?.deleted !== true) invalid(); return true },
  }
  return api
}
export const settingsService = createSettingsService()
