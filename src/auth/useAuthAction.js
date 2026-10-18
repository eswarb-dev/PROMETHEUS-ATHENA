import { useEffect, useRef, useState } from 'react'
import { authErrorMessage } from './authErrors.js'
export default function useAuthAction() {
  const lock = useRef(false)
  const alive = useRef(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const run = async operation => {
    if (lock.current) return
    lock.current = true
    setPending(true); setError('')
    try { return await operation() }
    catch (failure) { if (alive.current) setError(authErrorMessage(failure)); return undefined }
    finally { lock.current = false; if (alive.current) setPending(false) }
  }
  return { pending, error, run }
}
