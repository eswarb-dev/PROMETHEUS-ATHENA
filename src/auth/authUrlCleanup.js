export function clearAuthUrlErrors(current = globalThis.location, navigation = globalThis.history) {
  if (!current || !navigation) return
  const url = new URL(current.href)
  const fields = ['error', 'error_code', 'error_description']
  let changed = false
  for (const key of fields) { if (url.searchParams.has(key)) changed = true; url.searchParams.delete(key) }
  const fragment = new URLSearchParams(url.hash.slice(1))
  for (const key of fields) { if (fragment.has(key)) changed = true; fragment.delete(key) }
  if (!changed) return
  url.hash = fragment.toString()
  navigation.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}
