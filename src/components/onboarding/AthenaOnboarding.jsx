import { useState } from 'react'
import Stepper, { Step } from './Stepper.jsx'
import './AthenaOnboarding.css'

const directions = ['AI / Machine Learning', 'Full-Stack Development', 'Data Science', 'Mobile Development', 'Cybersecurity', 'Cloud / DevOps', 'Research / Higher Studies', 'Placement Preparation', 'Custom']
const skillOptions = ['Python', 'Java', 'C / C++', 'JavaScript', 'React', 'Node.js', 'SQL', 'Git', 'Machine Learning', 'Deep Learning', 'RAG', 'Cloud', 'UI / UX', 'DSA']
const studyOptions = [
  ['dailyStudyMinutes', 'Available time per day', [['15', '15 min'], ['30', '30 min'], ['45', '45 min'], ['60', '1 hour'], ['90', '1.5 hours'], ['120', '2+ hours']]],
  ['studyPeriod', 'Preferred study period', ['Morning', 'Afternoon', 'Evening', 'Night', 'Flexible']],
  ['learningStyle', 'Learning preference', ['Build first', 'Theory first', 'Balanced', 'Practice-heavy']],
  ['taskSize', 'Preferred task size', ['Quick 15–25 min', 'Focused 30–60 min', 'Deep 1–2 hour sessions']],
  ['reminderPreference', 'Reminder preference', ['Email', 'WhatsApp', 'Both', 'None']],
]

function Choices({ legend, name, options, value, onChange }) {
  return <fieldset className="onboarding-choices"><legend>{legend}</legend><div className="onboarding-choice-grid">
    {options.map(option => {
      const [key, label] = Array.isArray(option) ? option : [option, option]
      return <label key={key} className="onboarding-choice"><input type="radio" name={name} value={key} checked={value === key} onChange={() => onChange(key)} /><span>{label}</span></label>
    })}
  </div></fieldset>
}

function StepHeading({ title, children }) {
  return <div className="onboarding-step-heading"><h2>{title}</h2>{children && <p>{children}</p>}</div>
}

export default function AthenaOnboarding() {
  const [step, setStep] = useState(1)
  const [account, setAccount] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [goal, setGoal] = useState({ direction: '', customDirection: '', description: '' })
  const [skills, setSkills] = useState([])
  const [startingFromScratch, setStartingFromScratch] = useState(false)
  const [customSkill, setCustomSkill] = useState('')
  const [preferences, setPreferences] = useState({ dailyStudyMinutes: '', studyPeriod: '', learningStyle: '', taskSize: '', reminderPreference: '' })
  const [touched, setTouched] = useState({})
  const [shown, setShown] = useState({})
  const [demoProfile, setDemoProfile] = useState(null)

  const accountErrors = {
    name: account.name.trim() ? '' : 'Enter your full name.',
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email.trim()) ? '' : 'Email address is invalid.',
    password: account.password.length >= 8 ? '' : 'Use at least 8 characters.',
    confirmPassword: account.confirmPassword && account.confirmPassword === account.password ? '' : 'Passwords do not match.',
  }
  const valid = [
    Object.values(accountErrors).every(error => !error),
    !!(goal.direction && (goal.direction !== 'Custom' || goal.customDirection.trim()) && goal.description.trim()),
    skills.length > 0 || startingFromScratch,
    Object.values(preferences).every(Boolean),
  ]
  const canContinue = step === 5 ? valid.every(Boolean) : valid[step - 1]
  const changeStep = next => {
    if (next < step || valid.slice(0, next - 1).every(Boolean)) setStep(next)
  }
  const toggleSkill = name => {
    setStartingFromScratch(false)
    setSkills(current => current.some(skill => skill.name === name)
      ? current.filter(skill => skill.name !== name)
      : [...current, { name, selfReportedLevel: 'beginner', verifiedLevel: null, confidenceScore: null }])
  }
  const addSkill = () => {
    const name = customSkill.trim()
    if (!name) return
    setStartingFromScratch(false)
    setSkills(current => current.some(skill => skill.name.toLowerCase() === name.toLowerCase()) ? current : [...current, { name, selfReportedLevel: 'beginner', verifiedLevel: null, confidenceScore: null }])
    setCustomSkill('')
  }
  const complete = () => {
    if (!valid.every(Boolean)) return
    setDemoProfile({
      profile: { name: account.name.trim(), email: account.email.trim() },
      goal: { direction: goal.direction === 'Custom' ? goal.customDirection.trim() : goal.direction, description: goal.description.trim() },
      skills: skills.map(skill => ({ ...skill })),
      preferences: { ...preferences, dailyStudyMinutes: Number(preferences.dailyStudyMinutes) },
    })
    setAccount(current => ({ ...current, password: '', confirmPassword: '' }))
    setShown({})
    setTouched({})
    setStep(6)
  }
  const field = (key, label, type = 'text') => {
    const secret = type === 'password'
    const error = touched[key] && accountErrors[key]
    return <div className="onboarding-field" key={key}>
      <label htmlFor={`account-${key}`}>{label}</label>
      <div className="onboarding-input-wrap"><input id={`account-${key}`} name={key} type={secret && shown[key] ? 'text' : type} autoComplete={secret ? 'new-password' : key === 'name' ? 'name' : 'email'} value={account[key]} required aria-invalid={!!error} aria-describedby={error ? `${key}-error` : secret && key === 'password' ? 'password-hint' : undefined} onChange={event => setAccount(current => ({ ...current, [key]: event.target.value }))} onBlur={() => setTouched(current => ({ ...current, [key]: true }))} />
        {secret && <button type="button" className="password-toggle" aria-label={`${shown[key] ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={!!shown[key]} onClick={() => setShown(current => ({ ...current, [key]: !current[key] }))}>{shown[key] ? 'Hide' : 'Show'}</button>}
      </div>
      {key === 'password' && !error && <small id="password-hint">At least 8 characters.</small>}
      {error && <small className="onboarding-error" id={`${key}-error`}>{error}</small>}
    </div>
  }

  return <main className="athena-onboarding">
    <header className="onboarding-header"><p>PROMETHEUS // ATHENA</p><h1>Welcome</h1><p>Set up your learning profile</p><small>UI preview only. No account is created or saved.</small></header>
    <Stepper step={step} initialStep={1} onStepChange={changeStep} onFinalStepCompleted={complete}
      indicator="numbers" orientation="horizontal" transition="slide" linear={true} disableStepIndicators={step > 5}
      showFooter={true} backButtonText="Back" nextButtonText="Continue" completeButtonText="Create ATHENA Profile"
      nextButtonProps={{ disabled: !canContinue, onClick: event => { if (!canContinue) event.preventDefault() } }}
      theme="dark" accentColor="#7C6CFF" frame={true} radius={24} width={800}
      className="athena-stepper" style={{ '--stepper-frame': 'rgba(12, 18, 35, 0.78)', '--stepper-ink': '#F5F7FF', '--stepper-muted': '#B7C0DB', '--stepper-solid-ink': '#080D1A' }}
      completedContent={<div className="onboarding-complete"><p className="onboarding-success">Profile ready.</p><h2>You're ready, {demoProfile?.profile.name}.</h2><p>This temporary profile has the information ATHENA will need to build your learning roadmap. Nothing has been saved.</p><a className="onboarding-dashboard-link" href="/">Open Dashboard</a></div>}
    >
      <Step title="Account"><StepHeading title="Create your ATHENA account">Start with your details. This preview keeps them only while the page is open.</StepHeading>
        <div className="onboarding-fields">{field('name', 'Full name')}{field('email', 'Email', 'email')}{field('password', 'Password', 'password')}{field('confirmPassword', 'Confirm password', 'password')}</div>
      </Step>
      <Step title="Direction"><StepHeading title="What are you working toward?">ATHENA will shape your roadmap around this.</StepHeading>
        <Choices legend="Primary direction" name="direction" options={directions} value={goal.direction} onChange={direction => setGoal(current => ({ ...current, direction }))} />
        {goal.direction === 'Custom' && <div className="onboarding-field"><label htmlFor="custom-direction">Your direction</label><input id="custom-direction" value={goal.customDirection} onChange={event => setGoal(current => ({ ...current, customDirection: event.target.value }))} required /></div>}
        <div className="onboarding-field"><label htmlFor="main-goal">What is your current main goal?</label><textarea id="main-goal" placeholder="Become job-ready in applied AI" value={goal.description} onChange={event => setGoal(current => ({ ...current, description: event.target.value }))} required /></div>
        {!valid[1] && <p className="onboarding-help">Choose one direction and describe your main goal to continue.</p>}
      </Step>
      <Step title="Skills"><StepHeading title="What do you already know?">Don't worry about being exact. ATHENA can verify knowledge later. These levels are self-reported, not verified.</StepHeading>
        <fieldset className="onboarding-choices"><legend>Select your skills</legend><div className="onboarding-choice-grid">{[...skillOptions, ...skills.filter(skill => !skillOptions.includes(skill.name)).map(skill => skill.name)].map(name => <label className="onboarding-choice" key={name}><input type="checkbox" checked={skills.some(skill => skill.name === name)} onChange={() => toggleSkill(name)} /><span>{name}</span></label>)}</div></fieldset>
        <div className="onboarding-custom-skill"><div className="onboarding-field"><label htmlFor="custom-skill">Custom skill</label><input id="custom-skill" value={customSkill} maxLength={80} onChange={event => setCustomSkill(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addSkill() } }} /></div><button type="button" className="onboarding-secondary" disabled={!customSkill.trim()} onClick={addSkill}>+ Add custom skill</button></div>
        {skills.length > 0 && <div className="onboarding-skill-levels">{skills.map(skill => <div className="onboarding-field" key={skill.name}><label htmlFor={`skill-${encodeURIComponent(skill.name)}`}>{skill.name}: self-reported level</label><select id={`skill-${encodeURIComponent(skill.name)}`} value={skill.selfReportedLevel} onChange={event => setSkills(current => current.map(item => item.name === skill.name ? { ...item, selfReportedLevel: event.target.value } : item))}><option value="beginner">Beginner</option><option value="comfortable">Comfortable</option><option value="strong">Strong</option></select></div>)}</div>}
        <label className="onboarding-scratch"><input type="checkbox" checked={startingFromScratch} onChange={event => { setStartingFromScratch(event.target.checked); if (event.target.checked) setSkills([]) }} /><span>I'm starting from scratch</span></label>
        {!valid[2] && <p className="onboarding-help">Select at least one skill, or choose to start from scratch.</p>}
      </Step>
      <Step title="Study Style"><StepHeading title="How do you want ATHENA to work with you?">Choose a rhythm that fits your day.</StepHeading>
        {studyOptions.map(([key, legend, options]) => <Choices key={key} legend={legend} name={key} options={options} value={preferences[key]} onChange={value => setPreferences(current => ({ ...current, [key]: value }))} />)}
        <p className="onboarding-help">Reminders are a preference only. No email or WhatsApp messages will be sent.</p>
      </Step>
      <Step title="Review"><StepHeading title="Your ATHENA profile">Review your choices. You can change these later.</StepHeading>
        <dl className="onboarding-review">
          <div><dt>Name</dt><dd>{account.name}</dd></div><div><dt>Email</dt><dd>{account.email}</dd></div>
          <div><dt>Primary direction</dt><dd>{goal.direction === 'Custom' ? goal.customDirection : goal.direction}</dd></div><div><dt>Main goal</dt><dd>{goal.description}</dd></div>
          <div><dt>Selected skills · Self-reported</dt><dd>{startingFromScratch ? 'Starting from scratch' : skills.map(skill => `${skill.name} (${skill.selfReportedLevel})`).join(' · ')}</dd></div>
          <div><dt>Daily availability</dt><dd>{studyOptions[0][2].find(([key]) => key === preferences.dailyStudyMinutes)?.[1]}</dd></div>
          <div><dt>Study period</dt><dd>{preferences.studyPeriod}</dd></div><div><dt>Learning style</dt><dd>{preferences.learningStyle}</dd></div><div><dt>Task size</dt><dd>{preferences.taskSize}</dd></div><div><dt>Reminders</dt><dd>{preferences.reminderPreference}</dd></div>
        </dl><p className="onboarding-help">Creating this preview profile does not create an account or save your details.</p>
      </Step>
    </Stepper>
  </main>
}
