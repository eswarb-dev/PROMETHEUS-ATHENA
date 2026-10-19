import { useEffect, useRef, useState } from 'react'
import Stepper, { Step } from './Stepper.jsx'
import { preferenceDefinitions, preferenceLabel, selfReportOptions, validPreference, normalizeOnboarding } from '../../domain/studyPreferences.js'
import { onboardingService } from '../../services/onboardingService.js'
import './AthenaOnboarding.css'
import DirectionSelector from './DirectionSelector.jsx'
import PreferenceFields from './PreferenceFields.jsx'
import ReminderFields from './ReminderFields.jsx'
import { reminderOptions, needsWhatsApp, validPhone, maskPhone } from '../../domain/reminderPreferences.js'

const skillOptions = ['Python', 'Java', 'C / C++', 'JavaScript', 'React', 'Node.js', 'SQL', 'Git', 'Machine Learning', 'Deep Learning', 'RAG', 'Cloud', 'UI / UX', 'DSA']
const studyOptions = preferenceDefinitions.map(([key, label, options]) => [key, key === 'dailyStudyMinutes' ? 'Available time per day' : key === 'taskSize' ? 'Preferred task size' : label, options])

function StepHeading({ title, children }) {
  return <div className="onboarding-step-heading"><h2>{title}</h2>{children && <p>{children}</p>}</div>
}

export default function AthenaOnboarding({ user, profile, preview = false, onComplete }) {
  const [step, setStep] = useState(1)
  const [account, setAccount] = useState({ name: profile?.name ?? user?.user_metadata?.name ?? '', email: user?.email ?? '', password: '', confirmPassword: '' })
  const [goal, setGoal] = useState({ description: '' })
  const [directions, setDirections] = useState([])
  const [skills, setSkills] = useState([])
  const [startingFromScratch, setStartingFromScratch] = useState(false)
  const [customSkill, setCustomSkill] = useState('')
  const [studyPreferences, setStudyPreferences] = useState({ dailyStudyMinutes: '', studyPeriod: '', learningStyle: '', taskSize: '' })
  const [notifications, setNotifications] = useState({ email: null, whatsapp: null })
  const [touched, setTouched] = useState({})
  const [shown, setShown] = useState({})
  const [capabilities, setCapabilities] = useState(null)
  const [capabilityStatus, setCapabilityStatus] = useState('loading')
  const [capabilityAttempt, setCapabilityAttempt] = useState(0)
  const [pending, setPending] = useState(false)
  const [submissionError, setSubmissionError] = useState('')
  const createdAccount = user ? { id: user.id, email: user.email } : null
  const lifecycle = useRef(null)
  const submission = useRef(null)
  useEffect(() => {
    const controller = new AbortController(); lifecycle.current = controller
    Promise.resolve().then(async () => {
      if (controller.signal.aborted) return
      try { const data = await onboardingService.getOnboardingCapabilities({ signal: controller.signal }); if (!controller.signal.aborted) { setCapabilities(data); setCapabilityStatus('loaded') } }
      catch (error) { if (!controller.signal.aborted) setCapabilityStatus(error.code === 'DATA_SOURCE_NOT_CONFIGURED' ? 'unavailable' : 'error') }
    })
    return () => { controller.abort(); submission.current?.abort() }
  }, [capabilityAttempt])
  const reminderPreference = notifications.email == null ? '' : notifications.email && notifications.whatsapp ? 'both' : notifications.email ? 'email' : notifications.whatsapp ? 'whatsapp' : 'none'
  const creationSupported = !!user && !preview && capabilities?.profileCompletion === true

  const accountErrors = {
    name: account.name.trim() ? '' : 'Enter your full name.',
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email.trim()) ? '' : 'Email address is invalid.',
    password: account.password.length >= 8 ? '' : 'Use at least 8 characters.',
    confirmPassword: account.confirmPassword && account.confirmPassword === account.password ? '' : 'Passwords do not match.',
  }
  const valid = [
    createdAccount ? !!(account.name.trim() && account.email.trim()) : Object.values(accountErrors).every(error => !error),
    directions.length >= 1 && directions.length <= 3 && directions.filter(item => item.isPrimary).length === 1 && !!goal.description.trim(),
    skills.length > 0 || startingFromScratch,
    studyOptions.every(([key]) => validPreference(key, studyPreferences[key])) && reminderPreference !== '' && (!needsWhatsApp(reminderPreference) || validPhone(notifications.whatsappNumber)),
  ]
  const canContinue = step === 5 ? valid.every(Boolean) : valid[step - 1]
  const changeStep = next => {
    if (!pending && (next < step || valid.slice(0, next - 1).every(Boolean))) setStep(next)
  }
  const toggleSkill = name => {
    if (startingFromScratch) return
    setSkills(current => current.some(skill => skill.name === name)
      ? current.filter(skill => skill.name !== name)
      : [...current, { name, selfReportedLevel: 'beginner', verifiedLevel: null, confidenceScore: null }])
  }
  const addSkill = () => {
    const entered = customSkill.trim()
    const name = skillOptions.find(option => option.toLowerCase() === entered.toLowerCase()) ?? entered
    if (!name || startingFromScratch) return
    setSkills(current => current.some(skill => skill.name.toLowerCase() === name.toLowerCase()) ? current : [...current, { name, selfReportedLevel: 'beginner', verifiedLevel: null, confidenceScore: null }])
    setCustomSkill('')
  }
  const complete = async () => {
    if (!valid.every(Boolean) || !creationSupported || submission.current) return
    const controller = new AbortController(); submission.current = controller
    setPending(true); setSubmissionError('')
    try {
      const payload = normalizeOnboarding({ account, goal, directions, skills, startingFromScratch, studyPreferences, notifications })
      await onboardingService.completeOnboarding(payload, { enabled: true, signal: controller.signal })
      if (!controller.signal.aborted) { if (onComplete) await onComplete(); else setStep(6) }
    } catch {
      if (!controller.signal.aborted) setSubmissionError('Your learning profile could not be confirmed. Your account is already verified; retry saving your profile.')
    } finally { if (submission.current === controller) submission.current = null; if (!controller.signal.aborted) setPending(false) }
  }
  const field = (key, label, type = 'text') => {
    const secret = type === 'password'
    const error = !createdAccount && touched[key] && accountErrors[key]
    return <div className="onboarding-field" key={key}>
      <label htmlFor={`account-${key}`}>{label}</label>
      <div className="onboarding-input-wrap"><input id={`account-${key}`} name={key} type={secret && shown[key] ? 'text' : type} autoComplete={secret ? 'new-password' : key === 'name' ? 'name' : 'email'} value={account[key]} readOnly={createdAccount !== null} required={!createdAccount} aria-invalid={!!error} aria-describedby={error ? `${key}-error` : secret && key === 'password' ? 'password-hint' : undefined} onChange={event => setAccount(current => ({ ...current, [key]: event.target.value }))} onBlur={() => setTouched(current => ({ ...current, [key]: true }))} />
        {secret && <button type="button" className="password-toggle" aria-label={`${shown[key] ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={!!shown[key]} onClick={() => setShown(current => ({ ...current, [key]: !current[key] }))}>{shown[key] ? 'Hide' : 'Show'}</button>}
      </div>
      {key === 'password' && !error && <small id="password-hint">{createdAccount ? 'Credentials cleared after confirmed account creation.' : 'At least 8 characters.'}</small>}
      {error && <small className="onboarding-error" id={`${key}-error`}>{error}</small>}
    </div>
  }

  return <main className="athena-onboarding">
    <header className="onboarding-header"><p>PROMETHEUS // ATHENA</p><h1>Welcome</h1><p>Set up your learning profile</p><small>{user ? 'Your account is verified. Complete your learning preferences below.' : 'Development preview. Account creation is available from the sign-up screen.'}</small></header>
    <Stepper step={step} initialStep={1} onStepChange={changeStep} onFinalStepCompleted={complete}
      indicator="numbers" orientation="horizontal" transition="slide" linear={true} disableStepIndicators={step > 5 || pending}
      showFooter={true} backButtonText="Back" nextButtonText="Continue" completeButtonText="Create ATHENA Profile"
      backButtonProps={{ disabled: pending }}
      nextButtonProps={{ disabled: !canContinue || pending || step === 5 && !creationSupported, onClick: event => { if (!canContinue || pending || step === 5 && !creationSupported) event.preventDefault() } }}
      theme="dark" accentColor="#7C6CFF" frame={true} radius={24} width={800}
      className="athena-stepper" style={{ '--stepper-frame': 'rgba(12, 18, 35, 0.78)', '--stepper-ink': '#F5F7FF', '--stepper-muted': '#B7C0DB', '--stepper-solid-ink': '#080D1A' }}
      completedContent={<div className="onboarding-complete"><p className="onboarding-success">Profile creation confirmed.</p><h2>Your learning profile has been saved.</h2><p>The account service confirmed your account and profile submission.</p><a className="onboarding-dashboard-link" href="/">Open Dashboard</a></div>}
    >
      <Step title="Account"><StepHeading title={user ? 'Your verified account' : 'Account preview'}>{user ? 'Your email is verified. Continue to set your learning preferences.' : 'These preview fields are never submitted.'}</StepHeading>
        <div className="onboarding-fields">{field('name', 'Full name')}{field('email', 'Email', 'email')}{!user && <>{field('password', 'Password', 'password')}{field('confirmPassword', 'Confirm password', 'password')}</>}</div>
      </Step>
      <Step title="Direction"><StepHeading title="What are you working toward?">ATHENA will shape your roadmap around this.</StepHeading>
        <DirectionSelector value={directions} onChange={setDirections} />
        <div className="onboarding-field"><label htmlFor="main-goal">What is your current main goal?</label><textarea id="main-goal" placeholder="Become job-ready in applied AI" value={goal.description} onChange={event => setGoal(current => ({ ...current, description: event.target.value }))} required /></div>
        {!valid[1] && <p className="onboarding-help">Choose 1–3 directions, mark one primary and describe your main goal to continue.</p>}
      </Step>
      <Step title="Skills"><StepHeading title="What do you already know?">These levels are self-reported. Knowledge verification stays separate.</StepHeading>
        <fieldset className="onboarding-choices" disabled={startingFromScratch}><legend>Select your skills</legend><div className="onboarding-choice-grid">{skillOptions.map(name => <label className="onboarding-choice" key={name}><input type="checkbox" checked={skills.some(skill => skill.name === name)} onChange={() => toggleSkill(name)} /><span>{name}</span></label>)}</div></fieldset>
        <div className="onboarding-custom-skill"><div className="onboarding-field"><label htmlFor="custom-skill">Custom skill</label><input id="custom-skill" value={customSkill} disabled={startingFromScratch} maxLength={80} onChange={event => setCustomSkill(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addSkill() } }} /></div><button type="button" className="onboarding-secondary" disabled={startingFromScratch || !customSkill.trim()} onClick={addSkill}>Add skill</button></div>
        {!startingFromScratch && <section className="onboarding-selected-skills" aria-labelledby="selected-skills-heading"><h3 id="selected-skills-heading">Selected skills <span>{skills.length} selected</span></h3><div className="onboarding-skill-levels">{skills.map(skill => <div className="onboarding-skill-editor" key={skill.name}><div className="onboarding-skill-heading"><strong>{skill.name}</strong><button type="button" className="onboarding-remove" aria-label={`Remove skill ${skill.name}`} onClick={() => toggleSkill(skill.name)}>×</button></div><fieldset className="onboarding-proficiency"><legend className="sr-only">{skill.name}: self-reported level</legend>{selfReportOptions.filter(([key]) => key !== 'not_rated').map(([key, label]) => <label key={key}><input type="radio" name={`skill-${skill.name}`} checked={skill.selfReportedLevel === key} onChange={() => setSkills(current => current.map(item => item.name === skill.name ? { ...item, selfReportedLevel: key } : item))} /><span>{label}</span></label>)}</fieldset></div>)}</div></section>}
        <label className="onboarding-scratch"><input type="checkbox" checked={startingFromScratch} onChange={event => { setStartingFromScratch(event.target.checked); if (event.target.checked) { setSkills([]); setCustomSkill('') } }} /><span>I'm starting from scratch</span></label>
        {!valid[2] && <p className="onboarding-help">Select at least one skill, or choose to start from scratch.</p>}
      </Step>
      <Step title="Preferences"><StepHeading title="How should ATHENA work with you?">Choose a rhythm that fits your day.</StepHeading>
        <PreferenceFields value={studyPreferences} onChange={setStudyPreferences} />
        <ReminderFields value={notifications} onChange={setNotifications} capabilities={capabilities} />
      </Step>
      <Step title="Review"><StepHeading title="Your ATHENA profile">Review your choices. You can change these later.</StepHeading>
        <dl className="onboarding-review">
          <div><dt>Name</dt><dd>{account.name}</dd></div><div><dt>Email</dt><dd>{account.email}</dd></div>
          <div><dt>Learning directions</dt><dd>{directions.map(item => `${item.name}${item.isPrimary ? ' (Primary)' : ''}`).join(' · ')}</dd></div><div><dt>Main goal</dt><dd>{goal.description}</dd></div>
          <div><dt>Selected skills · Self-reported</dt><dd>{startingFromScratch ? 'Starting from scratch' : skills.map(skill => `${skill.name} (${skill.selfReportedLevel})`).join(' · ')}</dd></div>
          <div><dt>Daily availability</dt><dd>{preferenceLabel('dailyStudyMinutes', studyPreferences.dailyStudyMinutes)}</dd></div>
          {needsWhatsApp(reminderPreference) && <div><dt>WhatsApp · Unverified</dt><dd>{maskPhone(notifications.whatsappNumber)}</dd></div>}
          <div><dt>Study period</dt><dd>{preferenceLabel('studyPeriod', studyPreferences.studyPeriod)}</dd></div><div><dt>Learning style</dt><dd>{preferenceLabel('learningStyle', studyPreferences.learningStyle)}</dd></div><div><dt>Task size</dt><dd>{preferenceLabel('taskSize', studyPreferences.taskSize)}</dd></div><div><dt>Reminders</dt><dd>{reminderOptions.find(([key]) => key === reminderPreference)?.[1]}</dd></div>
        </dl>{!creationSupported && <p className="onboarding-help" role="status">Profile submission is disabled in this development preview.</p>}{capabilityStatus === 'error' && <button type="button" className="onboarding-secondary" onClick={() => { setCapabilityStatus('loading'); setCapabilityAttempt(value => value + 1) }}>Retry connection</button>}{pending && <p className="onboarding-help" role="status">Submitting your profile…</p>}{submissionError && <p className="onboarding-error" role="alert">{submissionError}</p>}
      </Step>
    </Stepper>
  </main>
}
