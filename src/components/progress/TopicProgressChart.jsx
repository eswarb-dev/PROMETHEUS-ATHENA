import { formatDuration } from './progressFormatters.js'

export default function TopicProgressChart({ rows }) {
  const topics = [...rows].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
  return <section className="progress-panel" aria-labelledby="progress-topics-title"><h2 id="progress-topics-title">Topic progress</h2>
    {topics.length === 0 ? <p className="progress-chart-empty">No active topic progress yet.</p> : <><p className="progress-chart-summary">{topics.length} {topics.length === 1 ? 'topic' : 'topics'} in your learning progress.</p><ul className="progress-topic-list">{topics.map(topic => <li key={topic.topicId}><div className="progress-topic-heading"><h3>{topic.title}</h3><span>{topic.progressPercent == null ? 'Not reported' : `${topic.progressPercent}%`}</span></div>{topic.progressPercent != null && <progress value={topic.progressPercent} max={100} aria-label={`${topic.title} completion`} />}<p>{[topic.status, topic.studyMinutes != null ? formatDuration(topic.studyMinutes) : null].filter(Boolean).join(' · ')}</p></li>)}</ul></>}
  </section>
}
