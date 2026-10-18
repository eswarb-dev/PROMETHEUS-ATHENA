import { DataError } from '../lib/supabase/errors.js'
// Preserve the existing five-step review; account creation remains a later phase.
export const onboardingService = {
  async getOnboardingCapabilities() { return { accountCreation: false, profileCompletion: false, emailNotifications: false, whatsappNotifications: false } },
  async createAccount() { throw new DataError('AUTH_REQUIRED') },
  async completeOnboarding() { throw new DataError('AUTH_REQUIRED') },
}
