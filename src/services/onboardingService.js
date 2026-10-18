import { DataError } from '../lib/supabase/errors.js'
import { rpc } from '../lib/supabase/request.js'
import { supabase } from '../lib/supabase/client.js'
import { normalizeOnboarding } from '../domain/studyPreferences.js'
export const onboardingService = {
  async getOnboardingCapabilities() { return { profileCompletion: !!supabase, emailNotifications: false, whatsappNotifications: false } },
  async completeOnboarding(payload, options) {
    const clean = normalizeOnboarding({ ...payload, goal: { ...payload.goal, customDirection: payload.goal.direction } })
    const result = await rpc('complete_onboarding', { p_payload: clean }, options)
    if (result?.completed !== true || !result.profileId) throw new DataError('QUERY_ERROR')
    return result
  },
}
