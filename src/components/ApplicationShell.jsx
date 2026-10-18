import { lazy, Suspense, useState } from 'react'
import AthenaDock from './navigation/AthenaDock.jsx'
import AthenaDashboard from './dashboard/AthenaDashboard.jsx'
import RoadmapPage from './roadmap/RoadmapPage.jsx'
const TodayPage = lazy(() => import('./today/TodayPage.jsx'))
const KnowledgePage = lazy(() => import('./knowledge/KnowledgePage.jsx'))
const AthenaPage = lazy(() => import('./athena/AthenaPage.jsx'))
const ProgressPage = lazy(() => import('./progress/ProgressPage.jsx'))
const SettingsPage = lazy(() => import('./settings/SettingsPage.jsx'))
export default function ApplicationShell() {
  const [activeSection, setActiveSection] = useState('Home')
  const Page = { Home: AthenaDashboard, Roadmap: RoadmapPage, Today: TodayPage, Knowledge: KnowledgePage, ATHENA: AthenaPage, Progress: ProgressPage, Settings: SettingsPage }[activeSection]
  return <><AthenaDock activeSection={activeSection} onSelect={setActiveSection} /><Suspense fallback={<main className="foundation-preview" role="status">Loading {activeSection}…</main>}><Page /></Suspense></>
}
