export default function AthenaUnavailableState({ disabled = false }) {
  return <section className="athena-chat-state"><h2>{disabled ? 'ATHENA chat is currently unavailable.' : 'ATHENA intelligence is not connected yet.'}</h2>{!disabled && <p>Connect the ATHENA backend to ask questions, review your roadmap and receive adaptive guidance.</p>}</section>
}
