export function createDemoProfile() {
  return {
    account: { name: 'Eswar B', email: 'eswarbalu28@gmail.com', avatarUrl: null },
    goal: { direction: 'AI / Machine Learning', description: 'Applied AI Engineer' },
    skills: ['Python', 'React', 'Git', 'RAG'].map(name => ({ name, selfReportedLevel: 'comfortable', verifiedLevel: null, confidenceScore: null })),
    preferences: { dailyStudyMinutes: 60, studyPeriod: 'Evening', learningStyle: 'Build first', taskSize: 'Focused 30–60 min', reminderPreference: 'None' },
  }
}

export const sampleLearningStats = [
  ['Learning path', 'Applied AI / RAG'],
  ['Topics completed', '12'],
  ['Current streak', '4 days'],
  ['Weekly focus', '8h 20m'],
  ['Knowledge checks', '2 pending'],
]
