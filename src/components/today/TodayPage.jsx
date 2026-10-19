import { useEffect, useState } from 'react'
import useToday from '../../hooks/useToday.js'
import DataAccessState from '../DataAccessState.jsx'
import AnimatedList from './AnimatedList.jsx'
import SpecularButton from './SpecularButton.jsx'
import TodaySummary from './TodaySummary.jsx'
import { formatMinutes } from './todayFormat.js'
import TodayTaskRow, { TaskStatus } from './TodayTaskRow.jsx'
import TodaySkeleton from './TodaySkeleton.jsx'
import TodayEmptyState from './TodayEmptyState.jsx'
import './TodayPage.css'

function ActiveSession({ session, tasks, timezone }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  const started = new Date(session.startedAt)
  const elapsed = Math.max(0, Math.floor((now - started.getTime()) / 1000))
  return <section className="today-active-session" aria-label="Active study session"><h3>Focus session active</h3><p>{tasks.find(task => task.id === session.taskId)?.title || session.taskTitle || 'Task details unavailable'}</p><dl>
    <div><dt>Started at</dt><dd>{new Intl.DateTimeFormat('en-IN', { timeZone: timezone || 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(started)}</dd></div>
    <div><dt>Elapsed</dt><dd><time>{formatMinutes(Math.floor(elapsed / 60))} {elapsed % 60}s</time></dd></div>
  </dl></section>
}

export default function TodayPage() {
  const today = useToday()
  const [selectedTaskId, setSelectedTaskId] = useState(null)
  const retry = () => { setSelectedTaskId(null); today.retry() }
  const plan = today.data
  const selected = plan?.tasks.find(task => task.id === selectedTaskId)
  const allComplete = plan?.tasks.length > 0 && plan.tasks.every(task => task.status === 'completed')
  return <main className="athena-today">
    <header className="today-page-header"><p>PROMETHEUS // ATHENA</p><h1>Today</h1><p>Your focused study plan for today.</p>
      {plan?.date && <small>{new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${plan.date}T12:00:00Z`))}{plan.timezone ? ` · ${plan.timezone}` : ''}</small>}
    </header>
    {plan?.learningContext && <section className="today-state"><p>{plan.dailyBudgetMinutes} minutes available today · {plan.learningContext.studyPreferences.taskSize} tasks</p>{plan.overBudgetMinutes>0&&<p>Existing tasks exceed your budget by {plan.overBudgetMinutes} minutes. Overflow tasks are marked optional.</p>}<button type="button" className="today-retry" disabled={today.planPending} onClick={today.planToday}>{today.planPending?'Planning…':'Plan today from my roadmap'}</button>{today.planError&&<p role="alert">{today.planError}</p>}</section>}
    {today.status === 'loading' && <TodaySkeleton />}
    {today.status === 'auth-required' && <DataAccessState />}
    {['unavailable', 'empty', 'error'].includes(today.status) && <TodayEmptyState status={today.status} onRetry={retry} />}
    {plan && <>
      <TodaySummary plan={plan} />
      {allComplete && <section className="today-complete" role="status"><h2>Today's plan is complete.</h2><p>All scheduled tasks are done.</p></section>}
      {(today.status === 'loaded' || plan.activeSession) && <div className="today-layout">
        <section className="today-tasks" aria-labelledby="today-tasks-title"><h2 id="today-tasks-title">Today's tasks</h2>
          {!plan.capabilities.updateTask && <p className="today-readonly">Task completion is read-only until the backend enables updates.</p>}
          <AnimatedList items={plan.tasks} animation="slide" theme="dark" accentColor="#7C6CFF" initialSelectedIndex={-1} selectOnHover={false} enableArrowNavigation={true} loop={false} animateOnce={true} stagger={0.04} showGradients={true} fadeSize={44} displayScrollbar={true} frame={true} radius={14} gap={8} width="100%" maxHeight={520} interactiveItems={true} ariaLabel="Today's tasks"
            onItemSelect={task => setSelectedTaskId(task.id)}
            style={{ '--al-frame': 'rgba(12,18,35,0.80)', '--al-tile': 'rgba(255,255,255,0.025)', '--al-muted': '#B7C0DB', '--al-tile-shadow': 'none' }}
            renderItem={task => <TodayTaskRow task={task} canUpdate={plan.capabilities.updateTask} pending={Object.hasOwn(today.pendingTasks, task.id) && today.pendingTasks[task.id] === true} error={Object.hasOwn(today.taskErrors, task.id) ? today.taskErrors[task.id] : ''} onChange={today.updateTask} onRetry={retry} />}
          />
        </section>
        <aside className="today-focus" aria-labelledby="today-focus-title"><p className="today-eyebrow">Focus</p>
          <h2 id="today-focus-title">{selected ? selected.title : 'Select a task'}</h2>
          {!selected && <p>Choose something from today's plan to view its details or begin a focus session.</p>}
          {selected && <><TaskStatus status={selected.status} />{selected.description && <p className="today-focus-description">{selected.description}</p>}<dl className="today-focus-facts">
            {selected.estimatedMinutes != null && <div><dt>Study estimate</dt><dd>{formatMinutes(selected.estimatedMinutes)}</dd></div>}
            {selected.topicTitle && <div><dt>Related topic</dt><dd>{selected.topicTitle}</dd></div>}
            {selected.priority && <div><dt>Priority</dt><dd>{selected.priority}</dd></div>}
          </dl>
          {!plan.capabilities.focusSessions && <p className="today-readonly">Focus sessions unavailable.</p>}
          {plan.capabilities.focusSessions && selected.status !== 'completed' && !plan.activeSession && <SpecularButton size="md" radius={14} tint="#7C6CFF" tintOpacity={0.10} textColor="#F5F7FF" lineColor="#7C6CFF" baseColor="#29304A" intensity={0.8} idleIntensity={0.22} shineSize={10} shineFade={32} thickness={1.1} glow={0.7} followMouse={true} proximity={180} autoAnimate={false} disabled={today.sessionPending} onClick={() => today.startSession(selected.id)}>{today.sessionPending ? 'Starting session…' : 'Start Focus Session'}</SpecularButton>}
          </>}
          {today.sessionError && <div className="today-inline-error" role="alert"><p>{today.sessionError}</p><button type="button" onClick={retry}>Retry</button></div>}
          {plan.activeSession && <ActiveSession session={plan.activeSession} tasks={plan.tasks} timezone={plan.timezone} />}
        </aside>
      </div>}
    </>}
  </main>
}
