import { useMemo, useState } from 'react'
import useKnowledge from '../../hooks/useKnowledge.js'
import PillNav from './PillNav.jsx'
import KnowledgeSkeleton from './KnowledgeSkeleton.jsx'
import KnowledgeEmptyState from './KnowledgeEmptyState.jsx'
import KnowledgeTopicList from './KnowledgeTopicList.jsx'
import KnowledgeTopicDetail from './KnowledgeTopicDetail.jsx'
import { knowledgeFilters, matchesKnowledgeFilter } from './knowledgeStatus.js'
import './KnowledgePage.css'

const metrics = [['knownCount', 'Known'], ['learningCount', 'Learning'], ['suggestedCount', 'Suggested'], ['gapCount', 'Gaps'], ['verifiedCount', 'Verified']]
export default function KnowledgePage() {
  const knowledge = useKnowledge()
  const [filter, setFilter] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const topics = useMemo(() => knowledge.data?.topics.filter(topic => matchesKnowledgeFilter(topic, filter)) ?? [], [knowledge.data, filter])
  const selected = topics.find(topic => topic.id === selectedId)
  const counts = metrics.filter(([key]) => knowledge.data?.summary?.[key] != null)
  const retry = () => { setSelectedId(null); knowledge.retry() }
  return <main className="athena-knowledge"><header className="knowledge-page-header"><p>PROMETHEUS // ATHENA</p><h1>Knowledge</h1><p>Understand what you know and where to grow.</p></header>
    {knowledge.status === 'loading' && <KnowledgeSkeleton />}
    {['unavailable', 'empty', 'error'].includes(knowledge.status) && <KnowledgeEmptyState status={knowledge.status} onRetry={retry} />}
    {knowledge.status === 'loaded' && <>
      <div className="knowledge-filters"><PillNav items={knowledgeFilters} activeItemIndex={knowledgeFilters.findIndex(item => item.value === filter)} onItemClick={item => { setFilter(item.value); setSelectedId(null) }} theme="dark" layout="joined" itemStyle="pill" hoverEffect="glide" indicator="pill" surface="glass" size="sm" highlightColor="#7C6CFF" highlightTextColor="#080D1A" barColor="rgba(12,18,35,0.72)" textColor="#F5F7FF" bounce={0.18} stretch={0.32} collapse="auto" intro={true} ariaLabel="Knowledge filters" /></div>
      {counts.length > 0 && <dl className="knowledge-summary" aria-label="Knowledge summary">{counts.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{knowledge.data.summary[key]}</dd></div>)}</dl>}
      <div className="knowledge-layout"><KnowledgeTopicList topics={topics} filter={filter} selectedId={selected?.id} onSelect={setSelectedId} />
        {selected ? <KnowledgeTopicDetail key={selected.id} topic={selected} canUpdate={knowledge.data.capabilities.updateSelfReport} pending={Object.hasOwn(knowledge.pendingTopics, selected.id) && knowledge.pendingTopics[selected.id] === true} error={Object.hasOwn(knowledge.topicErrors, selected.id) ? knowledge.topicErrors[selected.id] : ''} onPersist={knowledge.updateSelfReport} onRetry={retry} /> : <section className="knowledge-select-prompt"><h2>Select a topic</h2><p>Choose a topic to see its self-reported rating and separate ATHENA verification.</p></section>}
      </div>
    </>}
  </main>
}
