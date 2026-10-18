import { useEffect, useRef, useState } from 'react'
import SpotlightCard from '../profile/SpotlightCard.jsx'
import ProfileAvatar from '../profile/ProfileAvatar.jsx'
import SettingsSaveButton from './SettingsSaveButton.jsx'
import SettingsUnavailableState from './SettingsUnavailableState.jsx'
import { changedFields } from './settingsFormatters.js'
import { selfReportOptions } from '../../domain/studyPreferences.js'

const fields = [['name', 'Full name'], ['direction', 'Primary direction'], ['goal', 'Current main goal']]
export default function ProfileSettings({ settings }) {
  const profile = settings.data.profile
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({})
  const [notice, setNotice] = useState('')
  const revision = useRef(0)
  const file = useRef(null)
  const nameInput = useRef(null)
  const editButton = useRef(null)
  const returnFocus = useRef(false)
  useEffect(() => { if (editing) nameInput.current?.focus(); else if (returnFocus.current) { editButton.current?.focus(); returnFocus.current = false } }, [editing])
  if (!profile) return <SettingsUnavailableState section="Profile" />
  const changes = changedFields(draft, profile, fields.map(([key]) => key))
  const dirty = Object.keys(changes).length > 0
  const valid = Object.values(changes).every(value => typeof value === 'string' && value.trim())
  const edit = () => { revision.current++; setDraft(Object.fromEntries(fields.map(([key]) => [key, profile[key] ?? '']))); setEditing(true); setNotice('') }
  const save = async event => {
    event.preventDefault(); if (!dirty || !valid || settings.pending.profile) return
    const savedRevision = revision.current
    const ok = await settings.updateProfile(changes)
    if (ok) { setNotice('Profile changes confirmed.'); if (revision.current === savedRevision) { returnFocus.current = true; setEditing(false) } }
  }
  return <><SpotlightCard theme="dark" spotlightColor="#7C6CFF" intensity={0.10} spotlightSize={260} softness={0.82} shape="circle" borderGlow={0.42} proximity={70} smoothing={0.32} grain={0} ambient={false} flare={true} className="settings-identity" style={{ '--spotlight-card-surface': 'rgba(12,18,35,0.82)' }}>
    <div className="profile-identity"><ProfileAvatar name={profile.name} imageUrl={profile.avatarUrl} /><div className="profile-identity-text"><h2>{profile.name?.trim() || 'Name not provided'}</h2>{profile.email && <p>{profile.email}</p>}{profile.direction && <span>{profile.direction}</span>}</div>{settings.data.capabilities.profileWrite && !editing && <button ref={editButton} type="button" className="settings-button" onClick={edit}>Edit Profile</button>}</div>
    {profile.goal && <div className="settings-goal"><h3>Building toward</h3><p>{profile.goal}</p></div>}
    {profile.skills && <section className="settings-skills"><h3>Skills · Self-reported</h3>{profile.skills.length ? <ul>{profile.skills.map(skill => <li key={skill.name}>{skill.name}{skill.selfReportedLevel && <span> · {selfReportOptions.find(([key]) => key === skill.selfReportedLevel)?.[1]}</span>}</li>)}</ul> : <p>No skills reported.</p>}</section>}
    {settings.data.capabilities.avatarUpload && <div className="settings-avatar-upload"><label htmlFor="settings-avatar">Upload profile photo</label><input ref={file} id="settings-avatar" type="file" accept="image/png,image/jpeg,image/webp" disabled={settings.pending.avatar === true} onChange={async event => { const chosen = event.target.files?.[0]; event.target.value = ''; if (!chosen) return; if (!['image/png', 'image/jpeg', 'image/webp'].includes(chosen.type) || chosen.size >= 5 * 1024 * 1024) { setNotice('Choose a PNG, JPG or WEBP under 5 MB.'); return }; if (await settings.uploadAvatar(chosen)) setNotice('Profile photo confirmed.') }} /><small>PNG, JPG or WEBP under 5 MB.</small></div>}
  </SpotlightCard>
    {editing && <form className="settings-panel settings-profile-form" onSubmit={save}><h2>Edit profile</h2><div className="settings-fields">{fields.map(([key, label]) => <div className="profile-field" key={key}><label htmlFor={`settings-${key}`}>{label}</label><input id={`settings-${key}`} ref={key === 'name' ? nameInput : undefined} value={draft[key] ?? ''} maxLength={key === 'goal' ? 1000 : 160} onChange={event => { revision.current++; setDraft(value => ({ ...value, [key]: event.target.value })) }} /></div>)}</div><p>Email and skills are read-only.</p><div className="settings-actions"><button type="button" className="settings-button" onClick={() => { revision.current++; returnFocus.current = true; setEditing(false); setDraft({}); setNotice(settings.pending.profile ? 'Draft discarded. The pending save may still complete.' : 'Unsaved changes discarded.') }}>Cancel</button><SettingsSaveButton disabled={!dirty || !valid || settings.pending.profile === true}>{settings.pending.profile ? 'Saving…' : 'Save Changes'}</SettingsSaveButton></div></form>}
    {!settings.data.capabilities.profileWrite && <p className="settings-help">Profile editing is currently unavailable.</p>}
    {(settings.errors.profile || settings.errors.avatar) && <p role="alert" className="settings-error">{settings.errors.profile || settings.errors.avatar}</p>}<p role="status" className="settings-notice">{notice}</p>
  </>
}
