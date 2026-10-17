import { useState } from 'react'
import SoftAurora from './components/background/SoftAurora.jsx'
import AthenaDock from './components/navigation/AthenaDock.jsx'
import AthenaDashboard from './components/dashboard/AthenaDashboard.jsx'
import AthenaOnboarding from './components/onboarding/AthenaOnboarding.jsx'
import AthenaProfile from './components/profile/AthenaProfile.jsx'
import { createDemoProfile } from './components/profile/demoProfile.js'
import RoadmapPage from './components/roadmap/RoadmapPage.jsx'
import './App.css'

export default function App() {
  const [activeSection, setActiveSection] = useState('Home')
  const [profile, setProfile] = useState(createDemoProfile)
  const onboarding = new URLSearchParams(window.location.search).get('onboarding') === '1'

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
      {!onboarding && <AthenaDock activeSection={activeSection} onSelect={setActiveSection} />}
      {onboarding ? (
        <AthenaOnboarding />
      ) : activeSection === 'Home' ? (
        <AthenaDashboard />
      ) : activeSection === 'Settings' ? (
        <AthenaProfile profile={profile} onSave={setProfile} />
      ) : activeSection === 'Roadmap' ? (
        <RoadmapPage />
      ) : (
        <main className="foundation-preview">
          <div>
            <h1>PROMETHEUS // ATHENA</h1>
            <p aria-live="polite" aria-atomic="true">{activeSection}</p>
          </div>
        </main>
      )}
    </>
  )
}
