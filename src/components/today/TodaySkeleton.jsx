export default function TodaySkeleton() {
  return <div className="today-skeleton" role="status" aria-label="Loading today's plan" aria-busy="true"><div className="today-skeleton-summary" aria-hidden="true" /><div className="today-layout" aria-hidden="true"><div className="today-skeleton-rows">{[0, 1, 2, 3].map(id => <div key={id} />)}</div><div className="today-skeleton-focus" /></div></div>
}
