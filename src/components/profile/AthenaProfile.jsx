import { useEffect, useRef, useState } from 'react'
import SpotlightCard from './SpotlightCard.jsx'
import ProfileAvatar from './ProfileAvatar.jsx'
import { sampleLearningStats } from './demoProfile.js'
import './AthenaProfile.css'

const timeOptions = [[15, '15 min'], [30, '30 min'], [45, '45 min'], [60, '1 hour'], [90, '1.5 hours'], [120, '2+ hours']]
const imageTypes = ['image/png', 'image/jpeg', 'image/webp']
const imageError = 'Choose a PNG, JPG, or WEBP image under 5 MB.'

export default function AthenaProfile({ profile, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(profile)
  const [profileImagePreview, setProfileImagePreview] = useState(null)
  const [photoError, setPhotoError] = useState('')
  const [status, setStatus] = useState('')
  const fileRef = useRef(null)
  const nameRef = useRef(null)
  const photoRef = useRef(null)
  const pendingRef = useRef(null)
  const editRef = useRef(null)
  const returnFocus = useRef(false)

  useEffect(() => {
    if (editing) nameRef.current?.focus()
    else if (returnFocus.current) { editRef.current?.focus(); returnFocus.current = false }
  }, [editing])

  useEffect(() => () => {
    if (photoRef.current) URL.revokeObjectURL(photoRef.current)
    if (pendingRef.current) {
      pendingRef.current.image.onload = pendingRef.current.image.onerror = null
      URL.revokeObjectURL(pendingRef.current.url)
    }
  }, [])

  const cancelPending = () => {
    if (!pendingRef.current) return
    pendingRef.current.image.onload = pendingRef.current.image.onerror = null
    URL.revokeObjectURL(pendingRef.current.url)
    pendingRef.current = null
  }
  const selectPhoto = event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    cancelPending()
    if (!imageTypes.includes(file.type) || file.size >= 5 * 1024 * 1024) { setPhotoError(imageError); return }
    const url = URL.createObjectURL(file)
    const image = new Image()
    pendingRef.current = { url, image }
    image.onload = () => {
      if (photoRef.current) URL.revokeObjectURL(photoRef.current)
      photoRef.current = url
      pendingRef.current = null
      image.onload = image.onerror = null
      setProfileImagePreview(url)
      setPhotoError('')
      setStatus('Photo preview updated. Nothing has been uploaded.')
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      pendingRef.current = null
      image.onload = image.onerror = null
      setPhotoError('This image could not be opened. Choose another PNG, JPG, or WEBP image under 5 MB.')
    }
    image.src = url
  }
  const removePhoto = () => {
    cancelPending()
    if (photoRef.current) URL.revokeObjectURL(photoRef.current)
    photoRef.current = null
    setProfileImagePreview(null)
    setPhotoError('')
    setStatus('Photo removed. Your name initial is shown.')
  }
  const cancelEdit = () => {
    setDraft(profile)
    setEditing(false)
    returnFocus.current = true
    setStatus('Unsaved profile changes discarded.')
  }
  const valid = draft.account.name.trim() && draft.goal.direction.trim() && draft.goal.description.trim()
  const saveEdit = event => {
    event.preventDefault()
    if (!valid) return
    onSave({ ...draft, account: { ...draft.account, name: draft.account.name.trim() }, goal: { direction: draft.goal.direction.trim(), description: draft.goal.description.trim() } })
    setEditing(false)
    returnFocus.current = true
    setStatus('Profile updated for this preview. Changes reset on reload.')
  }
  const visible = editing ? draft : profile
  const input = (id, label, value, change, ref) => <div className="profile-field"><label htmlFor={id}>{label}</label><input id={id} ref={ref} value={value} onChange={event => change(event.target.value)} required maxLength={160} /></div>

  return <main className="athena-profile">
    <header className="profile-page-header"><p>PROMETHEUS // ATHENA</p><h1>Profile</h1><p>Manage your identity and learning profile.</p><small>UI preview · Sample profile and learning data</small></header>
    <SpotlightCard theme="dark" spotlightColor="#7C6CFF" intensity={0.10} spotlightSize={260} softness={0.82} shape="circle" borderGlow={0.42} proximity={70} smoothing={0.32} grain={0} ambient={false} flare={true} className="athena-identity-card" style={{ '--spotlight-card-surface': 'rgba(12, 18, 35, 0.80)', '--spotlight-card-border': 'rgba(255,255,255,0.08)' }}>
      <div className="profile-identity">
        <div className="profile-photo"><ProfileAvatar name={visible.account.name} imageUrl={profileImagePreview || profile.account.avatarUrl} />
          <button type="button" className="profile-text-button" onClick={() => fileRef.current?.click()}>Edit photo</button>
          {profileImagePreview && <button type="button" className="profile-text-button" onClick={removePhoto}>Remove photo</button>}
          <label className="profile-visually-hidden" htmlFor="profile-photo-input">Choose profile photo</label><input ref={fileRef} className="profile-visually-hidden" tabIndex={-1} type="file" id="profile-photo-input" accept={imageTypes.join(',')} onChange={selectPhoto} aria-describedby="profile-photo-help" />
        </div>
        <div className="profile-identity-text"><h2>{visible.account.name.trim() || 'Your name'}</h2><p>{profile.account.email}</p><span>{visible.goal.direction}</span></div>
        {!editing && <button ref={editRef} type="button" className="profile-button" onClick={() => { setDraft(profile); setEditing(true); setStatus('') }}>Edit Profile</button>}
      </div>
      <p className="profile-photo-help" id="profile-photo-help">PNG, JPG or WEBP under 5 MB. Preview only.</p>
      {photoError && <p className="profile-error" role="alert">{photoError}</p>}
      {editing ? <form className="profile-edit-form" onSubmit={saveEdit}>
        <div className="profile-form-grid">
          {input('profile-name', 'Full name', draft.account.name, name => setDraft(current => ({ ...current, account: { ...current.account, name } })), nameRef)}
          {input('profile-direction', 'Primary direction', draft.goal.direction, direction => setDraft(current => ({ ...current, goal: { ...current.goal, direction } })))}
          {input('profile-goal', 'Current main goal', draft.goal.description, description => setDraft(current => ({ ...current, goal: { ...current.goal, description } })))}
          <div className="profile-field"><label htmlFor="profile-time">Daily study availability</label><select id="profile-time" value={draft.preferences.dailyStudyMinutes} onChange={event => setDraft(current => ({ ...current, preferences: { ...current.preferences, dailyStudyMinutes: Number(event.target.value) } }))}>{timeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="profile-field"><label htmlFor="profile-style">Learning preference</label><select id="profile-style" value={draft.preferences.learningStyle} onChange={event => setDraft(current => ({ ...current, preferences: { ...current.preferences, learningStyle: event.target.value } }))}>{['Build first', 'Theory first', 'Balanced', 'Practice-heavy'].map(value => <option key={value}>{value}</option>)}</select></div>
        </div>
        {!valid && <p className="profile-error">Name, primary direction and main goal are required.</p>}
        <p className="profile-photo-help">Email is read-only. Profile changes apply to this preview only.</p>
        <div className="profile-edit-actions"><button type="button" className="profile-button profile-button-secondary" onClick={cancelEdit}>Cancel</button><button type="submit" className="profile-button" disabled={!valid}>Save Changes</button></div>
      </form> : <dl className="profile-details">
        <div className="profile-detail-goal"><dt>Building toward</dt><dd>{profile.goal.description}</dd></div>
        <div><dt>Daily study availability</dt><dd>{timeOptions.find(([value]) => value === profile.preferences.dailyStudyMinutes)?.[1] || `${profile.preferences.dailyStudyMinutes} min`}</dd></div>
        <div><dt>Learning style</dt><dd>{profile.preferences.learningStyle}</dd></div>
      </dl>}
      <div className="profile-skills"><h3>Current skills <span>Self-reported</span></h3><ul>{profile.skills.map(skill => <li key={skill.name}>{skill.name}</li>)}</ul></div>
      <p className="profile-status" role="status">{status}</p>
    </SpotlightCard>
    <section className="profile-learning" aria-labelledby="profile-learning-title"><h2 id="profile-learning-title">Learning snapshot <span>Sample data</span></h2><dl>{sampleLearningStats.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
  </main>
}
