import { lazy, Suspense } from 'react'
import SoftAurora from './components/background/SoftAurora.jsx'
import ProtectedContent from './components/ProtectedContent.jsx'
import './App.css'

const ApplicationShell = lazy(() => import('./components/ApplicationShell.jsx'))

export default function App() {
  return (
    <>
      <div className="athena-background" aria-hidden="true">
        <SoftAurora
          speed={0.35}
          scale={1.5}
          brightness={0.8}
          color1="#7C6CFF"
          color2="#37D7FF"
          spectrum={0.25}
          colorSpeed={0.45}
          noiseFrequency={2.2}
          noiseAmplitude={0.85}
          bandHeight={0.52}
          bandSpread={0.75}
          octaveDecay={0.12}
          layerOffset={0.25}
          tilt={0}
          enableMouseInteraction={true}
          mouseInfluence={0.18}
          clickPulse={true}
          intro={true}
          lightMode={false}
          opacity={0.9}
        />
      </div>
      <ProtectedContent><Suspense fallback={<main className="auth-loading" role="status">Loading ATHENA…</main>}><ApplicationShell /></Suspense></ProtectedContent>
    </>
  )
}
