import { useState } from 'react'
import { authService } from '../../services/authService.js'
import { useSession } from '../../lib/auth/sessionContext.js'
import useAuthAction from '../../auth/useAuthAction.js'
import PasswordField from './PasswordField.jsx'
import AuthButton from './AuthButton.jsx'
import AuthError from './AuthError.jsx'
export default function ResetPassword({ navigate }) {
  const auth = useSession()
  const [password, setPassword] = useState(''), [confirm, setConfirm] = useState('')
  const [done, setDone] = useState(false), [mismatch, setMismatch] = useState(false)
  const action = useAuthAction()
  if (done) return <div className="auth-form"><p className="auth-notice" role="status">Password updated successfully.</p><button className="auth-link" type="button" onClick={auth.finishRecovery}>Continue to ATHENA</button></div>
  if (!auth.recovery || !auth.user) return <div className="auth-form"><p className="auth-help">This recovery link is invalid or has expired. Request fresh reset instructions.</p><button className="auth-link" type="button" onClick={() => navigate('forgot')}>Request reset instructions</button></div>
  return <form className="auth-form" onSubmit={event => { event.preventDefault(); if (password !== confirm) { setMismatch(true); return } void action.run(async () => { try { await authService.updateRecoveredPassword(password); setDone(true) } finally { setPassword(''); setConfirm('') } }) }}>
    <PasswordField id="reset-password" label="New password" autoComplete="new-password" required minLength={8} disabled={action.pending} value={password} onChange={event => { setPassword(event.target.value); setMismatch(false) }} />
    <PasswordField id="reset-confirm" label="Confirm password" autoComplete="new-password" required minLength={8} disabled={action.pending} value={confirm} error={mismatch ? 'Passwords do not match.' : ''} onChange={event => { setConfirm(event.target.value); setMismatch(false) }} />
    <AuthError>{action.error}</AuthError><AuthButton pending={action.pending}>{action.pending ? 'Updating password…' : 'Update Password'}</AuthButton>
  </form>
}
