import { useId } from 'react'
import { preferenceDefinitions } from '../../domain/studyPreferences.js'
export default function PreferenceFields({ value, onChange, disabled = false }) {
  const id = useId()
  return <div className="athena-preference-fields">{preferenceDefinitions.map(([key, label, options]) => <div className="onboarding-field" key={key}><label htmlFor={`${id}-${key}`}>{label}</label><select id={`${id}-${key}`} value={value[key] ?? ''} disabled={disabled} onChange={event => onChange({ ...value, [key]: key === 'dailyStudyMinutes' ? Number(event.target.value) : event.target.value })} required><option value="" disabled>Choose an option</option>{value[key] != null && value[key] !== '' && !options.some(([option]) => option === value[key]) && <option value={value[key]}>{key === 'dailyStudyMinutes' ? `${value[key]} min` : value[key]}</option>}{options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}</select></div>)}</div>
}
