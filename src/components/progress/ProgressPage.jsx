import useProgress from '../../hooks/useProgress.js'
import DataAccessState from '../DataAccessState.jsx'
import ProgressSummary, { ProgressNumber } from './ProgressSummary.jsx'
import WeeklyActivityChart from './WeeklyActivityChart.jsx'
import TopicProgressChart from './TopicProgressChart.jsx'
import ConsistencyChart from './ConsistencyChart.jsx'
import ProgressEmptyState from './ProgressEmptyState.jsx'
import ProgressSkeleton from './ProgressSkeleton.jsx'
import { formatDuration, sessionDateLabel } from './progressFormatters.js'
import './ProgressPage.css'

export default function ProgressPage() {
  const progress = useProgress()
  const summary = progress.data?.summary
  const verified = summary?.knowledgeVerified
  const total = summary?.knowledgeTotal
  return <main className="athena-progress"><header className="progress-page-header"><p>PROMETHEUS // ATHENA</p><h1>Progress</h1><p>See how your learning is evolving over time.</p></header>
    {progress.data?.capabilities.rangeQueries && <div className="progress-ranges" role="group" aria-label="Analytics range">{[['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days']].map(([range, label]) => <button key={range} type="button" className="progress-button" aria-pressed={progress.selectedRange === range} onClick={() => progress.changeRange(range)}>{label}</button>)}</div>}
    {progress.status === 'loading' && <ProgressSkeleton />}
    {progress.status === 'auth-required' && <DataAccessState />}
    {['unavailable', 'empty', 'error'].includes(progress.status) && <ProgressEmptyState status={progress.status} onRetry={progress.retry} />}
    {progress.status === 'loaded' && <>
      <div className="progress-update"><button type="button" className="progress-button" disabled={progress.refreshing} onClick={progress.refresh}>{progress.refreshing ? 'Refreshing…' : 'Refresh analytics'}</button><span role="status">{progress.refreshing ? 'Refreshing analytics.' : progress.refreshError ? 'Could not refresh. Showing the previous analytics; use Refresh analytics to retry.' : ''}</span></div>
      <ProgressSummary summary={summary} />
      <div className="progress-charts"><WeeklyActivityChart rows={progress.data.weeklyActivity} /><TopicProgressChart rows={progress.data.topicProgress} /><ConsistencyChart rows={progress.data.consistency} />
        <section className="progress-panel progress-verification" aria-labelledby="progress-verification-title"><h2 id="progress-verification-title">Knowledge verification</h2>{total === 0 ? <p className="progress-chart-empty">No verified topics yet</p> : total > 0 && verified != null ? <><p className="progress-verification-value"><ProgressNumber value={verified / total * 100} suffix="%" /></p><p className="progress-chart-summary">{verified} / {total} topics verified by ATHENA.</p><progress value={verified} max={total} aria-label="Verified knowledge topics" /><p className="progress-chart-note">Verification reflects diagnostic results, separately from self-reported knowledge.</p></> : <p className="progress-chart-empty">No knowledge verification data yet.</p>}</section>
      </div>
      {progress.data.recentSessions.length > 0 && <section className="progress-panel progress-sessions" aria-labelledby="progress-sessions-title"><h2 id="progress-sessions-title">Recent sessions</h2><p className="progress-chart-note">Times shown in Asia/Kolkata.</p><ul>{progress.data.recentSessions.map(session => <li key={session.id}><time dateTime={session.startedAt}>{sessionDateLabel(session.startedAt)}</time><span>{formatDuration(session.durationMinutes)}</span>{session.topicTitle && <p>{session.topicTitle}</p>}{session.taskTitle && <p>{session.taskTitle}</p>}</li>)}</ul></section>}
    </>}
  </main>
}
