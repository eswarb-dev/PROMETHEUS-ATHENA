import { supabase } from '../lib/supabase/client.js'
import { rpc } from '../lib/supabase/request.js'
import { DataError, normalizeError } from '../lib/supabase/errors.js'
import { validPreference } from '../domain/studyPreferences.js'
import { sessionIdentity } from '../lib/auth/sessionIdentity.js'
import { normalizeDirections } from '../domain/learningDirections.js'
export const notificationKeys = ['studyReminders', 'weeklyReport', 'email', 'whatsapp']
const mappings = {
  study_preferences: { dailyStudyMinutes: 'daily_study_minutes', studyPeriod: 'study_period', learningStyle: 'learning_style', taskSize: 'task_size' },
  notification_preferences: { studyReminders: 'study_reminders', weeklyReport: 'weekly_report' },
}
async function patch(table, payload, { userId } = {}) {
  if (!supabase) throw new DataError('SUPABASE_NOT_CONFIGURED')
  if (!userId) throw new DataError('AUTH_REQUIRED')
  const map = mappings[table]
  if (!payload || !Object.keys(payload).length || Object.keys(payload).some(key => !map[key])) throw new DataError('QUERY_ERROR')
  if (Object.entries(payload).some(([key, value]) => table === 'profile' ? typeof value !== 'string' || !value.trim() : table === 'study_preferences' ? !validPreference(key, value) : typeof value !== 'boolean')) throw new DataError('QUERY_ERROR')
  const actualTable = table === 'profile' ? 'profiles' : table
  const owner = table === 'profile' ? 'id' : 'user_id'
  const { data, error } = await supabase.from(actualTable).update(Object.fromEntries(Object.entries(payload).map(([key, value]) => [map[key], value]))).eq(owner, userId).select(Object.values(map).join(',')).single().abortSignal(sessionIdentity.signal)
  if (error) throw normalizeError(error)
  return Object.fromEntries(Object.keys(payload).map(key => [key, data[map[key]]]))
}
export const settingsService = {
  async getSettings({ user, ...options } = {}) {
    const data = await rpc('get_settings_snapshot', {}, options)
    const account = { email: user?.email, createdAt: user?.created_at, authProvider: user?.app_metadata?.provider }
    return { ...data, account, profile: data.profile ? { ...data.profile, email: user?.email } : null }
  },
  async updateProfile(payload, options) {
    const clean = { ...payload }
    if (clean.directions) clean.directions = normalizeDirections(clean.directions)
    const result = await rpc('update_learning_profile', { p_patch: clean }, options)
    if (result?.saved !== true) throw new DataError('QUERY_ERROR')
    return result
  },
  updateStudyPreferences: (payload, options) => patch('study_preferences', payload, options),
  updateNotificationPreferences: (payload, options) => patch('notification_preferences', payload, options),
}
