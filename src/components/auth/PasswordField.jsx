import { useState } from 'react'
export default function PasswordField({ id, label, error, ...props }) {
  const [shown, setShown] = useState(false)
  return <div className="auth-field"><label htmlFor={id}>{label}</label><div className="auth-password"><input {...props} id={id} type={shown ? 'text' : 'password'} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : 'auth-error'} /><button type="button" disabled={props.disabled} aria-label={`${shown ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={shown} onClick={() => setShown(value => !value)}>{shown ? 'Hide' : 'Show'}</button></div>{error && <small className="auth-error" id={`${id}-error`}>{error}</small>}</div>
}
