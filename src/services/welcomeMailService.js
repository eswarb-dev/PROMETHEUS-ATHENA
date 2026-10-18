import { supabase } from '../lib/supabase/client.js'
const attempted = new Set()
export async function requestWelcomeMail(userId) {
  if (!supabase || !userId || attempted.has(userId)) return
  attempted.add(userId)
  try { await supabase.functions.invoke('send-welcome-email', { body: {} }) } catch { /* Onboarding remains complete when mail is unavailable. */ }
}
