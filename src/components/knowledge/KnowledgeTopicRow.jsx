import { HugeiconsIcon } from '@hugeicons/react'
import { knowledgeStatus, verificationLabels } from './knowledgeStatus.js'
import { formatSelfReportedLevel } from './selfReportedLevel.js'

export function KnowledgeStatus({ state }) {
  const status = knowledgeStatus[state]
  return <span className="knowledge-topic-status" style={{ color: status.color }}><HugeiconsIcon icon={status.icon} size={16} aria-hidden="true" />{status.label}</span>
}
export default function KnowledgeTopicRow({ topic, selected, onSelect }) {
  return <li><button type="button" className="knowledge-topic-row" aria-current={selected ? 'true' : undefined} onClick={() => onSelect(topic.id)}><strong>{topic.title}</strong><KnowledgeStatus state={topic.knowledgeState} /><span className="knowledge-row-facts"><span>Self-reported: {formatSelfReportedLevel(topic.selfReportedLevel)}</span>{topic.verificationStatus != null && <span>ATHENA: {verificationLabels[topic.verificationStatus]}</span>}</span></button></li>
}
