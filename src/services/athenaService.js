import { publicToolNames, safeProgressLabels } from '../components/athena/athenaStatus.js'

export class AthenaServiceError extends Error {
  constructor(code) { super(code); this.name = 'AthenaServiceError'; this.code = code }
}
const fail = () => { throw new AthenaServiceError('INVALID_ATHENA_RESPONSE') }
const record = value => value && typeof value === 'object' && !Array.isArray(value)
const text = value => typeof value === 'string' && value.trim().length > 0
const stamp = value => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
const unique = items => { if (new Set(items.map(item => item.id)).size !== items.length) fail(); return items }
const idPath = id => { if (!text(id) || ['.', '..'].includes(id)) fail(); return encodeURIComponent(id) }
export function normalizeMessage(value, conversationId) {
  if (!record(value) || !text(value.id) || value.conversationId !== conversationId || !['user', 'assistant'].includes(value.role) || typeof value.content !== 'string' || !['pending', 'streaming', 'done', 'failed', 'cancelled'].includes(value.status) || !stamp(value.createdAt)) fail()
  if (value.progress != null && !Array.isArray(value.progress) || value.toolCalls != null && !Array.isArray(value.toolCalls)) fail()
  const progress = unique((value.progress ?? []).filter(step => record(step) && text(step.id) && safeProgressLabels.has(step.label) && ['idle', 'running', 'done', 'error'].includes(step.status)).map(step => ({ id: step.id, label: step.label, status: step.status })))
  const toolCalls = unique((value.toolCalls ?? []).filter(call => record(call) && text(call.id) && publicToolNames.has(call.name) && typeof call.argument === 'string' && ['idle', 'running', 'done', 'error'].includes(call.status)).map(call => ({ id: call.id, name: call.name, argument: call.argument, kind: ['search', 'file', 'edit'].includes(call.kind) ? call.kind : 'search', status: call.status, expectedMs: Number.isFinite(call.expectedMs) && call.expectedMs > 0 ? call.expectedMs : undefined, retryable: call.retryable === true })))
  return { id: value.id, conversationId, role: value.role, content: value.content, status: value.status, createdAt: value.createdAt, progress, toolCalls }
}
function conversation(value) {
  if (!record(value) || !text(value.id) || !text(value.title) || !stamp(value.createdAt) || !stamp(value.updatedAt)) fail()
  return { id: value.id, title: value.title, createdAt: value.createdAt, updatedAt: value.updatedAt }
}
function capabilities(value) {
  if (!record(value)) fail()
  const flags = ['chat', 'streaming', 'stop', 'commands', 'toolCalls', 'progressTrace', 'retryMessage', 'retryCall', 'sourceTargeting']
  if (flags.some(key => value[key] !== undefined && typeof value[key] !== 'boolean')) fail()
  const result = Object.fromEntries(flags.map(key => [key, value[key] === true]))
  const options = key => {
    if (value[key] == null) return []
    if (!Array.isArray(value[key])) fail()
    const rows = value[key].map(row => { if (!record(row) || !text(row.key) || !text(row.name) || typeof row.description !== 'string') fail(); return { key: row.key, name: row.name, description: row.description } })
    if (new Set(rows.map(row => row.key)).size !== rows.length) fail()
    return rows
  }
  return { ...result, streaming: result.streaming && value.streamProtocol === 'athena-snapshot-v1', attachments: false, dictation: false, sources: result.sourceTargeting ? options('sources') : [], commandOptions: result.commands ? options('commandOptions').filter(row => /^\/[a-z][a-z0-9-]*$/.test(row.name)) : [] }
}
export function createAthenaService(baseUrl = import.meta.env?.VITE_API_BASE_URL, fetchImpl = globalThis.fetch) {
  async function request(path, { signal, method = 'GET', body, onSnapshot, conversationId } = {}) {
    if (!baseUrl?.trim()) throw new AthenaServiceError('DATA_SOURCE_NOT_CONFIGURED')
    let base
    try { base = new URL(baseUrl, globalThis.location?.origin); if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw Error() }
    catch { throw new AthenaServiceError('INVALID_DATA_SOURCE_CONFIGURATION') }
    const controller = new AbortController()
    const abort = () => controller.abort()
    if (signal?.aborted) controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    const timeout = setTimeout(abort, onSnapshot ? 120000 : 30000)
    let reader
    try {
      const response = await fetchImpl(`${base.href.replace(/\/$/, '')}${path}`, { method, signal: controller.signal, headers: { Accept: onSnapshot ? 'text/event-stream' : 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' })
      if (!response.ok) throw new AthenaServiceError('ATHENA_REQUEST_FAILED')
      if (!onSnapshot || !response.headers.get('content-type')?.includes('text/event-stream')) return await response.json()
      reader = response.body?.getReader()
      if (!reader) fail()
      const decoder = new TextDecoder(); let buffer = ''; let last = null; let seq = -1
      const accept = frame => {
        const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
        if (!data) return
        const event = JSON.parse(data)
        if (!Number.isSafeInteger(event.sequence) || event.sequence < 0) fail()
        if (event.sequence <= seq) return
        const next = normalizeSnapshot(event, conversationId)
        if (last && next.requestId !== last.requestId) fail()
        seq = event.sequence; last = next
        if (!controller.signal.aborted) onSnapshot(next)
      }
      while (true) {
        const chunk = await reader.read()
        if (controller.signal.aborted) throw new DOMException('Request aborted', 'AbortError')
        buffer = (buffer + decoder.decode(chunk.value, { stream: !chunk.done })).replace(/\r\n/g, '\n')
        if (buffer.length > 1000000) fail()
        let boundary
        while ((boundary = buffer.indexOf('\n\n')) >= 0) { accept(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 2) }
        if (chunk.done) break
      }
      if (buffer.trim()) accept(buffer)
      if (!last || !['done', 'failed', 'cancelled'].includes(last.messages.findLast(message => message.role === 'assistant')?.status)) throw new AthenaServiceError('INCOMPLETE_ATHENA_RESPONSE')
      return last
    } catch (error) {
      if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError')
      if (error instanceof AthenaServiceError) throw error
      throw new AthenaServiceError('ATHENA_REQUEST_FAILED')
    } finally { if (reader) await reader.cancel().catch(() => {}); clearTimeout(timeout); signal?.removeEventListener('abort', abort) }
  }
  const api = {
    async getCapabilities(options) { return capabilities(await request('/athena/capabilities', options)) },
    async getConversations(options) { const data = await request('/athena/conversations', options); if (!Array.isArray(data)) fail(); return unique(data.map(conversation)) },
    async getConversation(id, options) { const item = conversation(await request(`/athena/conversations/${idPath(id)}`, options)); if (item.id !== id) fail(); return item },
    async createConversation(options) { return conversation(await request('/athena/conversations', { ...options, method: 'POST', body: {} })) },
    async getMessages(id, options) { const data = await request(`/athena/conversations/${idPath(id)}/messages`, options); if (!Array.isArray(data)) fail(); return unique(data.map(item => normalizeMessage(item, id))) },
    async sendMessage(id, payload, { signal, streaming = false, onSnapshot } = {}) {
      if (!text(payload?.content)) throw new AthenaServiceError('EMPTY_MESSAGE')
      return normalizeSnapshot(await request(`/athena/conversations/${idPath(id)}/messages`, { method: 'POST', body: { content: payload.content }, signal, conversationId: id, onSnapshot: streaming ? onSnapshot : undefined }), id)
    },
    async stopResponse(id, options) { const data = await request(`/athena/requests/${idPath(id)}/stop`, { ...options, method: 'POST', body: {} }); if (data?.status !== 'cancelled') throw new AthenaServiceError('CANCELLATION_UNCONFIRMED'); return data.status },
    async retryMessage(id, conversationId, options) { return normalizeSnapshot(await request(`/athena/messages/${idPath(id)}/retry`, { ...options, method: 'POST', body: {} }), conversationId) },
    async retryCall(id, conversationId, options) { return normalizeSnapshot(await request(`/athena/calls/${idPath(id)}/retry`, { ...options, method: 'POST', body: {} }), conversationId) },
  }
  return api
}
function normalizeSnapshot(value, id) {
  if (!record(value) || !text(value.requestId) || !Array.isArray(value.messages)) fail()
  const messages = unique(value.messages.map(item => normalizeMessage(item, id)))
  if (!messages.length) fail()
  return { requestId: value.requestId, messages }
}
export const athenaService = createAthenaService()
