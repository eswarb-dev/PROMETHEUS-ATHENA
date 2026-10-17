import SpringCheck from './SpringCheck.jsx'
import { taskStatuses } from '../../services/todayService.js'
import { formatMinutes } from './todayFormat.js'

export function TaskStatus({ status }) {
  return <span className="today-task-status" style={{ color: taskStatuses[status].color }}>{taskStatuses[status].label}</span>
}

export default function TodayTaskRow({ task, canUpdate, pending, error, onChange, onRetry }) {
  return <div className="today-task-row" role="gridcell">
    <div onClick={event => event.stopPropagation()}>
      <SpringCheck label={task.title} ariaLabel={`Completion: ${task.title}`} checked={task.status === 'completed'} onChange={checked => onChange(task.id, checked)} disabled={!canUpdate || pending} color="#F5F7FF" fillColor="#7C6CFF" checkColor="#FFFFFF" boxSize={23} boxRadius={7} fontSize={15} bounce={0.18} strikeLag={0.10} doneOpacity={0.75} strike="left" />
    </div>
    {task.description && <p className="today-row-description">{task.description}</p>}
    <div className="today-row-meta"><TaskStatus status={task.status} />{task.estimatedMinutes != null && <span>{formatMinutes(task.estimatedMinutes)}</span>}{task.priority && task.priority !== 'normal' && <span>Priority: {task.priority}</span>}{pending && <span role="status">Saving…</span>}</div>
    {error && <div className="today-inline-error" role="alert"><p>{error}</p><button type="button" onClick={event => { event.stopPropagation(); onRetry() }}>Retry</button></div>}
  </div>
}
