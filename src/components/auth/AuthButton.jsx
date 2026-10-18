import StarBorder from './StarBorder.jsx'
export default function AuthButton({ pending, children, ...props }) {
  return <StarBorder {...props} type="submit" className="auth-primary" disabled={props.disabled || pending} aria-busy={pending} color="#7C6CFF" trailColor="#37D7FF" duration={4.8} stars={1} trailLength={0.22} thickness={1} radius={12} glow={0.42} hover={pending ? 'none' : 'brighten'} sparkle={false} clickPulse={!pending} theme="dark" backgroundColor="rgba(12,18,35,0.94)" textColor="#F5F7FF">{children}</StarBorder>
}
