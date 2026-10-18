import { HugeiconsIcon } from '@hugeicons/react'
import { Task01Icon, Analytics01Icon, BookOpen01Icon, Route01Icon, ArtificialIntelligence01Icon, Calendar03Icon } from '@hugeicons/core-free-icons'
import MagicBento from './MagicBento.jsx'
import DataAccessState from '../DataAccessState.jsx'
import useHome from '../../hooks/useHome.js'
import { formatMinutes } from '../today/todayFormat.js'
import './AthenaDashboard.css'

function CardHeading({ icon, children }) {
  return <div className="study-card-heading"><HugeiconsIcon icon={icon} size={18} strokeWidth={1.6} aria-hidden="true" /><h2>{children}</h2></div>
}
function cards(data) {
  if (!data) return []
  const items = []
  const add = (id, icon, title, content, colSpan = 1) => items.push({ id, colSpan, content: <><CardHeading icon={icon}>{title}</CardHeading>{content}</> })
  if (data.today) {
    const today = data.today
    add('focus', Task01Icon, "Today's Focus", <><p className="study-subject">{today.tasks.find(task => task.status !== 'completed')?.title ?? "Today's tasks"}</p><p className="study-meta">{today.completedTaskCount} / {today.taskCount} completed</p>{today.plannedMinutes != null && <p className="study-note">{formatMinutes(today.plannedMinutes)} estimated</p>}<progress className="study-progress" value={today.completedTaskCount} max={today.taskCount} aria-label="Today's tasks completed" /></>, 2)
  }
  if (data.weeklyProgress) {
    const weekly = data.weeklyProgress
    add('weekly', Analytics01Icon, 'Weekly Progress', <><p className="study-number">{weekly.completedTasks} <span>tasks completed</span></p>{weekly.totalStudyMinutes != null && <p className="study-note">{formatMinutes(weekly.totalStudyMinutes)} focused</p>}</>)
  }
  if (data.knowledgeRadar) {
    const knowledge = data.knowledgeRadar
    add('knowledge', BookOpen01Icon, 'Knowledge Radar', <><p className="study-gap-count">{knowledge.gapCount} possible gaps</p><p className="study-note">{knowledge.totalTopics} topics · {knowledge.verifiedCount} verified</p></>)
  }
  if (data.currentRoadmap) {
    const { roadmap, topics } = data.currentRoadmap
    add('roadmap', Route01Icon, 'Current Roadmap', <><p className="study-subject">{roadmap.title}</p>{roadmap.goal && <p className="study-note">{roadmap.goal}</p>}<ol className="study-roadmap">{topics.slice(0, 5).map(topic => <li key={topic.id}><span className="roadmap-stage">{topic.status}</span><div>{topic.title}</div></li>)}</ol>{topics.length > 5 && <p className="study-note">View Roadmap for all {topics.length} topics.</p>}</>, 2)
  }
  if (data.athenaSuggestion) add('suggestion', ArtificialIntelligence01Icon, 'ATHENA Suggests', <p className="study-suggestion">{data.athenaSuggestion.content}</p>, 2)
  if (data.studyActivity?.length) add('activity', Calendar03Icon, 'Study Activity', <dl className="activity-stats">{data.studyActivity.map(day => <div key={day.date}><dt>{day.date}</dt><dd>{day.studyMinutes == null ? 'No completed session' : formatMinutes(day.studyMinutes)} · {day.tasksCompleted} tasks</dd></div>)}</dl>, 2)
  return items
}
export default function AthenaDashboard() {
  const home = useHome()
  const items = cards(home.data)
  return <main className="athena-dashboard"><header className="dashboard-header"><p className="dashboard-brand">PROMETHEUS // ATHENA</p><h1>{home.data?.profile?.name ? `Welcome, ${home.data.profile.name}` : 'Your learning dashboard'}</h1><p>Here's where your learning stands today.</p></header>
    {home.status === 'auth-required' && <DataAccessState home />}
    {home.status === 'unavailable' && <section className="data-access-state" role="status"><h2>Learning data is not connected yet.</h2><p>Supabase configuration is required to load your dashboard.</p></section>}
    {home.status === 'loading' && <p role="status">Loading your dashboard…</p>}
    {home.status === 'error' && <section className="data-access-state" role="alert"><h2>Couldn't load your dashboard.</h2><button type="button" onClick={() => home.retry()}>Retry</button></section>}
    {home.status === 'loaded' && (items.length ? <section aria-label="Learning overview"><MagicBento items={items} columns={4} rowHeight={190} gap={12} radius={18} theme="dark" glowColor="#7C6CFF" enableBorderGlow enableSpotlight spotlightRadius={240} enableStars={false} enableTilt={false} enableMagnetism={false} clickEffect textAutoHide={false} intro className="athena-bento" style={{ gridAutoRows: 'minmax(190px, auto)', '--mb-surface': 'rgba(12, 18, 35, 0.78)', '--mb-ink': '#F5F7FF', '--mb-muted': '#B7C0DB', '--mb-edge': 'rgba(255,255,255,0.07)', '--mb-spot-alpha': 0.055, '--mb-glow-alpha': 0.45 }} /></section> : <section className="data-access-state" role="status"><h2>No learning activity yet.</h2><p>Your saved roadmap, tasks and study sessions will appear here.</p></section>)}
  </main>
}
