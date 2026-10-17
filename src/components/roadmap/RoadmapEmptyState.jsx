export default function RoadmapEmptyState({ status, onRetry }) {
  return <section className="roadmap-state" role="status">
    <p className="roadmap-state-label">{status === 'unavailable' ? 'Data source unavailable' : status === 'error' ? 'Request failed' : 'Your learning path'}</p>
    <h2>{status === 'unavailable' ? 'Roadmap data source is not connected yet.' : status === 'error' ? "Couldn't load your roadmap." : 'No roadmap yet'}</h2>
    <p>{status === 'unavailable' ? 'Connect the ATHENA backend to begin loading personal learning paths.' : status === 'error' ? 'Please try again to load your learning path.' : 'ATHENA will use your goals, skills and study preferences to build your first learning path.'}</p>
    {status === 'error' && <button type="button" className="roadmap-button" onClick={onRetry}>Retry</button>}
    {status === 'empty' && <><button type="button" className="roadmap-button" disabled aria-describedby="roadmap-coming">Create Roadmap</button><small id="roadmap-coming">Coming with ATHENA intelligence</small></>}
  </section>
}
