export default function TodayEmptyState({ status, onRetry }) {
  return <section className="today-state" role="status"><p className="today-eyebrow">{status === 'unavailable' ? 'Data source unavailable' : status === 'error' ? 'Request failed' : 'Your daily plan'}</p>
    <h2>{status === 'unavailable' ? 'Live study-plan data is not connected yet.' : status === 'error' ? "Couldn't load today's plan." : 'Nothing planned for today'}</h2>
    <p>{status === 'unavailable' ? "Connect the ATHENA backend to load today's tasks." : status === 'error' ? 'Try again to load your scheduled study tasks.' : 'No study tasks have been scheduled for today.'}</p>
    {status === 'error' && <button type="button" className="today-retry" onClick={onRetry}>Retry</button>}
  </section>
}
