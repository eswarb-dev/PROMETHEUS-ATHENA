import KnowledgeTopicRow from './KnowledgeTopicRow.jsx'

const emptyLabels = { all: 'No topics available.', known: 'No topics classified as known.', learning: 'No topics currently being learned.', suggested: 'No suggested topics.', gap: 'No knowledge gaps detected.' }
export default function KnowledgeTopicList({ topics, filter, selectedId, onSelect }) {
  return <section className="knowledge-topics" aria-labelledby="knowledge-topics-title"><h2 id="knowledge-topics-title">Knowledge topics</h2>{topics.length ? <ul>{topics.map(topic => <KnowledgeTopicRow key={topic.id} topic={topic} selected={topic.id === selectedId} onSelect={onSelect} />)}</ul> : <p className="knowledge-filter-empty" role="status">{emptyLabels[filter]}</p>}</section>
}
