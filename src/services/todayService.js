import { rpc } from '../lib/supabase/request.js'
export const taskStatuses = {
  planned: { label: 'Planned', color: '#B7C0DB' },
  in_progress: { label: 'In progress', color: '#B4AAFF' },
  completed: { label: 'Completed', color: '#49D7A5' },
  missed: { label: 'Missed', color: '#FFBE55' },
}
export const studyDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
export const todayService = {
  getTodayPlan: ({ date, ...options } = {}) => rpc('get_today_snapshot', { p_date: date ?? null }, options),
  planToday: () => rpc('plan_today_from_roadmap', { p_date: null }),
  updateTaskStatus: (id, status, options) => rpc('set_task_status', { p_task_id: id, p_status: status }, options),
  startFocusSession: (id, options) => rpc('start_focus_session', { p_task_id: id }, options),
}
