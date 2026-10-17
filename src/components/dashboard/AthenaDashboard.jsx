import { HugeiconsIcon } from '@hugeicons/react'
import { Task01Icon, Analytics01Icon, BookOpen01Icon, Route01Icon, ArtificialIntelligence01Icon, Calendar03Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import MagicBento from './MagicBento.jsx'
import './AthenaDashboard.css'

function CardHeading({ icon, children }) {
  return <div className="study-card-heading"><HugeiconsIcon icon={icon} size={18} strokeWidth={1.6} aria-hidden="true" /><h2>{children}</h2></div>
}

const activity = [35, 65, 45, 88, 58, 75, 0]
const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const athenaItems = [
  { id: 'focus', colSpan: 2, rowSpan: 1, content: <>
    <CardHeading icon={Task01Icon}>Today's Focus</CardHeading>
    <p className="study-subject">RAG Fundamentals</p>
    <div className="study-meta"><span>3 tasks planned</span><span>1h 45m estimated</span></div>
    <div className="study-completion"><span>1 / 3 completed</span><span>33%</span></div>
    <progress className="study-progress" value={1} max={3} aria-label="Today's tasks completed" />
  </> },
  { id: 'weekly', colSpan: 1, rowSpan: 1, content: <>
    <CardHeading icon={Analytics01Icon}>Weekly Progress</CardHeading>
    <div className="weekly-summary"><strong className="study-number">68<span>%</span></strong><div className="study-ring" role="img" aria-label="68 percent weekly progress" /></div>
    <p className="study-meta">12 / 18 tasks</p><p className="study-note">8h 20m focused</p>
  </> },
  { id: 'knowledge', colSpan: 1, rowSpan: 1, content: <>
    <CardHeading icon={BookOpen01Icon}>Knowledge Radar</CardHeading>
    <p className="study-gap-count">2 possible gaps</p>
    <p className="study-note">BM25 · Vector similarity</p>
    <p className="study-review">Needs review</p>
  </> },
  { id: 'roadmap', colSpan: 2, rowSpan: 2, content: <>
    <CardHeading icon={Route01Icon}>Current Roadmap</CardHeading>
    <p className="study-subject">Applied AI / RAG</p>
    <ol className="study-roadmap">
      <li><span className="roadmap-stage">Foundation</span><div className="roadmap-done"><HugeiconsIcon icon={Tick02Icon} size={16} aria-hidden="true" />Python</div><div className="roadmap-done"><HugeiconsIcon icon={Tick02Icon} size={16} aria-hidden="true" />Embeddings</div></li>
      <li className="roadmap-current"><span className="roadmap-stage">Current</span><div><i aria-hidden="true" />Vector Databases</div></li>
      <li><span className="roadmap-stage">Next</span><div className="roadmap-next"><i aria-hidden="true" />Hybrid Retrieval</div><div className="roadmap-next"><i aria-hidden="true" />Reranking</div></li>
    </ol>
  </> },
  { id: 'suggestion', colSpan: 2, rowSpan: 1, content: <>
    <CardHeading icon={ArtificialIntelligence01Icon}>ATHENA Suggests</CardHeading>
    <p className="study-suggestion">Before learning Hybrid Search,<br className="study-desktop-break" /> review BM25 fundamentals.</p>
    <div className="study-meta"><span>20 min review</span><span>Prerequisite for sparse retrieval.</span></div>
  </> },
  { id: 'activity', colSpan: 2, rowSpan: 1, content: <>
    <CardHeading icon={Calendar03Icon}>Study Activity</CardHeading>
    <div className="activity-layout"><dl className="activity-stats"><div><dt>Current streak</dt><dd>4 days</dd></div><div><dt>This week</dt><dd>8h 20m</dd></div><div><dt>Tasks</dt><dd>12 completed</dd></div></dl>
    <div className="study-bars" role="img" aria-label="Illustrative study activity, Monday through Sunday"><div className="study-bars-track">{activity.map((height, index) => <div key={index}><span style={{ height: `${Math.max(3, height)}%` }} /><small>{days[index]}</small></div>)}</div></div></div>
  </> },
]

function greeting() {
  const hour = Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23' }).format(new Date()))
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

export default function AthenaDashboard() {
  return (
    <main className="athena-dashboard">
      <header className="dashboard-header">
        <p className="dashboard-brand">PROMETHEUS // ATHENA</p>
        <h1>{greeting()}, Eswar</h1>
        <p>Here's where your learning stands today.</p>
        <p className="dashboard-preview-note">UI preview · Sample study data</p>
      </header>
      <section aria-label="Learning overview">
        <MagicBento items={athenaItems} columns={4} rowHeight={190} gap={12} radius={18} theme="dark"
          glowColor="#7C6CFF" enableBorderGlow={true} enableSpotlight={true} spotlightRadius={240}
          enableStars={false} enableTilt={false} enableMagnetism={false} clickEffect={true} textAutoHide={false} intro={true}
          className="athena-bento"
          style={{ gridAutoRows: 'minmax(190px, auto)', '--mb-surface': 'rgba(12, 18, 35, 0.78)', '--mb-ink': '#F5F7FF', '--mb-muted': '#9EA8C7', '--mb-edge': 'rgba(255,255,255,0.07)', '--mb-spot-alpha': 0.055, '--mb-glow-alpha': 0.45 }}
        />
      </section>
    </main>
  )
}
