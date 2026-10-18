import { supabase } from './client.js'
import { DataError, normalizeError } from './errors.js'
import { sessionIdentity } from '../auth/sessionIdentity.js'
export async function rpc(name, args = {}, { signal } = {}, client = supabase) {
  if (!client) throw new DataError('SUPABASE_NOT_CONFIGURED')
  try {
    let request = client.rpc(name, args)
    request = request.abortSignal(signal ?? sessionIdentity.signal)
    const { data, error } = await request
    if (error) throw error
    return data
  } catch (error) { throw normalizeError(error) }
}
