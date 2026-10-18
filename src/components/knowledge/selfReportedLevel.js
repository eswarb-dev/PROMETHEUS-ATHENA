import { selfReportedLevels, selfReportOptions } from '../../domain/studyPreferences.js'
export { selfReportedLevels } from '../../domain/studyPreferences.js'
const labels = selfReportOptions.map(([, label]) => label)
export const selfReportedLevelToSlider = level => Math.max(0, selfReportedLevels.indexOf(level))
export const sliderToSelfReportedLevel = value => selfReportedLevels[Math.min(3, Math.max(0, Math.round(Number(value) || 0)))]
export const formatSelfReportedLevel = value => labels[typeof value === 'string' ? selfReportedLevelToSlider(value) : selfReportedLevelToSlider(sliderToSelfReportedLevel(value))]
