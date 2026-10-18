import useAthena from '../../hooks/useAthena.js'
import DataAccessState from '../DataAccessState.jsx'
import StatusMark from './StatusMark.jsx'
import PromptBar from './PromptBar.jsx'
import AthenaConversation from './AthenaConversation.jsx'
import AthenaSkeleton from './AthenaSkeleton.jsx'
import AthenaUnavailableState from './AthenaUnavailableState.jsx'
import { statusLabels } from './athenaStatus.js'
import './AthenaPage.css'

export default function AthenaPage() {
  const athena = useAthena()
  return <main className="athena-chat-page"><header className="athena-chat-header"><p>PROMETHEUS // ATHENA</p><h1>ATHENA</h1><p>Your adaptive study mentor.</p>
    {athena.status === 'loaded' && <StatusMark status={athena.agentStatus} label={statusLabels[athena.agentStatus]} color="#B7C0DB" doneColor="#49D7A5" errorColor="#FF758F" size={18} strokeWidth={2} dashes={8} fontSize={13} spinDuration={1100} arcLength={0.68} drawDuration={220} fillOpacity={0.06} strike={false} />}
  </header>
    {athena.status === 'loading' && <AthenaSkeleton />}
    {athena.status === 'auth-required' && <DataAccessState />}
    {['unavailable', 'disabled'].includes(athena.status) && <AthenaUnavailableState disabled={athena.status === 'disabled'} />}
    {athena.status === 'error' && <section className="athena-chat-state" role="alert"><h2>Couldn't load ATHENA.</h2><button className="athena-chat-button" type="button" onClick={athena.retry}>Retry</button></section>}
    {athena.status === 'loaded' && <div className="athena-chat-workspace">
      <AthenaConversation messages={athena.messages} activeMessageId={athena.activeMessageId} elapsed={athena.elapsed} capabilities={athena.capabilities} busy={athena.busy} agentStatus={athena.agentStatus} onRetry={athena.retryMessage} onRetryCall={athena.retryCall} />
      <div className="athena-chat-notice" role="status" aria-live="polite">{athena.notice}</div>
      {athena.capabilities.chat && <div className="athena-chat-composer"><PromptBar placeholder="Ask ATHENA about your learning..." sources={athena.capabilities.sources} commands={athena.capabilities.commandOptions} models={[]} efforts={[]} busy={athena.busy} onSend={athena.send} onStop={athena.stop} background="rgba(12,18,35,0.92)" color="#F5F7FF" menuBackground="#12182B" sparkColor="#7C6CFF" sparkBoost={0.7} width={760} radius={18} maxRows={6} morphDuration={220} squash={0.10} tilt={6} pressScale={0.97} /></div>}
    </div>}
  </main>
}
