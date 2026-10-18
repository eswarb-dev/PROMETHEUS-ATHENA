import { useState } from 'react'
import { authService } from '../../services/authService.js'
import useAuthAction from '../../auth/useAuthAction.js'
import PasswordField from './PasswordField.jsx'
import AuthError from './AuthError.jsx'
import AuthButton from './AuthButton.jsx'
export default function LoginForm({ navigate, configured }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const action = useAuthAction()
  return <form className="auth-form" onSubmit={event => { event.preventDefault(); void action.run(async () => { try { await authService.signIn(email, password) } finally { setPassword('') } }) }}>
    <div className="auth-field"><label htmlFor="login-email">Email</label><input id="login-email" type="email" autoComplete="email" required value={email} disabled={action.pending} onChange={event => setEmail(event.target.value)} aria-describedby="auth-error" /></div>
    <PasswordField id="login-password" label="Password" autoComplete="current-password" required value={password} disabled={action.pending} onChange={event => setPassword(event.target.value)} />
    <button className="auth-link auth-forgot" type="button" disabled={action.pending} onClick={() => navigate('forgot')}>Forgot password?</button>
    <AuthError>{action.error}</AuthError>
    {action.error === 'Verify your email before signing in.' && <button className="auth-link" type="button" onClick={() => navigate('verify', email)}>Enter verification code</button>}
    <AuthButton pending={action.pending} disabled={!configured}>{action.pending ? 'Signing in…' : 'Sign In'}</AuthButton>
    <p className="auth-switch">New here? <button className="auth-link" type="button" disabled={action.pending} onClick={() => navigate('signup')}>Create account</button></p>
  </form>
}
