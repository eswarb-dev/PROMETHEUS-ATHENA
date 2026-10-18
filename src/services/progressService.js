import { isDateOnly } from '../components/progress/progressFormatters.js'

export class ProgressServiceError extends Error {
  constructor(code) { super(code); this.name = 'ProgressServiceError'; this.code = code }
}
const invalid = () => { throw new ProgressServiceError('INVALID_PROGRESS_RESPONSE') }
const record = value => value && typeof value === 'object' && !Array.isArray(value)
const text = value => typeof value === 'string' && value.trim().length > 0
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0
const count = value => Number.isSafeInteger(value) && value >= 0
const percent = value => number(value) && value <= 100
const optional = (value, test) => value == null || test(value)
const timestamp = value => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
const rangeValues = ['7d', '30d', '90d']
function rows(value, validate, key) {
  if (value == null) return []
  if (!Array.isArray(value)) invalid()
  value.forEach(row => { if (!record(row) || !validate(row)) invalid() })
  if (new Set(value.map(row => row[key])).size !== value.length) invalid()
  if (key === 'date' && value.length) {
    const dates = value.map(row => Date.parse(row.date))
    if (value.length > 90 || Math.max(...dates) - Math.min(...dates) > 89 * 86400000) invalid()
  }
  return value
}
export function normalizeProgress(value) {
  if (!record(value) || !optional(value.summary, record) || !optional(value.capabilities, record) || !optional(value.hasHistory, item => typeof item === 'boolean') || !optional(value.range, item => rangeValues.includes(item))) invalid()
  const summary = value.summary ?? {}
  const integers = ['completedTasks', 'currentStreak', 'longestStreak', 'topicsCompleted', 'totalTopics', 'knowledgeVerified', 'knowledgeTotal', 'studySessions']
  if (integers.some(key => !optional(summary[key], count)) || ['roadmapCompletionPercent', 'weeklyCompletionPercent'].some(key => !optional(summary[key], percent)) || ['totalStudyMinutes', 'averageSessionMinutes'].some(key => !optional(summary[key], number))) invalid()
  if (summary.knowledgeVerified != null && summary.knowledgeTotal != null && summary.knowledgeVerified > summary.knowledgeTotal || summary.topicsCompleted != null && summary.totalTopics != null && summary.topicsCompleted > summary.totalTopics || summary.currentStreak != null && summary.longestStreak != null && summary.currentStreak > summary.longestStreak) invalid()
  if (!optional(value.capabilities?.rangeQueries, item => typeof item === 'boolean')) invalid()
  const weeklyActivity = rows(value.weeklyActivity, row => isDateOnly(row.date) && optional(row.studyMinutes, number) && optional(row.tasksCompleted, count) && optional(row.sessions, count), 'date')
  const topicProgress = rows(value.topicProgress, row => text(row.topicId) && text(row.title) && optional(row.progressPercent, percent) && optional(row.studyMinutes, number) && optional(row.status, text) && optional(row.order, number) && optional(row.updatedAt, timestamp), 'topicId')
  const consistency = rows(value.consistency, row => isDateOnly(row.date) && typeof row.planned === 'boolean' && typeof row.studied === 'boolean' && count(row.completedPlannedTasks) && count(row.plannedTasks) && row.completedPlannedTasks <= row.plannedTasks && (row.planned || row.plannedTasks === 0 && row.completedPlannedTasks === 0), 'date')
  const recentSessions = rows(value.recentSessions, row => text(row.id) && timestamp(row.startedAt) && optional(row.durationMinutes, number) && optional(row.topicTitle, text) && optional(row.taskTitle, text), 'id')
  const canonicalSummary = Object.fromEntries([...integers, 'roadmapCompletionPercent', 'weeklyCompletionPercent', 'totalStudyMinutes', 'averageSessionMinutes'].filter(key => summary[key] != null).map(key => [key, summary[key]]))
  const hasData = value.hasHistory === true || [weeklyActivity, topicProgress, consistency, recentSessions].some(list => list.length > 0) || Object.values(canonicalSummary).some(item => item > 0)
  return { summary: canonicalSummary, weeklyActivity, topicProgress, consistency, recentSessions, hasData, range: value.range ?? '7d', capabilities: { rangeQueries: value.capabilities?.rangeQueries === true } }
}
export function createProgressService(baseUrl = import.meta.env?.VITE_API_BASE_URL, fetchImpl = globalThis.fetch) {
  async function getProgressState({ signal, range } = {}) {
    if (!baseUrl?.trim()) throw new ProgressServiceError('DATA_SOURCE_NOT_CONFIGURED')
    let base
    try { base = new URL(baseUrl, globalThis.location?.origin); if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw Error() }
    catch { throw new ProgressServiceError('INVALID_DATA_SOURCE_CONFIGURATION') }
    if (range !== undefined && !rangeValues.includes(range)) throw new ProgressServiceError('INVALID_RANGE')
    const controller = new AbortController()
    const abort = () => controller.abort()
    if (signal?.aborted) controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    const timeout = setTimeout(abort, 15000)
    try {
      const response = await fetchImpl(`${base.href.replace(/\/$/, '')}/progress${range ? `?range=${range}` : ''}`, { signal: controller.signal, headers: { Accept: 'application/json' }, cache: 'no-store' })
      if (!response.ok) throw new ProgressServiceError('PROGRESS_REQUEST_FAILED')
      const raw = await response.json()
      const data = normalizeProgress(raw)
      if (range && raw.range != null && raw.range !== range) throw new ProgressServiceError('PROGRESS_RANGE_MISMATCH')
      if (range) data.range = range
      return data
    } catch (error) {
      if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError')
      if (error instanceof ProgressServiceError) throw error
      throw new ProgressServiceError('PROGRESS_REQUEST_FAILED')
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort) }
  }
  const api = {
    getProgressState,
    async getProgressRange(range, { enabled, ...options } = {}) { if (enabled !== true) throw new ProgressServiceError('CAPABILITY_UNAVAILABLE'); return getProgressState({ ...options, range }) },
    async getProgressSummary(options) { return (await getProgressState(options)).summary },
    async getWeeklyActivity(options) { return (await getProgressState(options)).weeklyActivity },
    async getTopicProgress(options) { return (await getProgressState(options)).topicProgress },
    async getConsistency(options) { return (await getProgressState(options)).consistency },
    async getStudyHistory(options) { return (await getProgressState(options)).recentSessions },
    async getKnowledgeProgress(options) { const { knowledgeVerified, knowledgeTotal } = (await getProgressState(options)).summary; return { knowledgeVerified, knowledgeTotal } },
  }
  return api
}
export const progressService = createProgressService()
