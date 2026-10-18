import { useState } from 'react'
import { authService } from '../../services/authService.js'
import useAuthAction from '../../auth/useAuthAction.js'
import PasswordField from './PasswordField.jsx'
import AuthError from './AuthError.jsx'
import AuthButton from './AuthButton.jsx'
export default function SignupForm({ navigate, configured }) {
  const [name, setName] = useState(''), [email, setEmail] = useState('')
  const [password, setPassword] = useState(''), [confirm, setConfirm] = useState('')
  const [mismatch, setMismatch] = useState(false)
  const action = useAuthAction()
  return <form className="auth-form" onSubmit={event => {
    event.preventDefault(); if (password !== confirm) { setMismatch(true); return }
    void action.run(async () => { try { const result = await authService.signUp({ name, email, password }); if (!result?.session) navigate('verify', email.trim(), true) } finally { setPassword(''); setConfirm('') } })
  }}>
    <div className="auth-field"><label htmlFor="signup-name">Full name</label><input id="signup-name" autoComplete="name" required maxLength={200} value={name} disabled={action.pending} onChange={event => setName(event.target.value)} pattern={'.*\\S.*'} aria-describedby="auth-error" /></div>
    <div className="auth-field"><label htmlFor="signup-email">Email</label><input id="signup-email" type="email" autoComplete="email" required value={email} disabled={action.pending} onChange={event => setEmail(event.target.value)} aria-describedby="auth-error" /></div>
    <PasswordField id="signup-password" label="Password" autoComplete="new-password" required minLength={8} value={password} disabled={action.pending} onChange={event => { setPassword(event.target.value); setMismatch(false) }} />
    <PasswordField id="signup-confirm" label="Confirm password" autoComplete="new-password" required minLength={8} value={confirm} disabled={action.pending} error={mismatch ? 'Passwords do not match.' : ''} onChange={event => { setConfirm(event.target.value); setMismatch(false) }} />
    <p className="auth-help">Use at least 8 characters. Your learning profile comes after email verification.</p><AuthError>{action.error}</AuthError>
    <AuthButton pending={action.pending} disabled={!configured}>{action.pending ? 'Creating account…' : 'Create Account'}</AuthButton>
    <button className="auth-link" type="button" disabled={action.pending} onClick={() => navigate('login')}>Back to sign in</button>
  </form>
}
