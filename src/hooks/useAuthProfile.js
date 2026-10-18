import useSnapshot from './useSnapshot.js'
import { queryKeys } from '../lib/query/queryKeys.js'
import { rpc } from '../lib/supabase/request.js'
export default function useAuthProfile() {
  return useSnapshot(queryKeys.onboarding, () => rpc('get_auth_profile'), { staleTime: 180_000 })
}
