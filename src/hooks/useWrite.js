import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from '../lib/auth/sessionContext.js'
import { invalidatePages } from '../lib/query/queryKeys.js'
import { sessionIdentity } from '../lib/auth/sessionIdentity.js'
export default function useWrite(pages) {
  const { user } = useSession()
  const client = useQueryClient()
  const [pending, setPending] = useState({})
  const [errors, setErrors] = useState({})
  const locks = useRef(new Set())
  const mutation = useMutation({ mutationFn: operation => operation() })
  const write = async (key, operation) => {
    const id = user?.id
    if (!id || sessionIdentity.userId !== id || locks.current.has(key)) return false
    locks.current.add(key)
    setPending(value => ({ ...value, [key]: true }))
    setErrors(value => ({ ...value, [key]: '' }))
    try {
      await mutation.mutateAsync(() => operation(id))
      if (sessionIdentity.userId !== id) return false
      await invalidatePages(client, id, pages)
      return true
    } catch {
      if (sessionIdentity.userId === id) setErrors(value => ({ ...value, [key]: 'Could not confirm the update. Refresh to check the last saved state before retrying.' }))
      return false
    } finally {
      locks.current.delete(key)
      if (sessionIdentity.userId === id) setPending(value => ({ ...value, [key]: false }))
    }
  }
  return { pending, errors, write }
}
