import SpecularButton from '../today/SpecularButton.jsx'

export default function SettingsSaveButton({ children, disabled }) {
  return <SpecularButton type="submit" size="md" radius={14} tint="#7C6CFF" tintOpacity={0.10} textColor="#F5F7FF" lineColor="#7C6CFF" baseColor="#29304A" intensity={0.8} idleIntensity={0.22} shineSize={10} shineFade={32} thickness={1.1} glow={0.65} followMouse={true} proximity={180} autoAnimate={false} disabled={disabled}>{children}</SpecularButton>
}
