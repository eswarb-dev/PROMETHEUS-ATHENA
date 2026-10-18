export default function ProgressSkeleton() {
  return <div className="progress-skeleton" role="status" aria-label="Loading progress analytics"><div>{[0, 1, 2, 3].map(index => <span key={index} />)}</div><span /><span /><span /></div>
}
