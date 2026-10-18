const key = 'athena:recovery-owner'
// A tab-local routing marker only. Supabase continues to own all session tokens.
export function recoveryOwner(storage) {
  try { return (storage ?? globalThis.sessionStorage)?.getItem(key) ?? null } catch { return null }
}
export function rememberRecovery(ownerId, storage) {
  try { const target = storage ?? globalThis.sessionStorage; if (ownerId) target?.setItem(key, ownerId); else target?.removeItem(key) } catch { /* Storage may be unavailable in private browsing. */ }
}
