import BlurText from './BlurText.jsx'
import GlassSurface from './GlassSurface.jsx'
import AnimatedContent from '../roadmap/AnimatedContent.jsx'
export default function AuthShell({ title, children }) {
  return <main className="auth-page"><header className="auth-brand"><p>PROMETHEUS // ATHENA</p><p>Adaptive Study Mentor</p></header><AnimatedContent distance={18} direction="vertical" duration={0.5} ease="power3.out" initialOpacity={0} animateOpacity scale={0.99} blur={3} trigger="mount" once className="auth-panel-reveal"><GlassSurface width="100%" height="auto" borderRadius={24} refraction renderer="auto" distortionScale={-110} borderWidth={0.055} blur={12} brightness={52} opacity={0.92} displace={0.3} redOffset={0} greenOffset={5} blueOffset={10} backgroundOpacity={0.08} saturation={1} className="auth-glass"><div className="auth-panel"><div role="heading" aria-level={1} tabIndex={-1} className="auth-title"><BlurText text={title} effect="focus" animateBy="words" staggerFrom="start" trigger="load" delay={90} stepDuration={0.3} blur={8} distance={0} loop={false} focusOnHover={false} /></div>{children}</div></GlassSurface></AnimatedContent></main>
}
