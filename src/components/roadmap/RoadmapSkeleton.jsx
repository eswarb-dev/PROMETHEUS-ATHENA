export default function RoadmapSkeleton() {
  return <div className="roadmap-skeleton" role="status" aria-label="Loading roadmap" aria-busy="true">
    <div className="roadmap-skeleton-summary" aria-hidden="true" />
    <div className="roadmap-layout" aria-hidden="true"><div /><div /></div>
    <div className="roadmap-skeleton-topics" aria-hidden="true">{[0, 1, 2].map(key => <div key={key} />)}</div>
  </div>
}
