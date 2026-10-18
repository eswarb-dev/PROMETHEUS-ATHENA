import useSnapshot from './useSnapshot.js'
import { queryKeys } from '../lib/query/queryKeys.js'
import { homeService } from '../services/homeService.js'
export default function useHome() {
  return useSnapshot(queryKeys.home, () => homeService.getHomeSnapshot(), { staleTime: 45_000 })
}
