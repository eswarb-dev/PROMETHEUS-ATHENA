import { useEffect, useState } from 'react'
import { initialAuthView } from '../../auth/authConfig.js'
import { useSession } from '../../lib/auth/sessionContext.js'
import AuthShell from './AuthShell.jsx'
import LoginForm from './LoginForm.jsx'
import SignupForm from './SignupForm.jsx'
import OtpVerification from './OtpVerification.jsx'
import ForgotPassword from './ForgotPassword.jsx'
import ResetPassword from './ResetPassword.jsx'
import './AuthPage.css'
const titles = { login: 'Welcome back', signup: 'Create your ATHENA account', verify: 'Check your inbox', forgot: 'Reset your password', reset: 'Set a new password' }
export default function AuthPage() {
  const auth = useSession()
  const [view, setView] = useState(() => auth.recovery ? 'reset' : initialAuthView())
  const [verification, setVerification] = useState({ email: '', sent: false })
  const navigate = (next, email = '', sent = false) => {
    setVerification({ email: next === 'verify' ? email : '', sent })
    setView(next)
    history.replaceState(null, '', `${location.pathname}?auth=${next}`)
  }
  useEffect(() => {
    const pop = () => { setView(initialAuthView()); setVerification({ email: '', sent: false }) }
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [])
  const current = auth.recovery ? 'reset' : view === 'verify' && !verification.email ? 'login' : view
  const Form = { login: LoginForm, signup: SignupForm, verify: OtpVerification, forgot: ForgotPassword, reset: ResetPassword }[current]
  return <AuthShell title={titles[current]}>{!auth.configured && <p className="auth-error" role="status">Authentication is not connected yet. Supabase configuration is required.</p>}<Form key={current} navigate={navigate} configured={auth.configured} {...verification} /></AuthShell>
}
