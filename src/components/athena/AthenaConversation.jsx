import { useLayoutEffect, useRef, useState } from 'react'
import AthenaMessage from './AthenaMessage.jsx'
import AthenaEmptyState from './AthenaEmptyState.jsx'

export default function AthenaConversation({ messages, activeMessageId, elapsed, capabilities, busy, agentStatus, onRetry, onRetryCall }) {
  const region = useRef(null)
  const nearBottom = useRef(true)
  const [unseen, setUnseen] = useState(false)
  useLayoutEffect(() => {
    const node = region.current
    if (nearBottom.current) node.scrollTop = node.scrollHeight
    else setUnseen(true)
  }, [messages])
  const jump = () => { const node = region.current; node.scrollTop = node.scrollHeight; nearBottom.current = true; setUnseen(false) }
  return <div className="athena-conversation-wrap"><section ref={region} className="athena-conversation" role="region" aria-label="ATHENA conversation" tabIndex={0} onScroll={() => { const node = region.current; nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 70; if (nearBottom.current) setUnseen(false) }}>
    {messages.length === 0 ? <AthenaEmptyState /> : messages.map(message => <AthenaMessage key={message.id} message={message} active={message.id === activeMessageId} outcome={agentStatus} elapsed={elapsed} capabilities={capabilities} busy={busy && agentStatus === 'running'} onRetry={onRetry} onRetryCall={onRetryCall} />)}
  </section>{unseen && <button type="button" className="athena-jump athena-chat-button" onClick={jump}>Jump to latest</button>}</div>
}
