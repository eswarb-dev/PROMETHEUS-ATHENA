import { useSession } from '../lib/auth/sessionContext.js'
import useAuthProfile from '../hooks/useAuthProfile.js'
import AuthPage from './auth/AuthPage.jsx'
import AthenaOnboarding from './onboarding/AthenaOnboarding.jsx'
import { authService } from '../services/authService.js'
import { useQueryClient } from '@tanstack/react-query'
import { invalidatePages } from '../lib/query/queryKeys.js'
import useAuthAction from '../auth/useAuthAction.js'
import { useEffect } from 'react'
import { requestWelcomeMail } from '../services/welcomeMailService.js'

function AuthenticatedContent({ children }) {
  const profile = useAuthProfile()
  const client = useQueryClient()
  const { user } = useSession()
  const logout = useAuthAction()
  useEffect(() => {
    if (profile.data?.onboardingCompleted === true) void requestWelcomeMail(user.id)
  }, [profile.data?.onboardingCompleted, user.id])
  if (profile.status === 'loading') return <main className="auth-loading" role="status">Loading your learning profile…</main>
  if (profile.status !== 'loaded') return <main className="auth-loading"><p role="alert">Couldn't confirm your learning profile.</p><button type="button" onClick={() => profile.retry()}>Retry</button><button type="button" disabled={logout.pending} onClick={() => { void logout.run(() => authService.signOut()) }}>Sign out</button><p aria-live="polite">{logout.error}</p></main>
  const preview = import.meta.env.DEV && new URLSearchParams(location.search).get('onboarding') === '1'
  if (profile.data.onboardingCompleted !== true || preview) return <AthenaOnboarding key={user.id} user={user} profile={profile.data} preview={preview} onComplete={async () => {
    history.replaceState(null, '', location.pathname)
    await invalidatePages(client, user.id, ['onboarding', 'settings', 'home', 'knowledge', 'roadmap'])
  }} />
  return children
}
export default function ProtectedContent({ children }) {
  const auth = useSession()
  if (!auth.resolved) return <main className="auth-loading" role="status">Restoring your session…</main>
  const reset = new URLSearchParams(location.search).get('auth') === 'reset'
  const preview = import.meta.env.DEV && new URLSearchParams(location.search).get('onboarding') === '1'
  if (preview && !auth.user) return <AthenaOnboarding preview />
  if (!auth.user || auth.recovery || reset) return <AuthPage key={auth.user?.id ?? 'anonymous'} />
  return <AuthenticatedContent key={auth.user.id}>{children}</AuthenticatedContent>
}
