import { HugeiconsIcon } from '@hugeicons/react'
import SpotlightCard from '../profile/SpotlightCard.jsx'
import { roadmapStatus } from './roadmapStatus.js'

export function TopicStatus({ status }) {
  const value = roadmapStatus[status]
  return <span className="roadmap-topic-status" style={{ '--topic-color': value.color }}><HugeiconsIcon icon={value.icon} size={16} aria-hidden="true" />{value.label}</span>
}

export default function RoadmapTopicCard({ topic, topics, onSelect }) {
  return <SpotlightCard className="roadmap-detail" theme="dark" spotlightColor="#7C6CFF" intensity={0.09} spotlightSize={280} softness={0.84} borderGlow={0.38} proximity={65} smoothing={0.30} ambient={false} flare={true} grain={0} style={{ '--spotlight-card-surface': 'rgba(12,18,35,0.82)' }}>
    <p className="roadmap-eyebrow">Selected topic</p><h2>{topic.title}</h2><TopicStatus status={topic.status} />
    {topic.suggestedByAthena === true && <p className="roadmap-suggestion">ATHENA Suggestion</p>}
    {topic.description && <p className="roadmap-description">{topic.description}</p>}
    <dl className="roadmap-topic-facts">
      {topic.estimatedMinutes != null && <div><dt>Study estimate</dt><dd>{topic.estimatedMinutes} min</dd></div>}
      {topic.selfReportedLevel != null && <div><dt>Self-reported knowledge</dt><dd>{topic.selfReportedLevel}</dd></div>}
      {topic.verifiedLevel !== undefined && <div><dt>ATHENA verified level</dt><dd>{topic.verifiedLevel === null ? 'Not tested' : topic.verifiedLevel}</dd></div>}
      {topic.confidenceScore != null && <div><dt>Confidence score</dt><dd>{Math.round(topic.confidenceScore * 100)}%</dd></div>}
    </dl>
    {topic.prerequisiteTopicIds?.length > 0 && <div className="roadmap-prerequisites"><h3>Prerequisites</h3><ul>{topic.prerequisiteTopicIds.map((id, index) => {
      const prerequisite = topics.find(value => value.id === id)
      return <li key={`${id}-${index}`}>{prerequisite ? <button type="button" onClick={() => onSelect(id)}>{prerequisite.title}</button> : <span>Unknown prerequisite</span>}</li>
    })}</ul></div>}
  </SpotlightCard>
}
