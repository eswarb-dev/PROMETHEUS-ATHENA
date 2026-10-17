import { formatMinutes } from './todayFormat.js'

export default function TodaySummary({ plan }) {
  const completed = plan.tasks.filter(task => task.status === 'completed').length
  const plannedMinutes = plan.plannedMinutes ?? (plan.tasks.every(task => task.estimatedMinutes != null) ? plan.tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0) : null)
  const completedMinutes = plan.completedMinutes
  return <dl className="today-summary" aria-label="Today's summary">
    <div><dt>Tasks completed</dt><dd>{completed} / {plan.tasks.length}</dd></div>
    {plannedMinutes != null && <div><dt>Planned study time</dt><dd>{formatMinutes(plannedMinutes)}</dd></div>}
    {completedMinutes != null && <div><dt>Completed study time</dt><dd>{formatMinutes(completedMinutes)}</dd></div>}
    <div><dt>Remaining tasks</dt><dd>{plan.tasks.length - completed}</dd></div>
  </dl>
}
