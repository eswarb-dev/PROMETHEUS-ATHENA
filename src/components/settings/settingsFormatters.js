export { preferenceLabel } from '../../domain/studyPreferences.js'
export const settingsSections = [{ label: 'Profile' }, { label: 'Study Preferences' }, { label: 'Notifications' }, { label: 'Account' }]
export const changedFields = (draft, original, keys) => Object.fromEntries(keys.filter(key => draft[key] !== (original?.[key] ?? '')).map(key => [key, typeof draft[key] === 'string' ? draft[key].trim() : draft[key]]).filter(([key, value]) => value !== original?.[key]))
export const settingsDate = value => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value))
