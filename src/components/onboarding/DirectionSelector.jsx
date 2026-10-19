import { useId, useState } from 'react'
import { directionKey, directionLimit, directionPresets, toggleDirection } from '../../domain/learningDirections.js'

export default function DirectionSelector({ value, onChange }) {
  const id = useId()
  const [custom, setCustom] = useState('')
  const [notice, setNotice] = useState('')
  const add = () => {
    const name = custom.trim().replace(/\s+/g, ' ')
    if (!name) return
    if (value.some(item => directionKey(item.name) === directionKey(name))) { setNotice('That direction is already selected.'); return }
    if (value.length >= directionLimit) { setNotice('Select up to three directions. Remove one to add another.'); return }
    onChange(toggleDirection(value, name, directionPresets.includes(name) ? 'preset' : 'custom'))
    setCustom(''); setNotice('')
  }
  return <div className="direction-selector">
    <fieldset className="onboarding-choices"><legend>Learning directions · choose 1–3</legend><div className="onboarding-choice-grid">{directionPresets.map(name => {
      const selected = value.some(item => directionKey(item.name) === directionKey(name))
      return <label className="onboarding-choice" key={name}><input type="checkbox" checked={selected} disabled={!selected && value.length >= directionLimit} onChange={() => { onChange(toggleDirection(value, name)); setNotice('') }} /><span>{name}</span></label>
    })}</div></fieldset>
    <div className="onboarding-custom-skill"><div className="onboarding-field"><label htmlFor={`${id}-custom`}>Custom direction</label><input id={`${id}-custom`} value={custom} maxLength={200} onChange={event => setCustom(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add() } }} /></div><button type="button" className="onboarding-secondary" disabled={!custom.trim() || value.length >= directionLimit} onClick={add}>Add direction</button></div>
    {!!value.length && <fieldset className="onboarding-choices direction-primary"><legend>Selected directions ({value.length}) · choose one primary</legend>{value.map(item => <div className="direction-row" key={directionKey(item.name)}><span>{item.name}</span><label><input type="radio" name={`${id}-primary`} checked={item.isPrimary} onChange={() => onChange(value.map(direction => ({ ...direction, isPrimary: direction === item })))} /> Primary</label><button type="button" className="onboarding-secondary" aria-label={`Remove direction ${item.name}`} onClick={() => onChange(toggleDirection(value,item.name,item.source))}>Remove</button></div>)}</fieldset>}
    <p className="onboarding-help" role="status">{notice || `${value.length} of ${directionLimit} directions selected. Choose exactly one primary direction.`}</p>
  </div>
}
