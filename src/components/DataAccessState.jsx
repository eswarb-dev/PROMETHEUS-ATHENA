export default function DataAccessState({ home = false }) {
  return <section className="data-access-state" role="status"><h2>Sign in required</h2><p>{home ? 'Sign in to view your learning dashboard.' : 'Sign in to view your learning data. Account access will be available in a later phase.'}</p></section>
}
