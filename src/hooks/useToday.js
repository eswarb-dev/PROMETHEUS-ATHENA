import useSnapshot from './useSnapshot.js'
import useWrite from './useWrite.js'
import { queryKeys } from '../lib/query/queryKeys.js'
import { todayService, studyDate } from '../services/todayService.js'
export default function useToday() {
  const date = studyDate()
  const state = useSnapshot(id => queryKeys.today(id, date), () => todayService.getTodayPlan({ date }), { staleTime: 30_000, empty: data => !data?.tasks.length })
  const writes = useWrite(['today', 'home', 'progress'])
  return { ...state, pendingTasks: writes.pending, taskErrors: writes.errors,
    updateTask: (id, checked) => writes.write(id, () => todayService.updateTaskStatus(id, checked ? 'completed' : 'planned')),
    startSession: id => writes.write('session', () => todayService.startFocusSession(id)),
    sessionPending: writes.pending.session === true, sessionError: writes.errors.session ?? '',
  }
}
