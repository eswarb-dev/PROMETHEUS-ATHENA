export class AccountServiceError extends Error {
  constructor(code) { super(code); this.name = 'AccountServiceError'; this.code = code }
}
export function createAccountRequest(baseUrl, fetchImpl) {
  return async function request(path, { signal, method = 'GET', body } = {}) {
    if (!baseUrl?.trim()) throw new AccountServiceError('DATA_SOURCE_NOT_CONFIGURED')
    let base
    try { base = new URL(baseUrl, globalThis.location?.origin); if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw Error() }
    catch { throw new AccountServiceError('INVALID_DATA_SOURCE_CONFIGURATION') }
    const controller = new AbortController()
    const abort = () => controller.abort()
    if (signal?.aborted) controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    const timeout = setTimeout(abort, 15000)
    const multipart = body instanceof FormData
    try {
      const response = await fetchImpl(`${base.href.replace(/\/$/, '')}${path}`, { method, signal: controller.signal, credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json', ...(body && !multipart ? { 'Content-Type': 'application/json' } : {}) }, body: body ? multipart ? body : JSON.stringify(body) : undefined })
      if (!response.ok) throw new AccountServiceError('ACCOUNT_REQUEST_FAILED')
      return await response.json()
    } catch (error) {
      if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError')
      if (error instanceof AccountServiceError) throw error
      throw new AccountServiceError('ACCOUNT_REQUEST_FAILED')
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort) }
  }
}
