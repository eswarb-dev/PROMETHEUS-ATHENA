import { useEffect, useRef, useState } from 'react'
import { otpLength, maskEmail } from '../../auth/authConfig.js'
import { authService } from '../../services/authService.js'
import useAuthAction from '../../auth/useAuthAction.js'
import AuthError from './AuthError.jsx'
import AuthButton from './AuthButton.jsx'
export default function OtpVerification({ email, sent, navigate }) {
  const [digits, setDigits] = useState(Array(otpLength).fill(''))
  const [until, setUntil] = useState(() => sent ? Date.now() + 60_000 : 0)
  const [now, setNow] = useState(Date.now)
  const [notice, setNotice] = useState('')
  const cells = useRef([])
  const action = useAuthAction()
  const remaining = Math.max(0, Math.ceil((until - now) / 1000))
  useEffect(() => { if (!until) return; const timer = setInterval(() => { const current = Date.now(); setNow(current); if (current >= until) clearInterval(timer) }, 1000); return () => clearInterval(timer) }, [until])
  const input = (index, value) => {
    const numbers = value.replace(/\D/g, '').slice(0, otpLength - index)
    setDigits(current => { const next = [...current]; if (!numbers) next[index] = ''; else [...numbers].forEach((digit, offset) => { next[index + offset] = digit }); return next })
    if (numbers) cells.current[Math.min(otpLength - 1, index + numbers.length)]?.focus()
  }
  return <form className="auth-form" onSubmit={event => { event.preventDefault(); if (digits.some(digit => !digit)) return; void action.run(async () => { try { await authService.verifySignupOtp({ email, token: digits.join('') }) } finally { setDigits(Array(otpLength).fill('')) } }) }}>
    <p className="auth-help">Check the email sent to <strong>{maskEmail(email)}</strong>.</p>
    <p className="auth-help">Use the confirmation link in your email. If it includes a {otpLength}-digit code, you can enter it below instead.</p>
    <fieldset className="auth-otp" disabled={action.pending}><legend>Verification code</legend><div style={{ '--otp-length': otpLength }}>{digits.map((digit, index) => <input id={`auth-otp-${index + 1}`} key={index} ref={node => { cells.current[index] = node }} aria-label={`Digit ${index + 1} of ${otpLength}`} aria-describedby="auth-error" inputMode="numeric" type="text" autoComplete={index === 0 ? 'one-time-code' : 'off'} value={digit} onChange={event => input(index, event.target.value)} onPaste={event => { event.preventDefault(); input(index, event.clipboardData.getData('text')) }} onKeyDown={event => { if (event.key === 'Backspace' && !digit && index) cells.current[index - 1]?.focus(); if (event.key === 'ArrowLeft' && index) cells.current[index - 1]?.focus(); if (event.key === 'ArrowRight' && index + 1 < otpLength) cells.current[index + 1]?.focus() }} />)}</div></fieldset>
    <AuthError>{action.error}</AuthError><p className="auth-notice" aria-live="polite">{notice}</p>
    <AuthButton pending={action.pending} disabled={digits.some(digit => !digit)}>{action.pending ? 'Verifying…' : 'Verify'}</AuthButton>
    <button className="auth-link" type="button" disabled={remaining > 0 || action.pending} onClick={() => { if (Date.now() < until) return; void action.run(async () => { setUntil(Date.now() + 60_000); setNow(Date.now()); await authService.resendSignupOtp(email); setNotice('If verification is available for this email, a new code has been sent.') }) }}>{remaining ? `Resend in ${remaining}s` : 'Resend code'}</button>
    <button className="auth-link" type="button" disabled={action.pending} onClick={() => navigate('signup')}>Change email</button><button className="auth-link" type="button" disabled={action.pending} onClick={() => navigate('login')}>Back to sign in</button>
  </form>
}
