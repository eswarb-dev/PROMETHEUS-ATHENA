export class DataError extends Error {
  constructor(code) { super(code); this.name = 'DataError'; this.code = code }
}
export function normalizeError(error) {
  if (error instanceof DataError || error?.name === 'AbortError') return error
  const code = error?.code
  return new DataError(code === '42501' ? 'FORBIDDEN' : ['PGRST116', 'P0002'].includes(code) ? 'NOT_FOUND' : code === 'PGRST301' || error?.status === 401 ? 'AUTH_REQUIRED' : error instanceof TypeError || /fetch|network/i.test(error?.message ?? '') ? 'NETWORK_ERROR' : 'QUERY_ERROR')
}
