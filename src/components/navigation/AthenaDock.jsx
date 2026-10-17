import { HugeiconsIcon } from '@hugeicons/react'
import {
  Home01Icon,
  Route01Icon,
  Task01Icon,
  BookOpen01Icon,
  ArtificialIntelligence01Icon,
  Analytics01Icon,
  Settings01Icon,
} from '@hugeicons/core-free-icons'
import Dock from './Dock.jsx'

const sections = [
  ['Home', Home01Icon],
  ['Roadmap', Route01Icon],
  ['Today', Task01Icon],
  ['Knowledge', BookOpen01Icon],
  ['ATHENA', ArtificialIntelligence01Icon],
  ['Progress', Analytics01Icon],
  ['Settings', Settings01Icon],
]

export default function AthenaDock({ activeSection, onSelect }) {
  const items = sections.map(([label, icon]) => ({
    label,
    icon: <HugeiconsIcon icon={icon} size="1em" strokeWidth={1.6} aria-hidden="true" />,
    active: activeSection === label,
    onClick: () => onSelect(label),
  }))
  items.splice(6, 0, { separator: true })

  return (
    <nav className="athena-navigation" aria-label="ATHENA navigation">
      <Dock
        items={items}
        position="left"
        theme="dark"
        baseItemSize={46}
        magnification={62}
        distance={150}
        panelHeight={62}
        gap={8}
        roundness={0.7}
        bounce={true}
        autoHide={false}
        tiles={true}
        showLabels={true}
        showIndicators={true}
        showBadges={true}
        accentColor="#7C6CFF"
        className="athena-dock"
        style={{
          '--dock-panel': 'rgba(12, 18, 35, 0.66)',
          '--dock-tile': 'rgba(255, 255, 255, 0.035)',
          '--dock-tile-shadow': 'none',
          '--dock-label': '#10182b',
          '--dock-dot': '#7C6CFF',
        }}
      />
    </nav>
  )
}
