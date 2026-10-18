import { Tick02Icon, BookOpen01Icon, Idea01Icon, Alert02Icon, CircleIcon } from '@hugeicons/core-free-icons'

export const knowledgeStatus = {
  known: { label: 'Known', color: '#49D7A5', icon: Tick02Icon, description: 'Classified as known by the data source' },
  learning: { label: 'Learning', color: '#B4AAFF', icon: BookOpen01Icon, description: 'Currently learning' },
  suggested: { label: 'Suggested', color: '#37D7FF', icon: Idea01Icon, description: 'Suggested knowledge topic' },
  gap: { label: 'Possible knowledge gap', color: '#FFBE55', icon: Alert02Icon, description: 'A possible gap reported by the data source' },
  unclassified: { label: 'Unclassified', color: '#B7C0DB', icon: CircleIcon, description: 'No knowledge classification supplied' },
}
export const verificationLabels = { untested: 'Not tested', verified: 'Verified', needs_review: 'Needs review' }
export const knowledgeFilters = [{ label: 'All', value: 'all' }, { label: 'Known', value: 'known' }, { label: 'Learning', value: 'learning' }, { label: 'Suggested', value: 'suggested' }, { label: 'Gaps', value: 'gap' }]
export const matchesKnowledgeFilter = (topic, filter) => filter === 'all' || (filter === 'suggested' ? topic.knowledgeState === 'suggested' || topic.suggestedByAthena === true : topic.knowledgeState === filter)
