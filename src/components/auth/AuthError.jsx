export default function AuthError({ children }) {
  return <p className="auth-error" id="auth-error" aria-live="polite">{children}</p>
}
