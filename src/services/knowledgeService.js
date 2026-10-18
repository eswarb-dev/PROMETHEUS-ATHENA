import { knowledgeStatus, verificationLabels } from '../components/knowledge/knowledgeStatus.js'
import { selfReportedLevels } from '../components/knowledge/selfReportedLevel.js'

export class KnowledgeServiceError extends Error {
  constructor(code) { super(code); this.name = 'KnowledgeServiceError'; this.code = code }
}
const invalid = () => { throw new KnowledgeServiceError('INVALID_KNOWLEDGE_RESPONSE') }
const record = value => value && typeof value === 'object' && !Array.isArray(value)
const text = value => typeof value === 'string' && value.trim().length > 0
const optional = (value, check) => value == null || check(value)
const stamp = value => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
function normalizeTopic(topic) {
  if (!record(topic) || !text(topic.id) || !text(topic.title) || !optional(topic.description, value => typeof value === 'string') ||
      !optional(topic.verifiedLevel, value => typeof value === 'string') ||
      !optional(topic.verifiedConfidence, value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1) ||
      !optional(topic.verificationStatus, value => Object.hasOwn(verificationLabels, value)) ||
      !optional(topic.source, text) || !optional(topic.roadmapId, text) || !optional(topic.roadmapTopicId, text) ||
      !optional(topic.gapReason, value => typeof value === 'string') || !optional(topic.lastStudiedAt, stamp) || !optional(topic.updatedAt, stamp) ||
      !optional(topic.suggestedByAthena, value => typeof value === 'boolean')) invalid()
  return { ...topic, knowledgeState: Object.hasOwn(knowledgeStatus, topic.knowledgeState) ? topic.knowledgeState : 'unclassified', selfReportedLevel: selfReportedLevels.includes(topic.selfReportedLevel) ? topic.selfReportedLevel : 'not_rated' }
}
function normalizeState(state) {
  if (!record(state) || !Array.isArray(state.topics) || !optional(state.summary, record) || !optional(state.capabilities, record)) invalid()
  const keys = ['totalTopics', 'knownCount', 'learningCount', 'suggestedCount', 'gapCount', 'verifiedCount']
  if (state.summary && keys.some(key => !optional(state.summary[key], value => Number.isInteger(value) && value >= 0))) invalid()
  if (state.capabilities?.updateSelfReport !== undefined && typeof state.capabilities.updateSelfReport !== 'boolean') invalid()
  const topics = state.topics.map(normalizeTopic)
  if (new Set(topics.map(topic => topic.id)).size !== topics.length) invalid()
  return { ...state, topics, capabilities: { updateSelfReport: state.capabilities?.updateSelfReport === true, diagnostics: false } }
}

export function createKnowledgeService(baseUrl = import.meta.env?.VITE_API_BASE_URL, fetchImpl = globalThis.fetch) {
  async function request(path, { signal, method = 'GET', body } = {}) {
    if (!baseUrl?.trim()) throw new KnowledgeServiceError('DATA_SOURCE_NOT_CONFIGURED')
    let base
    try {
      base = new URL(baseUrl, globalThis.location?.origin)
      if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw Error()
    } catch { throw new KnowledgeServiceError('INVALID_DATA_SOURCE_CONFIGURATION') }
    const controller = new AbortController()
    const abort = () => controller.abort()
    if (signal?.aborted) controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    const timeout = setTimeout(abort, 15000)
    try {
      const response = await fetchImpl(`${base.href.replace(/\/$/, '')}${path}`, { signal: controller.signal, method, headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' })
      if (!response.ok) throw new KnowledgeServiceError('KNOWLEDGE_REQUEST_FAILED')
      return await response.json()
    } catch (error) {
      if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError')
      if (error instanceof KnowledgeServiceError) throw error
      throw new KnowledgeServiceError('KNOWLEDGE_REQUEST_FAILED')
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort) }
  }
  const pathId = id => { if (!text(id) || id === '.' || id === '..') throw new KnowledgeServiceError('INVALID_ID'); return encodeURIComponent(id) }
  return {
    async getKnowledgeState(options) { return normalizeState(await request('/knowledge', options)) },
    async getKnowledgeTopics(options) { return (await this.getKnowledgeState(options)).topics },
    async getKnowledgeSummary(options) { return (await this.getKnowledgeState(options)).summary },
    async getKnowledgeTopic(id, options) { return normalizeTopic(await request(`/knowledge/topics/${pathId(id)}`, options)) },
    async updateSelfReportedLevel(id, level, { enabled, signal } = {}) {
      if (enabled !== true) throw new KnowledgeServiceError('CAPABILITY_UNAVAILABLE')
      if (!selfReportedLevels.includes(level)) throw new KnowledgeServiceError('INVALID_SELF_REPORT')
      const response = await request(`/knowledge/topics/${pathId(id)}/self-report`, { signal, method: 'PATCH', body: { selfReportedLevel: level } })
      if (response?.id !== id || response?.selfReportedLevel !== level) invalid()
      return normalizeTopic(response)
    },
  }
}
export const knowledgeService = createKnowledgeService()
