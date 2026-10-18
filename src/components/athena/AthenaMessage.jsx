import { Fragment } from 'react'
import ThoughtLine from './ThoughtLine.jsx'
import CallChip from './CallChip.jsx'

function inline(text) {
  return text.split(/(`[^`]+`)/g).map((part, index) => part.startsWith('`') && part.endsWith('`') ? <code key={index}>{part.slice(1, -1)}</code> : <Fragment key={index}>{part}</Fragment>)
}
function MessageBody({ content }) {
  const blocks = content.split(/(```[^\n]*\n[\s\S]*?(?:```|$))/g)
  return <div className="athena-message-body">{blocks.map((block, index) => {
    if (block.startsWith('```')) return <pre key={index}><code>{block.replace(/^```[^\n]*\n/, '').replace(/```$/, '')}</code></pre>
    const lines = block.split('\n'); const nodes = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line.trim()) continue
      if (/^#{1,3} /.test(line)) { const Tag = `h${Math.min(4, line.match(/^#+/)[0].length + 1)}`; nodes.push(<Tag key={i}>{inline(line.replace(/^#+ /, ''))}</Tag>); continue }
      if (/^\s*(?:[-*] |\d+\. )/.test(line)) {
        const ordered = /^\s*\d+\./.test(line); const Tag = ordered ? 'ol' : 'ul'; const items = []; const start = i
        const pattern = ordered ? /^\s*\d+\. / : /^\s*[-*] /
        while (i < lines.length && pattern.test(lines[i])) { items.push(<li key={i}>{inline(lines[i].replace(pattern, ''))}</li>); i++ }
        i--; nodes.push(<Tag key={start}>{items}</Tag>); continue
      }
      nodes.push(<p key={i}>{inline(line)}</p>)
    }
    return <Fragment key={index}>{nodes}</Fragment>
  })}</div>
}
export default function AthenaMessage({ message, active, outcome, elapsed, capabilities, busy, onRetry, onRetryCall }) {
  const working = active && busy && ['pending', 'streaming'].includes(message.status)
  return <article className={`athena-message athena-message--${message.role}`} aria-label={`${message.role === 'user' ? 'You' : 'ATHENA'} message`}>
    <h2 className="athena-message-author">{message.role === 'user' ? 'You' : 'ATHENA'}</h2>
    {message.role === 'assistant' && <>
      {active && capabilities.progressTrace && message.progress.length > 0 && <ThoughtLine working={working} elapsed={working ? undefined : elapsed} steps={message.progress} label="ATHENA is working…" doneLabel={outcome === 'failed' ? 'Request failed after' : outcome === 'cancelled' ? 'Stopped after' : 'Processed in'} glyph="sparkle" color="#B7C0DB" glyphColor="#7C6CFF" fontSize={14} breathPeriod={1.8} breathDepth={0.28} shimmer={true} shimmerDuration={1.8} settleDuration={320} settleBlur={1.5} collapsible={true} collapseOnSettle={true} showTimer={true} />}
      {!active && capabilities.progressTrace && message.progress.length > 0 && <details className="athena-past-progress"><summary>Processing steps</summary><ul>{message.progress.map(step => <li key={step.id}>{step.label}: {step.status}</li>)}</ul></details>}
      {capabilities.toolCalls && message.toolCalls.length > 0 && <div className="athena-call-list" aria-label="ATHENA actions">{message.toolCalls.map((call, index) => active && index < 8 && (working || call.status !== 'running') ? <CallChip key={call.id} icon={call.kind} name={call.name} argument={call.argument} status={call.status} expectedMs={call.expectedMs} size={30} radius={9} color="#F5F7FF" surfaceColor="rgba(18,24,43,0.90)" progressColor="#7C6CFF" progressOpacity={0.10} doneColor="#49D7A5" errorColor="#FF758F" washOpacity={0.12} shake={4} showTimer={true} onRetry={call.retryable && capabilities.retryCall && !busy ? () => onRetryCall(call.id) : undefined} /> : <span className="athena-past-call" key={call.id}>{call.name}: {call.status}{call.status === 'running' && !working ? ' (last reported)' : ''}</span>)}</div>}
    </>}
    <MessageBody content={message.content} />
    {message.role === 'assistant' && ['failed', 'cancelled'].includes(message.status) && <p className="athena-message-outcome">{message.status === 'failed' ? 'Response failed' : 'Stopped'}</p>}
    {message.role === 'assistant' && message.status === 'failed' && capabilities.retryMessage && !busy && <button type="button" className="athena-chat-button" onClick={() => onRetry(message.id)}>Retry response</button>}
  </article>
}
