import { useState } from 'react'
import useSettings from '../../hooks/useSettings.js'
import DataAccessState from '../DataAccessState.jsx'
import PillNav from '../knowledge/PillNav.jsx'
import ProfileSettings from './ProfileSettings.jsx'
import StudyPreferencesSettings from './StudyPreferencesSettings.jsx'
import NotificationSettings from './NotificationSettings.jsx'
import AccountSettings from './AccountSettings.jsx'
import SettingsSkeleton from './SettingsSkeleton.jsx'
import SettingsUnavailableState from './SettingsUnavailableState.jsx'
import SettingsErrorState from './SettingsErrorState.jsx'
import { settingsSections } from './settingsFormatters.js'
import '../profile/AthenaProfile.css'
import './SettingsPage.css'

export default function SettingsPage() {
  const settings = useSettings()
  const [activeSettingsSection, setActiveSettingsSection] = useState(0)
  const Section = [ProfileSettings, StudyPreferencesSettings, NotificationSettings, AccountSettings][activeSettingsSection]
  return <main className="athena-settings"><header className="settings-page-header"><p>PROMETHEUS // ATHENA</p><h1>Settings</h1><p>Manage your profile, study preferences and account.</p></header>
    {settings.status === 'loading' && <SettingsSkeleton />}
    {settings.status === 'auth-required' && <DataAccessState />}
    {settings.status === 'unavailable' && <SettingsUnavailableState />}
    {settings.status === 'error' && <SettingsErrorState onRetry={settings.retry} />}
    {settings.status === 'deleted' && <section className="settings-panel" role="status"><h2>Account deletion confirmed.</h2><p>Your account service confirmed that the account was deleted.</p></section>}
    {settings.status === 'loaded' && <><div className="settings-tabs"><PillNav items={settingsSections} activeItemIndex={activeSettingsSection} onItemClick={(_, index) => setActiveSettingsSection(index)} theme="dark" layout="joined" itemStyle="pill" hoverEffect="glide" indicator="pill" surface="glass" size="sm" highlightColor="#7C6CFF" highlightTextColor="#080D1A" barColor="rgba(12,18,35,0.72)" textColor="#F5F7FF" bounce={0.16} stretch={0.28} collapse="auto" intro={true} ariaLabel="Settings sections" /></div><Section key={activeSettingsSection} settings={settings} /></>}
  </main>
}
