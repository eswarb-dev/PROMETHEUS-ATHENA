import { useEffect, useState } from 'react'
import { SessionContext } from './sessionContext.js'
import { supabase } from '../supabase/client.js'
import { queryClient } from '../query/queryClient.js'
import { sessionIdentity } from './sessionIdentity.js'
export function SessionProvider({ children }) {
  const [state, setState] = useState({ resolved: !supabase, session: null, authEvent: null, recovery: false })
  useEffect(() => {
    if (!supabase) return
    let active = true
    let version = 0
    let currentId = null
    const apply = (session, event = 'INITIAL_SESSION') => {
      if (!active) return
      const nextId = session?.user?.id ?? null
      sessionIdentity.change(nextId)
      if (currentId !== nextId) {
        void queryClient.cancelQueries()
        queryClient.clear()
        currentId = nextId
      }
      setState(previous => ({ resolved: true, session, authEvent: event, recovery: !!session && (event === 'PASSWORD_RECOVERY' || previous.recovery && previous.session?.user?.id === nextId) }))
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => { version++; apply(session, event) })
    const initialVersion = version
    supabase.auth.getSession().then(({ data, error }) => {
      if (version === initialVersion) apply(error ? null : data.session)
    }).catch(() => { if (version === initialVersion) apply(null) })
    return () => { active = false; subscription.unsubscribe() }
  }, [])
  const finishRecovery = () => {
    history.replaceState(null, '', location.pathname)
    setState(previous => ({ ...previous, recovery: false }))
  }
  return <SessionContext.Provider value={{ ...state, user: state.session?.user ?? null, configured: !!supabase, isLoading: !state.resolved, isAuthenticated: !!state.session?.user, finishRecovery }}>{children}</SessionContext.Provider>
}
