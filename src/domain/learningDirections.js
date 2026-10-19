export const directionPresets = ['AI / Machine Learning', 'Full-Stack Development', 'Data Science', 'Mobile Development', 'Cybersecurity', 'Cloud / DevOps', 'Research / Higher Studies', 'Placement Preparation']
export const directionLimit = 3
export const directionKey = name => name.trim().replace(/\s+/g, ' ').toLowerCase()
export function normalizeDirections(directions) {
  if (!Array.isArray(directions) || directions.length < 1 || directions.length > directionLimit) throw Error('INVALID_DIRECTIONS')
  const result = directions.map(item => ({ name: typeof item.name === 'string' ? item.name.trim().replace(/\s+/g, ' ') : '', isPrimary: item.isPrimary, source: item.source }))
  if (result.some(item => !item.name || item.name.length > 200 || typeof item.isPrimary !== 'boolean' || !['preset', 'custom'].includes(item.source) || item.source === 'preset' && !directionPresets.includes(item.name)) || result.filter(item => item.isPrimary).length !== 1 || new Set(result.map(item => directionKey(item.name))).size !== result.length) throw Error('INVALID_DIRECTIONS')
  return result
}
export function toggleDirection(current, name, source = 'preset') {
  const existing = current.find(item => directionKey(item.name) === directionKey(name))
  if (existing) return current.filter(item => item !== existing).map(item => ({ ...item, isPrimary: existing.isPrimary ? false : item.isPrimary }))
  if (current.length >= directionLimit) return current
  return [...current, { name: name.trim().replace(/\s+/g, ' '), source, isPrimary: current.length === 0 }]
}
