export function readSupabaseConfig(env = import.meta.env ?? {}) {
  const url = env.VITE_SUPABASE_URL?.trim()
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  try {
    const parsed = new URL(url)
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/' || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key ?? '')) return null
    return { url: parsed.origin, key }
  } catch { return null }
}
export const supabaseConfig = readSupabaseConfig()
