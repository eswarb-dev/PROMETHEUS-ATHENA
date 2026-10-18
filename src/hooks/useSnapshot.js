import { useQuery } from '@tanstack/react-query'
import { useSession } from '../lib/auth/sessionContext.js'
export default function useSnapshot(key, load, { staleTime = 60_000, empty = () => false } = {}) {
  const auth = useSession()
  const enabled = auth.configured && auth.resolved && !!auth.user?.id
  const query = useQuery({ queryKey: key(auth.user?.id), queryFn: load, enabled, staleTime })
  const status = !auth.configured ? 'unavailable' : !auth.resolved ? 'loading' : !auth.user ? 'auth-required' : query.isPending ? 'loading' : query.isError && !query.data ? 'error' : empty(query.data) ? 'empty' : 'loaded'
  return { status, data: enabled ? query.data ?? null : null, retry: query.refetch, query, user: auth.user }
}
