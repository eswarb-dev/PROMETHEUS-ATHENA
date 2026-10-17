import { Tick02Icon, CircleIcon, Target01Icon, Idea01Icon, Alert02Icon } from '@hugeicons/core-free-icons'

export const roadmapStatus = {
  completed: { label: 'Completed', color: '#49D7A5', icon: Tick02Icon, description: 'Completed topic' },
  current: { label: 'Current', color: '#A599FF', icon: Target01Icon, description: 'Currently studying' },
  planned: { label: 'Planned', color: '#B7C0DB', icon: CircleIcon, description: 'Planned study topic' },
  suggested: { label: 'Suggested', color: '#37D7FF', icon: Idea01Icon, description: 'Suggested topic' },
  gap: { label: 'Prerequisite Gap', color: '#FFBE55', icon: Alert02Icon, description: 'Prerequisite needs review' },
}
