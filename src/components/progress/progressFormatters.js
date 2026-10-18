const dayMs = 86400000
export const isDateOnly = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
export const dateLabel = (date, options = { day: 'numeric', month: 'short' }) => new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', ...options }).format(new Date(`${date}T00:00:00Z`))
export const sessionDateLabel = value => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
export function durationParts(minutes) {
  if (minutes == null) return null
  return minutes < 60 ? { value: minutes, decimals: Number.isInteger(minutes) ? 0 : 1, suffix: 'm' } : { value: minutes / 60, decimals: 1, suffix: 'h' }
}
export function formatDuration(minutes) {
  const parts = durationParts(minutes)
  return parts ? `${parts.value.toFixed(parts.decimals)}${parts.suffix}` : 'Not reported'
}
export function calendarDays(rows) {
  if (!rows.length) return []
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date))
  const first = new Date(`${sorted[0].date}T00:00:00Z`)
  first.setUTCDate(first.getUTCDate() - (first.getUTCDay() + 6) % 7)
  const last = new Date(`${sorted.at(-1).date}T00:00:00Z`)
  last.setUTCDate(last.getUTCDate() + (7 - last.getUTCDay()) % 7)
  const byDate = new Map(rows.map(row => [row.date, row]))
  const days = []
  for (let time = first.getTime(); time <= last.getTime() && days.length < 98; time += dayMs) {
    const date = new Date(time).toISOString().slice(0, 10)
    days.push({ date, record: byDate.get(date) ?? null })
  }
  return days
}
export function consistencyState(row) {
  if (!row) return { key: 'missing', label: 'No record', symbol: '?' }
  if (row.planned && row.plannedTasks > 0 && row.completedPlannedTasks === row.plannedTasks) return { key: 'completed', label: 'Completed', symbol: '✓' }
  if (row.planned && (row.completedPlannedTasks > 0 || row.studied)) return { key: 'partial', label: 'Partial', symbol: '◐' }
  if (row.planned) return { key: 'missed', label: 'Planned but missed', symbol: '–' }
  if (row.studied) return { key: 'unplanned', label: 'Studied without a plan', symbol: '+' }
  return { key: 'no-plan', label: 'No plan', symbol: '○' }
}
