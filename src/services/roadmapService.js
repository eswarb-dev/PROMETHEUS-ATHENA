import { roadmapStatus } from '../components/roadmap/roadmapStatus.js'

export class RoadmapServiceError extends Error {
  constructor(code) { super(code); this.name = 'RoadmapServiceError'; this.code = code }
}

const invalid = () => { throw new RoadmapServiceError('INVALID_ROADMAP_RESPONSE') }
const record = value => value && typeof value === 'object' && !Array.isArray(value)
const text = value => typeof value === 'string' && value.trim().length > 0
const optional = (value, check) => value == null || check(value)
const finite = value => typeof value === 'number' && Number.isFinite(value)
const unique = values => new Set(values.map(value => value.id)).size === values.length

function validateRoadmap(value) {
  if (!record(value) || !text(value.id) || !text(value.title) ||
      !optional(value.goal, value => typeof value === 'string') ||
      !optional(value.progressPercent, value => finite(value) && value >= 0 && value <= 100) ||
      !optional(value.estimatedRemainingMinutes, value => finite(value) && value >= 0)) invalid()
  return value
}

function validateSection(value) {
  if (!record(value) || !text(value.id) || !text(value.roadmapId) || !text(value.title) || !optional(value.order, finite)) invalid()
  return value
}

function validateTopic(value) {
  if (!record(value) || !text(value.id) || !text(value.sectionId) || !text(value.title) || !Object.hasOwn(roadmapStatus, value.status) ||
      !optional(value.description, value => typeof value === 'string') || !optional(value.order, finite) ||
      !optional(value.estimatedMinutes, value => finite(value) && value >= 0) ||
      !optional(value.selfReportedLevel, value => typeof value === 'string') ||
      !optional(value.verifiedLevel, value => typeof value === 'string') ||
      !optional(value.confidenceScore, value => finite(value) && value >= 0 && value <= 1) ||
      !optional(value.prerequisiteTopicIds, value => Array.isArray(value) && value.every(text)) ||
      !optional(value.suggestedByAthena, value => typeof value === 'boolean')) invalid()
  return value
}

// The factory also lets contract tests provide a transport without application fixtures.
export function createRoadmapService(baseUrl = import.meta.env?.VITE_API_BASE_URL, fetchImpl = globalThis.fetch) {
  async function request(path, { signal, nullable = false } = {}) {
    if (!baseUrl?.trim()) throw new RoadmapServiceError('DATA_SOURCE_NOT_CONFIGURED')
    let base
    try {
      base = new URL(baseUrl, globalThis.location?.origin)
      if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw Error()
    } catch { throw new RoadmapServiceError('INVALID_DATA_SOURCE_CONFIGURATION') }
    const controller = new AbortController()
    const abort = () => controller.abort()
    if (signal?.aborted) controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    const timeout = setTimeout(abort, 15000)
    try {
      const response = await fetchImpl(`${base.href.replace(/\/$/, '')}${path}`, { signal: controller.signal, headers: { Accept: 'application/json' }, cache: 'no-store' })
      if (nullable && [204, 404].includes(response.status)) return null
      if (!response.ok) throw new RoadmapServiceError('ROADMAP_REQUEST_FAILED')
      return await response.json()
    } catch (error) {
      if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError')
      if (error instanceof RoadmapServiceError) throw error
      throw new RoadmapServiceError('ROADMAP_REQUEST_FAILED')
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort) }
  }
  const list = async (path, validate, options) => {
    const value = await request(path, options)
    if (!Array.isArray(value)) invalid()
    value.forEach(validate)
    if (!unique(value)) invalid()
    return value
  }
  return {
    async getActiveRoadmap(options) {
      const value = await request('/roadmaps/active', { ...options, nullable: true })
      return value === null ? null : validateRoadmap(value)
    },
    getRoadmapSections: (id, options) => list(`/roadmaps/${encodeURIComponent(id)}/sections`, validateSection, options),
    getRoadmapTopics: (id, options) => list(`/roadmaps/${encodeURIComponent(id)}/topics`, validateTopic, options),
    async getTopic(id, options) { return validateTopic(await request(`/topics/${encodeURIComponent(id)}`, options)) },
    async loadActiveRoadmap(options) {
      const roadmap = await this.getActiveRoadmap(options)
      if (!roadmap) return null
      const [sections, topics] = await Promise.all([this.getRoadmapSections(roadmap.id, options), this.getRoadmapTopics(roadmap.id, options)])
      const sectionIds = new Set(sections.map(section => section.id))
      if (sections.some(section => section.roadmapId !== roadmap.id) || topics.some(topic => !sectionIds.has(topic.sectionId))) invalid()
      const order = (a, b) => (a.order ?? 0) - (b.order ?? 0)
      return { roadmap, sections: [...sections].sort(order), topics: [...topics].sort(order) }
    },
  }
}

export const roadmapService = createRoadmapService()
