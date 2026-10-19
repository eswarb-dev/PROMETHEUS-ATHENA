import { useEffect, useId, useRef, useState } from 'react'
import { directionKey, directionLimit, directionPresets, toggleDirection } from '../../domain/learningDirections.js'

export default function DirectionSelector({ value, onChange }) {
  const id = useId(), dropdown = useRef(null)
  const [custom, setCustom] = useState(''), [customOpen, setCustomOpen] = useState(false)
  const [added, setAdded] = useState([]), [notice, setNotice] = useState('')
  useEffect(() => {
    const close = event => { if (dropdown.current && !dropdown.current.contains(event.target)) dropdown.current.open = false }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])
  const options = [...directionPresets.map(name => ({ name, source: 'preset' })), ...value.filter(item => item.source === 'custom'), ...added]
    .filter((item, index, all) => all.findIndex(other => directionKey(other.name) === directionKey(item.name)) === index)
  const add = () => {
    const name = custom.trim().replace(/\s+/g, ' ')
    if (!name) { setNotice('Enter a custom direction.'); return }
    if (value.some(item => directionKey(item.name) === directionKey(name))) { setNotice('That direction is already selected.'); return }
    if (value.length >= directionLimit) { setNotice('Maximum 3 directions'); return }
    const existing = options.find(item => directionKey(item.name) === directionKey(name))
    const item = existing ?? { name, source: 'custom' }
    if (!existing) setAdded(current => [...current, item])
    onChange(toggleDirection(value, item.name, item.source)); setCustom(''); setNotice('')
  }
  return <div className="direction-selector">
    <label className="direction-label" id={`${id}-label`}>Learning directions</label>
    <details className="direction-dropdown" ref={dropdown} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); dropdown.current.open = false; dropdown.current.querySelector('summary').focus() } }}>
      <summary aria-labelledby={`${id}-label ${id}-selection`}><span id={`${id}-selection`}>{value.length ? value.map(item => item.name).join(', ') : 'Choose 1–3 directions'}</span><span aria-hidden="true">▾</span></summary>
      <div className="direction-menu"><fieldset><legend className="sr-only">Learning direction options</legend>{options.map(item => {
        const selected = value.some(direction => directionKey(direction.name) === directionKey(item.name))
        return <label className="direction-option" key={directionKey(item.name)}><input type="checkbox" checked={selected} disabled={!selected && value.length >= directionLimit} onChange={() => { onChange(toggleDirection(value,item.name,item.source)); setNotice('') }} /><span>{item.name}</span></label>
      })}</fieldset>
        <button type="button" className="direction-custom-toggle" onClick={() => setCustomOpen(current => !current)} aria-expanded={customOpen}>+ Add custom direction</button>
        {customOpen && <div className="direction-custom"><label htmlFor={`${id}-custom`}>Custom direction</label><div><input id={`${id}-custom`} value={custom} maxLength={200} onChange={event => setCustom(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add() } }} /><button type="button" className="onboarding-secondary" disabled={!custom.trim() || value.length >= directionLimit} onClick={add}>Add</button></div></div>}
      </div>
    </details>
    <p className="onboarding-help" role="status">{notice || (value.length === directionLimit ? 'Maximum 3 directions' : `${value.length} of 3 selected`)}</p>
    <div className="onboarding-field"><label htmlFor={`${id}-primary`}>Primary direction</label><select id={`${id}-primary`} value={value.find(item => item.isPrimary)?.name ?? ''} disabled={!value.length} required onChange={event => onChange(value.map(item => ({ ...item, isPrimary: item.name === event.target.value })))}><option value="" disabled>Choose a primary direction</option>{value.map(item => <option key={directionKey(item.name)} value={item.name}>{item.name}</option>)}</select></div>
  </div>
}
