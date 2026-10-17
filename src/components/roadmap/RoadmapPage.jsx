import { useMemo, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import useRoadmap from '../../hooks/useRoadmap.js'
import AnimatedContent from './AnimatedContent.jsx'
import BranchedMenu from './BranchedMenu.jsx'
import RoadmapEmptyState from './RoadmapEmptyState.jsx'
import RoadmapSkeleton from './RoadmapSkeleton.jsx'
import RoadmapTopicCard, { TopicStatus } from './RoadmapTopicCard.jsx'
import { roadmapStatus } from './roadmapStatus.js'
import './RoadmapPage.css'

const reveal = { distance: 28, duration: 0.55, direction: 'vertical', ease: 'power3.out', initialOpacity: 0, animateOpacity: true, scale: 0.985, blur: 2, threshold: 0.08, stagger: 0.05, trigger: 'scroll', once: true }

export default function RoadmapPage() {
  const { status, data, retry } = useRoadmap()
  const [selectedId, setSelectedId] = useState(null)
  const items = useMemo(() => data?.sections.map(section => ({
    value: section.id,
    label: section.title,
    children: data.topics.filter(topic => topic.sectionId === section.id).map(topic => ({ value: topic.id, label: topic.title, icon: <HugeiconsIcon icon={roadmapStatus[topic.status].icon} size={16} aria-hidden="true" /> })),
  })) ?? [], [data])
  const selected = data?.topics.find(topic => topic.id === selectedId) ?? data?.topics.find(topic => topic.status === 'current') ?? data?.topics[0]
  const selectedSection = selected ? data.sections.findIndex(section => section.id === selected.sectionId) : 0

  return <main className="athena-roadmap">
    <header className="roadmap-page-header"><p>PROMETHEUS // ATHENA</p><h1>Roadmap</h1><p>Your adaptive learning path.</p></header>
    {status === 'loading' && <RoadmapSkeleton />}
    {['empty', 'unavailable', 'error'].includes(status) && <RoadmapEmptyState status={status} onRetry={retry} />}
    {status === 'loaded' && <>
      <AnimatedContent {...reveal}><section className="roadmap-summary" aria-label="Roadmap overview"><div><h2>{data.roadmap.title}</h2>{data.roadmap.goal && <p>{data.roadmap.goal}</p>}</div><div className="roadmap-summary-metrics">
        {data.roadmap.progressPercent != null && <div><strong>{data.roadmap.progressPercent}%</strong><span>Completion</span></div>}
        <div><strong>{data.topics.filter(topic => topic.status === 'completed').length} / {data.topics.length}</strong><span>Topics completed</span></div>
        {data.roadmap.estimatedRemainingMinutes != null && <div><strong>{data.roadmap.estimatedRemainingMinutes} min</strong><span>Remaining estimate</span></div>}
      </div></section></AnimatedContent>
      <AnimatedContent {...reveal}><div className="roadmap-layout">
        <section className="roadmap-navigator" aria-labelledby="roadmap-navigator-title"><h2 id="roadmap-navigator-title">Roadmap navigator</h2>
          {items.length ? <BranchedMenu items={items} value={selected?.id ?? ''} defaultOpen={selectedSection} onSelect={setSelectedId} color="#F5F7FF" accentColor="#7C6CFF" lineColor="rgba(158,168,199,0.22)" width={280} rowHeight={38} indent={42} trunk={14} radius={10} lineWidth={1.4} fontSize={13} drawDuration={360} foldDuration={260} /> : <p>No sections have been returned yet.</p>}
        </section>
        {selected ? <RoadmapTopicCard topic={selected} topics={data.topics} onSelect={setSelectedId} /> : <section className="roadmap-state"><h2>No topics yet</h2><p>This roadmap has no topics available to display.</p></section>}
      </div></AnimatedContent>
      {data.topics.length > 0 && <section className="roadmap-flow" aria-label="Roadmap flow">{data.sections.map(section => <AnimatedContent {...reveal} key={section.id}><section className="roadmap-flow-section"><h2>{section.title}</h2><ol>{data.topics.filter(topic => topic.sectionId === section.id).map(topic => <li key={topic.id}><button type="button" className="roadmap-flow-topic" aria-current={topic.id === selected?.id ? 'true' : undefined} onClick={() => setSelectedId(topic.id)}><span className="roadmap-flow-title">{topic.title}</span><TopicStatus status={topic.status} />{topic.suggestedByAthena === true && <span className="roadmap-suggestion">ATHENA Suggestion</span>}</button></li>)}</ol></section></AnimatedContent>)}</section>}
    </>}
  </main>
}
