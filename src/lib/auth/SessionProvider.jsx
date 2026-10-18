import { useEffect, useState } from 'react'
import { SessionContext } from './sessionContext.js'
import { supabase } from '../supabase/client.js'
import { queryClient } from '../query/queryClient.js'
import { sessionIdentity } from './sessionIdentity.js'
export function SessionProvider({ children }) {
  const [state, setState] = useState({ resolved: !supabase, session: null })
  useEffect(() => {
    if (!supabase) return
    let active = true
    let version = 0
    let currentId = null
    const apply = session => {
      if (!active) return
      const nextId = session?.user?.id ?? null
      sessionIdentity.change(nextId)
      if (currentId !== nextId) {
        void queryClient.cancelQueries()
        queryClient.clear()
        currentId = nextId
      }
      setState({ resolved: true, session })
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { version++; apply(session) })
    const initialVersion = version
    supabase.auth.getSession().then(({ data, error }) => {
      if (version === initialVersion) apply(error ? null : data.session)
    }).catch(() => { if (version === initialVersion) apply(null) })
    return () => { active = false; subscription.unsubscribe() }
  }, [])
  return <SessionContext.Provider value={{ ...state, user: state.session?.user ?? null, configured: !!supabase }}>{children}</SessionContext.Provider>
}
