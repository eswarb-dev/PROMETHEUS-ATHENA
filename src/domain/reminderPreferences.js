export const personalEmailRecommendation = 'Recommended: use your personal email so ATHENA messages arrive in the inbox you regularly check.'
export const notificationFields = ['studyReminders', 'weeklyReport', 'preferredReminderTime', 'timezone']
export function reminderHelp(capabilities = {}) {
  return capabilities.emailReminderDelivery === true ? 'ATHENA sends reminders only to your verified account email.' : 'Email reminder delivery is currently unavailable. Your preferences can still be saved.'
}
