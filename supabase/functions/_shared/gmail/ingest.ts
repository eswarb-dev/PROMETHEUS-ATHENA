import { normalizeGmailMessage } from './mime.ts'
import type { GmailMessage, GmailStore } from './types.ts'
// Phase 15A-1 exposes no HTTP or scheduled entry point for ingestion.
export function persistInboundMessage(message:GmailMessage,store:GmailStore){return store.storeMessage(normalizeGmailMessage(message))}
