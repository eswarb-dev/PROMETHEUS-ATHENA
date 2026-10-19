import { normalizeDirections } from './learningDirections.js'
import { splitReminderTime, joinReminderTime } from './reminderTime.js'
export const selfReportedLevels = ['not_rated', 'beginner', 'comfortable', 'strong']
export const selfReportOptions = [['not_rated', 'Not rated'], ['beginner', 'Beginner'], ['comfortable', 'Comfortable'], ['strong', 'Strong']]
export const dailyStudyOptions = [[15, '15 min'], [30, '30 min'], [45, '45 min'], [60, '1 hour'], [90, '1.5 hours'], [120, '2+ hours']]
export const studyPeriods = [['morning', 'Morning'], ['afternoon', 'Afternoon'], ['evening', 'Evening'], ['night', 'Night'], ['flexible', 'Flexible']]
export const learningStyles = [['build_first', 'Build first'], ['theory_first', 'Theory first'], ['balanced', 'Balanced'], ['practice_heavy', 'Practice-heavy']]
export const taskSizes = [['quick', 'Quick 15–25 min'], ['focused', 'Focused 30–60 min'], ['deep', 'Deep 1–2 hour sessions']]
export const preferenceDefinitions = [['dailyStudyMinutes', 'Available time per day', dailyStudyOptions], ['studyPeriod', 'Preferred study period', studyPeriods], ['learningStyle', 'Learning preference', learningStyles], ['taskSize', 'Preferred task size', taskSizes]]
export const preferenceLabel = (key, value) => preferenceDefinitions.find(item => item[0] === key)?.[2].find(item => item[0] === value)?.[1] ?? (value == null ? 'Not provided' : key === 'dailyStudyMinutes' ? `${value} min` : value)
export const validPreference = (key, value) => key === 'dailyStudyMinutes' ? Number.isInteger(value) && value > 0 && value <= 1440 : preferenceDefinitions.find(item => item[0] === key)?.[2].some(item => item[0] === value) === true
export function normalizeOnboarding({ account, goal, directions, skills, startingFromScratch = false, studyPreferences, notifications }) {
  const selected = normalizeDirections(directions)
  if (typeof notifications.studyReminders !== 'boolean' || typeof notifications.weeklyReport !== 'boolean') throw Error('INVALID_REMINDER_PREFERENCES')
  if (typeof startingFromScratch !== 'boolean' || startingFromScratch && skills.length) throw Error('INVALID_ONBOARDING_PAYLOAD')
  const result = { account: { name: account.name.trim(), email: account.email.trim() }, directions: selected, startingFromScratch, goal: { direction: selected.find(item => item.isPrimary).name, description: goal.description.trim() }, skills: skills.map(skill => ({ name: skill.name.trim(), normalizedName: skill.name.trim().toLowerCase(), selfReportedLevel: skill.selfReportedLevel })), studyPreferences: Object.fromEntries(preferenceDefinitions.map(([key]) => [key, studyPreferences[key]])), notifications: { studyReminders: notifications.studyReminders, weeklyReport: notifications.weeklyReport, preferredReminderTime: joinReminderTime(splitReminderTime(notifications.preferredReminderTime)), timezone: notifications.timezone || 'Asia/Kolkata' } }
  if (!result.account.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.account.email) || !result.goal.direction || !result.goal.description || result.skills.some(skill => !skill.name || !selfReportedLevels.includes(skill.selfReportedLevel)) || new Set(result.skills.map(skill => skill.name.toLowerCase())).size !== result.skills.length || preferenceDefinitions.some(([key]) => !validPreference(key, result.studyPreferences[key]))) throw Error('INVALID_ONBOARDING_PAYLOAD')
  return result
}
