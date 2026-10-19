import { useRef, useState } from 'react'
import { preferenceDefinitions, preferenceLabel } from '../../domain/studyPreferences.js'
import SettingsSaveButton from './SettingsSaveButton.jsx'
import SettingsUnavailableState from './SettingsUnavailableState.jsx'
import { changedFields } from './settingsFormatters.js'
import PreferenceFields from '../onboarding/PreferenceFields.jsx'

export default function StudyPreferencesSettings({ settings }) {
  const saved = settings.data.studyPreferences
  const [localDraft, setDraft] = useState(null)
  const revision = useRef(0)
  const [notice, setNotice] = useState('')
  if (!saved) return <SettingsUnavailableState section="Study Preferences" />
  const draft = localDraft ?? saved
  const writable = settings.data.capabilities.preferencesWrite
  const changes = changedFields(draft, saved, preferenceDefinitions.map(([key]) => key))
  const dirty = Object.keys(changes).length > 0
  return <form className="settings-panel" onSubmit={async event => { event.preventDefault(); if (!dirty || settings.pending.preferences) return; const savedRevision = revision.current; if (await settings.updatePreferences(changes)) { if (revision.current === savedRevision) setDraft(null); setNotice('Study preferences confirmed.') } }}><h2>Study Preferences</h2>
    {writable ? <PreferenceFields value={draft} onChange={value => { revision.current++; setDraft(value); setNotice('') }} /> : preferenceDefinitions.map(([key,label])=><div className="settings-readonly" key={key}><h3>{label}</h3><p>{preferenceLabel(key,saved[key])}</p></div>)}
    {writable ? <div className="settings-actions"><button type="button" className="settings-button" onClick={() => { revision.current++; setDraft(null); setNotice(settings.pending.preferences ? 'Draft discarded. The pending save may still complete.' : 'Unsaved changes discarded.') }}>Cancel</button><SettingsSaveButton disabled={!dirty || settings.pending.preferences === true}>{settings.pending.preferences ? 'Saving…' : 'Update Preferences'}</SettingsSaveButton></div> : <p className="settings-help">Preference updates are currently unavailable.</p>}
    {settings.errors.preferences && <p className="settings-error" role="alert">{settings.errors.preferences}</p>}<p role="status" className="settings-notice">{notice}</p>
  </form>
}
