import { calendarDays, dateLabel, formatDuration } from './progressFormatters.js'

export default function WeeklyActivityChart({ rows }) {
  const days = calendarDays(rows)
  const records = rows.filter(row => row.studyMinutes != null)
  const total = records.reduce((sum, row) => sum + row.studyMinutes, 0)
  const highest = records.reduce((best, row) => !best || row.studyMinutes > best.studyMinutes ? row : best, null)
  const maximum = Math.max(1, ...records.map(row => row.studyMinutes))
  const weeks = Array.from({ length: days.length / 7 }, (_, index) => days.slice(index * 7, index * 7 + 7))
  return <section className="progress-panel progress-weekly" aria-labelledby="progress-weekly-title"><h2 id="progress-weekly-title">Weekly activity</h2>
    {days.length === 0 ? <p className="progress-chart-empty">No study activity this week.</p> : <>
      <p className="progress-chart-summary">{records.length ? `Reported total: ${formatDuration(total)}. Highest day: ${dateLabel(highest.date, { weekday: 'long', day: 'numeric', month: 'short' })}, ${formatDuration(highest.studyMinutes)}.` : 'Study duration has not been reported for these dates.'}</p>
      <div className="progress-weekly-scroll">{weeks.map(week => <div className="progress-week" key={week[0].date}><p className="progress-week-label">Week of {dateLabel(week[0].date)}</p><ol className="progress-bars" aria-label="7-day study activity chart">{week.map(day => {
        const minutes = day.record?.studyMinutes
        const label = `${dateLabel(day.date, { weekday: 'long', day: 'numeric', month: 'short' })}: ${day.record ? minutes == null ? 'duration not reported' : `${minutes} minutes studied` : 'no record'}${day.record?.tasksCompleted != null ? `; ${day.record.tasksCompleted} tasks completed` : ''}`
        return <li key={day.date} aria-label={label} title={label} className={minutes == null ? 'is-missing' : minutes === 0 ? 'is-zero' : ''}><span className="progress-bar-value" aria-hidden="true">{minutes == null ? '—' : formatDuration(minutes)}</span><div className="progress-bar-track" aria-hidden="true">{minutes != null && minutes > 0 && <span style={{ height: `${minutes / maximum * 100}%` }} />}{minutes === 0 && <span className="progress-bar-zero" />}</div><span className="progress-bar-day" aria-hidden="true">{dateLabel(day.date, { weekday: 'short' })}</span></li>
      })}</ol></div>)}</div><p className="progress-chart-note">A dash means no duration was reported. A zero means zero minutes were recorded.</p>
    </>}
  </section>
}
