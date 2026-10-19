import useSnapshot from './useSnapshot.js'
import useWrite from './useWrite.js'
import { queryKeys } from '../lib/query/queryKeys.js'
import { todayService } from '../services/todayService.js'
export default function useToday() {
  const state = useSnapshot(id => queryKeys.today(id), () => todayService.getTodayPlan(), { staleTime: 30_000, empty: data => !data?.tasks.length })
  const writes = useWrite(['today', 'home', 'progress'])
  return { ...state, pendingTasks: writes.pending, taskErrors: writes.errors,
    updateTask: (id, checked) => writes.write(id, () => todayService.updateTaskStatus(id, checked ? 'completed' : 'planned')),
    startSession: id => writes.write('session', () => todayService.startFocusSession(id)),
    planToday: () => writes.write('plan', () => todayService.planToday()),
    planPending: writes.pending.plan === true, planError: writes.errors.plan,
    sessionPending: writes.pending.session === true, sessionError: writes.errors.session ?? '',
  }
}
