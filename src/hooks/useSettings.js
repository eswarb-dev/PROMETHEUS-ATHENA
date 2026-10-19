import useSnapshot from './useSnapshot.js'
import useWrite from './useWrite.js'
import { useSession } from '../lib/auth/sessionContext.js'
import { queryKeys } from '../lib/query/queryKeys.js'
import { settingsService } from '../services/settingsService.js'
export default function useSettings() {
  const { user } = useSession()
  const state = useSnapshot(queryKeys.settings, () => settingsService.getSettings({ user }), { staleTime: 180_000 })
  const writes = useWrite(['settings', 'roadmap', 'home'])
  return { ...state, pending: writes.pending, errors: writes.errors,
    updateProfile: payload => writes.write('profile', userId => settingsService.updateProfile(payload, { userId })),
    updatePreferences: payload => writes.write('preferences', userId => settingsService.updateStudyPreferences(payload, { userId })),
    updateNotification: (key, value) => writes.write(`notification:${key}`, userId => settingsService.updateNotificationPreferences({ [key]: value }, { userId })),
  }
}
