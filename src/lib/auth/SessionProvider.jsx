import { useCallback, useEffect, useRef, useState } from 'react'
import { SessionContext } from './sessionContext.js'
import { supabase } from '../supabase/client.js'
import { queryClient } from '../query/queryClient.js'
import { sessionIdentity } from './sessionIdentity.js'
import { recoveryOwner, rememberRecovery } from '../../auth/recoveryState.js'
import { clearAuthUrlErrors } from '../../auth/authUrlCleanup.js'
export function SessionProvider({ children }) {
  const [state, setState] = useState({ resolved: !supabase, session: null, authEvent: null, recovery: false })
  const recheck = useRef(null)
  const refreshSession = useCallback(() => recheck.current?.(), [])
  useEffect(() => {
    if (!supabase) return
    let active = true
    let version = 0
    let currentId = null
    const apply = (session, event = 'INITIAL_SESSION') => {
      if (!active) return
      const nextId = session?.user?.id ?? null
      if (session?.user?.email_confirmed_at) clearAuthUrlErrors()
      if (event === 'PASSWORD_RECOVERY' && nextId) rememberRecovery(nextId)
      else if (recoveryOwner() !== nextId) rememberRecovery(null)
      const restoredRecovery = !!nextId && recoveryOwner() === nextId
      sessionIdentity.change(nextId)
      if (currentId !== nextId) {
        void queryClient.cancelQueries()
        queryClient.clear()
        currentId = nextId
      }
      setState(previous => ({ resolved: true, session, authEvent: event, recovery: !!session && (restoredRecovery || event === 'PASSWORD_RECOVERY' || previous.recovery && previous.session?.user?.id === nextId) }))
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => { version++; apply(session, event) })
    let checking = false
    recheck.current = async () => {
      if (checking || !active) return
      checking = true
      const checkVersion = version
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error || !data.session) return
        const verified = await supabase.auth.getUser(data.session.access_token)
        if (!verified.error && verified.data.user?.email_confirmed_at && version === checkVersion) apply({ ...data.session, user: verified.data.user }, 'SIGNED_IN')
      } catch { /* Keep the verification screen available when the connection fails. */ }
      finally { checking = false }
    }
    const initialVersion = version
    supabase.auth.getSession().then(({ data, error }) => {
      if (version === initialVersion) apply(error ? null : data.session)
    }).catch(() => { if (version === initialVersion) apply(null) })
    return () => { active = false; recheck.current = null; subscription.unsubscribe() }
  }, [])
  const finishRecovery = () => {
    rememberRecovery(null)
    history.replaceState(null, '', location.pathname)
    setState(previous => ({ ...previous, recovery: false }))
  }
  return <SessionContext.Provider value={{ ...state, user: state.session?.user ?? null, configured: !!supabase, isLoading: !state.resolved, isAuthenticated: !!state.session?.user, finishRecovery, refreshSession }}>{children}</SessionContext.Provider>
}
