export class TodayServiceError extends Error {
  constructor(code) { super(code); this.name = 'TodayServiceError'; this.code = code }
}

export const taskStatuses = {
  planned: { label: 'Planned', color: '#B7C0DB' },
  in_progress: { label: 'In progress', color: '#B4AAFF' },
  completed: { label: 'Completed', color: '#49D7A5' },
  missed: { label: 'Missed', color: '#FFBE55' },
}
const invalid = () => { throw new TodayServiceError('INVALID_TODAY_RESPONSE') }
const record = value => value && typeof value === 'object' && !Array.isArray(value)
const text = value => typeof value === 'string' && value.trim().length > 0
const optional = (value, check) => value == null || check(value)
const minutes = value => typeof value === 'number' && Number.isFinite(value) && value >= 0
const dateOnly = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
const timestamp = value => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))

function validateTask(task) {
  if (!record(task) || !text(task.id) || !text(task.title) || !Object.hasOwn(taskStatuses, task.status) ||
      !optional(task.description, value => typeof value === 'string') || !optional(task.estimatedMinutes, minutes) ||
      !optional(task.actualMinutes, minutes) || !optional(task.priority, text) || !optional(task.topicId, text) ||
      !optional(task.topicTitle, text) || !optional(task.roadmapId, text) || !optional(task.scheduledFor, dateOnly) ||
      !optional(task.order, value => typeof value === 'number' && Number.isFinite(value)) || !optional(task.completedAt, timestamp)) invalid()
  return task
}
function validateSession(session) {
  if (!record(session) || !text(session.id) || !text(session.taskId) || !timestamp(session.startedAt) || !optional(session.taskTitle, text)) invalid()
  return session
}
function validatePlan(plan) {
  if (!record(plan) || !dateOnly(plan.date) || !Array.isArray(plan.tasks) ||
      !optional(plan.plannedMinutes, minutes) || !optional(plan.completedMinutes, minutes) ||
      !optional(plan.taskCount, value => Number.isInteger(value) && value >= 0) ||
      !optional(plan.completedTaskCount, value => Number.isInteger(value) && value >= 0)) invalid()
  if (plan.timezone != null) {
    if (!text(plan.timezone)) invalid()
    try { new Intl.DateTimeFormat('en', { timeZone: plan.timezone }).format() } catch { invalid() }
  }
  plan.tasks.forEach(validateTask)
  if (new Set(plan.tasks.map(task => task.id)).size !== plan.tasks.length || plan.tasks.some(task => task.scheduledFor != null && task.scheduledFor !== plan.date)) invalid()
  if (plan.activeSession != null) validateSession(plan.activeSession)
  if (plan.capabilities != null && (!record(plan.capabilities) || ['updateTask', 'focusSessions'].some(key => plan.capabilities[key] !== undefined && typeof plan.capabilities[key] !== 'boolean'))) invalid()
  return { ...plan, tasks: [...plan.tasks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), capabilities: { updateTask: plan.capabilities?.updateTask === true, focusSessions: plan.capabilities?.focusSessions === true } }
}

export function createTodayService(baseUrl = import.meta.env?.VITE_API_BASE_URL, fetchImpl = globalThis.fetch) {
  async function request(path, { signal, method = 'GET', body } = {}) {
    if (!baseUrl?.trim()) throw new TodayServiceError('DATA_SOURCE_NOT_CONFIGURED')
    let base
    try {
      base = new URL(baseUrl, globalThis.location?.origin)
      if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw Error()
    } catch { throw new TodayServiceError('INVALID_DATA_SOURCE_CONFIGURATION') }
    const controller = new AbortController()
    const abort = () => controller.abort()
    if (signal?.aborted) controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    const timeout = setTimeout(abort, 15000)
    try {
      const response = await fetchImpl(`${base.href.replace(/\/$/, '')}${path}`, { signal: controller.signal, method, headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' })
      if (!response.ok) throw new TodayServiceError('TODAY_REQUEST_FAILED')
      return await response.json()
    } catch (error) {
      if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError')
      if (error instanceof TodayServiceError) throw error
      throw new TodayServiceError('TODAY_REQUEST_FAILED')
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort) }
  }
  const requireCapability = enabled => { if (enabled !== true) throw new TodayServiceError('CAPABILITY_UNAVAILABLE') }
  const idPath = id => {
    if (!text(id) || id === '.' || id === '..') throw new TodayServiceError('INVALID_ID')
    return encodeURIComponent(id)
  }
  return {
    async getTodayPlan(options) { return validatePlan(await request('/today', options)) },
    async getTodayTasks(options) { return (await this.getTodayPlan(options)).tasks },
    async getActiveStudySession(options) { return (await this.getTodayPlan(options)).activeSession ?? null },
    async updateTaskStatus(taskId, status, { enabled, signal } = {}) {
      requireCapability(enabled)
      if (!Object.hasOwn(taskStatuses, status)) throw new TodayServiceError('INVALID_TASK_STATUS')
      const result = validateTask(await request(`/tasks/${idPath(taskId)}/status`, { signal, method: 'PATCH', body: { status } }))
      if (result.id !== taskId || result.status !== status) invalid()
      return result
    },
    startTask(taskId, options) { return this.updateTaskStatus(taskId, 'in_progress', options) },
    completeTask(taskId, options) { return this.updateTaskStatus(taskId, 'completed', options) },
    async startFocusSession(taskId, { enabled, signal } = {}) {
      requireCapability(enabled)
      const session = validateSession(await request('/focus-sessions', { signal, method: 'POST', body: { taskId } }))
      if (session.taskId !== taskId) invalid()
      return session
    },
  }
}

export const todayService = createTodayService()
