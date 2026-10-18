import { calendarDays, consistencyState, dateLabel } from './progressFormatters.js'

const legend = [{ key: 'missing', label: 'No record', symbol: '?' }, { key: 'no-plan', label: 'No plan', symbol: '○' }, { key: 'missed', label: 'Planned but missed', symbol: '–' }, { key: 'partial', label: 'Partial', symbol: '◐' }, { key: 'completed', label: 'Completed', symbol: '✓' }, { key: 'unplanned', label: 'Studied without a plan', symbol: '+' }]
export default function ConsistencyChart({ rows }) {
  const days = calendarDays(rows)
  return <section className="progress-panel progress-consistency" aria-labelledby="progress-consistency-title"><h2 id="progress-consistency-title">Study consistency</h2>
    {rows.length === 0 ? <p className="progress-chart-empty">Not enough history for consistency analysis.</p> : <>
      <p className="progress-chart-summary">{rows.filter(row => row.studied).length} studied days across {rows.length} reported dates. Missing dates are unknown.</p>
      <div className="progress-calendar-labels" aria-hidden="true">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}</div>
      <ol className="progress-calendar" aria-label="Study consistency by date">{days.map(day => { const state = consistencyState(day.record); const label = `${dateLabel(day.date, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}: ${state.label}${day.record ? `; ${day.record.completedPlannedTasks} of ${day.record.plannedTasks} planned tasks completed` : ''}`; return <li key={day.date} data-state={state.key} aria-label={label} title={label}><span aria-hidden="true">{new Date(`${day.date}T00:00:00Z`).getUTCDate()}</span><strong aria-hidden="true">{state.symbol}</strong></li> })}</ol>
      <ul className="progress-legend" aria-label="Consistency legend">{legend.map(item => <li key={item.key}><span data-state={item.key} aria-hidden="true">{item.symbol}</span>{item.label}</li>)}</ul>
    </>}
  </section>
}
