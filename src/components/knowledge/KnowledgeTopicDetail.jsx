import { useEffect, useRef, useState } from 'react'
import SpotlightCard from '../profile/SpotlightCard.jsx'
import ElasticSlider from './ElasticSlider.jsx'
import { KnowledgeStatus } from './KnowledgeTopicRow.jsx'
import { verificationLabels } from './knowledgeStatus.js'
import { selfReportedLevelToSlider, sliderToSelfReportedLevel, formatSelfReportedLevel } from './selfReportedLevel.js'

export default function KnowledgeTopicDetail({ topic, canUpdate, pending, error, onPersist, onRetry }) {
  const [preview, setPreview] = useState(null)
  const sliderValue = preview ?? selfReportedLevelToSlider(topic.selfReportedLevel)
  const alive = useRef(true)
  const committing = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const persist = async value => {
    if (committing.current || pending || !canUpdate) return
    committing.current = true
    await onPersist(topic.id, sliderToSelfReportedLevel(value))
    committing.current = false
    if (alive.current) setPreview(null)
  }
  return <SpotlightCard theme="dark" spotlightColor="#7C6CFF" intensity={0.08} spotlightSize={280} softness={0.84} shape="circle" borderGlow={0.34} proximity={60} smoothing={0.30} ambient={false} flare={true} grain={0} className="knowledge-detail" style={{ '--spotlight-card-surface': 'rgba(12,18,35,0.82)' }}>
    <p className="knowledge-eyebrow">Selected topic</p><h2>{topic.title}</h2><KnowledgeStatus state={topic.knowledgeState} />
    {(topic.suggestedByAthena === true || topic.knowledgeState === 'suggested') && <p className="knowledge-suggestion">ATHENA Suggestion</p>}
    {topic.description && <p className="knowledge-description">{topic.description}</p>}
    {(topic.source || topic.lastStudiedAt) && <dl className="knowledge-metadata">{topic.source && <div><dt>Source</dt><dd>{topic.source}</dd></div>}{topic.lastStudiedAt && <div><dt>Last studied</dt><dd>{new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(topic.lastStudiedAt))}</dd></div>}</dl>}
    {topic.knowledgeState === 'gap' && <section className="knowledge-gap"><h3>Possible knowledge gap</h3>{topic.gapReason && <p>{topic.gapReason}</p>}</section>}
    <section className="knowledge-self-report" aria-labelledby="knowledge-self-report-title"><p className="knowledge-eyebrow">Self-reported</p><h3 id="knowledge-self-report-title">How confident are you with this topic?</h3>
      <ElasticSlider value={sliderValue} startingValue={0} maxValue={3} isStepped={true} stepSize={1} orientation="horizontal" leftIcon={null} rightIcon={null} valuePosition="bubble" formatValue={formatSelfReportedLevel} ticks={[0, 1, 2, 3]} thumb={true} thickness={6} activeThickness={10} restOpacity={0.72} growOnHover={true} maxStretch={18} bounce={0.28} jumpToClick={true} wheel={false} rangeColor="#7C6CFF" thumbColor="#F5F7FF" ariaLabel="Self-reported knowledge level" disabled={!canUpdate || pending} onChange={setPreview} onChangeEnd={persist} />
      <div className="knowledge-rating-labels" aria-hidden="true">{['Not rated', 'Beginner', 'Comfortable', 'Strong'].map(label => <span key={label}>{label}</span>)}</div>
      <p className="knowledge-current-rating">{formatSelfReportedLevel(sliderValue)} <span>{pending ? 'Saving…' : 'Self-reported, not a verified result'}</span></p>
      {!canUpdate && <p className="knowledge-help">Self-rating updates are unavailable until the backend enables them.</p>}
      {error && <div className="knowledge-inline-error" role="alert"><p>{error}</p><button type="button" onClick={onRetry}>Retry</button></div>}
    </section>
    <section className="knowledge-verification" aria-labelledby="knowledge-verification-title"><h3 id="knowledge-verification-title">ATHENA Verification</h3><dl>
      {topic.verificationStatus != null && <div><dt>Status</dt><dd>{verificationLabels[topic.verificationStatus]}</dd></div>}
      {topic.verifiedLevel !== undefined && <div><dt>Verified level</dt><dd>{topic.verifiedLevel === null ? 'Not verified yet' : topic.verifiedLevel}</dd></div>}
      {topic.verifiedConfidence != null && <div><dt>ATHENA confidence</dt><dd>{Math.round(topic.verifiedConfidence * 100)}%</dd></div>}
    </dl><p className="knowledge-help">Only an ATHENA diagnostic can establish verified knowledge. Self-rating does not change these results.</p></section>
  </SpotlightCard>
}
