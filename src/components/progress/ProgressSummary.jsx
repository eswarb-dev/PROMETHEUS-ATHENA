import CountUp from './CountUp.jsx'
import Counter from './Counter.jsx'
import { durationParts } from './progressFormatters.js'

export function ProgressNumber({ value, suffix = '', decimals = 0 }) {
  return <CountUp className="progress-count-up" from={0} to={value} mode="count" easing="easeOut" decimals={decimals} suffix={suffix} duration={0.75} trigger="view" replayOnHover={false} startWhen={true} />
}
export function ProgressInteger({ value }) {
  return <Counter value={value} locale="en-IN" direction="auto" duration={0.5} bounce={0.10} stagger={0.025} motionBlur={true} intro={true} fade={0.22} fontSize="inherit" fontWeight={650} textColor="#F5F7FF" tabular={true} />
}
export default function ProgressSummary({ summary }) {
  const study = durationParts(summary.totalStudyMinutes)
  const metrics = [
    summary.roadmapCompletionPercent != null && { key: 'roadmap', label: 'Roadmap completion', value: <ProgressNumber value={summary.roadmapCompletionPercent} suffix="%" />, detail: summary.topicsCompleted != null && summary.totalTopics != null ? `${summary.topicsCompleted} / ${summary.totalTopics} topics` : null },
    study && { key: 'study', label: 'Study time', value: <ProgressNumber {...study} />, detail: 'Total recorded study time' },
    summary.completedTasks != null && { key: 'tasks', label: 'Tasks completed', value: <ProgressInteger value={summary.completedTasks} /> },
    summary.currentStreak != null && { key: 'streak', label: 'Current streak', value: <ProgressInteger value={summary.currentStreak} />, detail: 'days' },
    summary.topicsCompleted != null && { key: 'topics', label: 'Topics completed', value: <ProgressInteger value={summary.topicsCompleted} /> },
    summary.knowledgeVerified != null && { key: 'verified', label: 'Knowledge verified', value: <ProgressInteger value={summary.knowledgeVerified} />, detail: 'topics' },
  ].filter(Boolean)
  return <>
    {metrics.length > 0 && <dl className="progress-summary" aria-label="Progress summary">{metrics.map(metric => <div className="progress-metric" key={metric.key} data-metric={metric.key}><dt>{metric.label}</dt><dd>{metric.value}</dd>{metric.detail && <p>{metric.detail}</p>}</div>)}</dl>}
    {(summary.longestStreak != null || summary.averageSessionMinutes != null || summary.weeklyCompletionPercent != null || summary.studySessions != null) && <dl className="progress-secondary">
      {summary.longestStreak != null && <div><dt>Longest streak</dt><dd><ProgressInteger value={summary.longestStreak} /> days</dd></div>}
      {summary.averageSessionMinutes != null && <div><dt>Average session</dt><dd><ProgressNumber {...durationParts(summary.averageSessionMinutes)} /></dd></div>}
      {summary.weeklyCompletionPercent != null && <div><dt>Weekly completion</dt><dd><ProgressNumber value={summary.weeklyCompletionPercent} suffix="%" /></dd></div>}
      {summary.studySessions != null && <div><dt>Study sessions</dt><dd><ProgressInteger value={summary.studySessions} /></dd></div>}
    </dl>}
  </>
}
