import { test } from 'node:test'
import assert from 'node:assert/strict'
import { QueryObserver } from '@tanstack/react-query'
import { queryClient as client } from '../src/lib/query/queryClient.js'
import { queryKeys, invalidatePages } from '../src/lib/query/queryKeys.js'
import { readSupabaseConfig } from '../src/lib/supabase/config.js'
import { rpc } from '../src/lib/supabase/request.js'
import { normalizeError } from '../src/lib/supabase/errors.js'
import { sessionIdentity } from '../src/lib/auth/sessionIdentity.js'

test('configuration fails closed and errors have shared codes', async () => {
  assert.equal(readSupabaseConfig({}), null)
  assert.equal(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://test.invalid', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_test' }), null)
  assert.ok(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://test.invalid', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }))
  await assert.rejects(rpc('anything'), { code: 'SUPABASE_NOT_CONFIGURED' })
  for (const [error, code] of [[{ code: '42501' }, 'FORBIDDEN'], [{ status: 401 }, 'AUTH_REQUIRED'], [{ code: 'PGRST116' }, 'NOT_FOUND'], [new TypeError('fetch failed'), 'NETWORK_ERROR'], [{}, 'QUERY_ERROR']]) assert.equal(normalizeError(error).code, code)
})
test('identity changes abort transport; same-user token refresh retains the request lifetime', () => {
  sessionIdentity.change('owner-a')
  const signal = sessionIdentity.signal
  sessionIdentity.change('owner-a')
  assert.equal(signal.aborted, false)
  sessionIdentity.change('owner-b')
  assert.equal(signal.aborted, true)
  const next = sessionIdentity.signal
  sessionIdentity.change(null)
  assert.equal(next.aborted, true)
})
test('concurrent reads deduplicate, fresh remounts use cache, expired remounts refresh; writes invalidate only affected pages', async () => {
  try {
    const id = 'query-test-owner'
    let calls = 0
    const options = { queryKey: queryKeys.home(id), queryFn: async () => { calls++; await new Promise(resolve => setTimeout(resolve, 10)); return { revision: calls } }, staleTime: 30 }
    const [first, second] = await Promise.all([client.fetchQuery(options), client.fetchQuery(options)])
    assert.equal(calls, 1)
    assert.deepEqual(first, second)
    await client.fetchQuery(options)
    assert.equal(calls, 1)
    await new Promise(resolve => setTimeout(resolve, 40))
    const observer = new QueryObserver(client, options)
    const unsubscribe = observer.subscribe(() => {})
    await new Promise(resolve => setTimeout(resolve, 30))
    assert.equal(calls, 2)
    assert.equal(client.getQueryData(options.queryKey).revision, 2)
    unsubscribe()
    for (const page of ['today','progress','settings','knowledge','roadmap']) client.setQueryData(queryKeys[page](id), { page })
    await invalidatePages(client, id, ['today','home','progress'])
    for (const page of ['today','home','progress']) assert.equal(client.getQueryState(queryKeys[page](id)).isInvalidated, true)
    for (const page of ['settings','knowledge','roadmap']) assert.equal(client.getQueryState(queryKeys[page](id)).isInvalidated, false)
    assert.equal(client.getQueryData(queryKeys.home('different-owner')), undefined)
    await client.cancelQueries()
    client.clear()
    assert.equal(client.getQueryCache().getAll().length, 0)
  } finally { client.clear() }
})
