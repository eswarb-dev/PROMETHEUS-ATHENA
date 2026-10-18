import { useState } from 'react'
import { authService } from '../../services/authService.js'
import useAuthAction from '../../auth/useAuthAction.js'
import AuthError from './AuthError.jsx'
import AuthButton from './AuthButton.jsx'
export default function ForgotPassword({ navigate, configured }) {
  const [email, setEmail] = useState(''), [sent, setSent] = useState(false)
  const action = useAuthAction()
  return <form className="auth-form" onSubmit={event => { event.preventDefault(); void action.run(async () => { await authService.requestPasswordReset(email); setSent(true); setEmail('') }) }}>
    {sent ? <p className="auth-notice" role="status">If an ATHENA account exists for this email, reset instructions have been sent.</p> : <><p className="auth-help">Enter your email to request password reset instructions.</p><div className="auth-field"><label htmlFor="recovery-email">Email</label><input id="recovery-email" type="email" autoComplete="email" required disabled={action.pending} value={email} onChange={event => setEmail(event.target.value)} aria-describedby="auth-error" /></div><AuthError>{action.error}</AuthError><AuthButton pending={action.pending} disabled={!configured}>{action.pending ? 'Sending…' : 'Send reset instructions'}</AuthButton></>}
    <button className="auth-link" type="button" disabled={action.pending} onClick={() => navigate('login')}>Back to sign in</button>
  </form>
}
