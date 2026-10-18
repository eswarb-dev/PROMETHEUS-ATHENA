const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
export function welcomeTemplate(name: string, appUrl: string) {
  const url = new URL(appUrl)
  if (url.username || url.password || !(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname)))) throw Error('MAIL_CONFIG')
  const label = name.replace(/[\r\n]/g, ' ').slice(0,120) || 'learner'
  return {
    subject: 'Welcome to ATHENA',
    text: `PROMETHEUS // ATHENA\nAdaptive Study Mentor\n\nWelcome, ${label}.\nYour learning profile is ready. ATHENA can now help with roadmaps, daily study planning, knowledge tracking and progress.\n\nOpen ATHENA: ${url.href}`,
    html: `<!doctype html><html lang="en"><body style="margin:0;background:#080D1A;color:#F5F7FF;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellpadding="24"><tr><td align="center"><table role="presentation" width="100%" style="max-width:560px;background:#12182B" cellpadding="24"><tr><td><p style="color:#37D7FF">PROMETHEUS // ATHENA</p><p style="color:#9EA8C7">Adaptive Study Mentor</p><h1>Welcome, ${escape(label)}.</h1><p>Your learning profile is ready.</p><p>ATHENA can now help with roadmaps, daily study planning, knowledge tracking and progress.</p><p><a style="color:#C4BBFF" href="${escape(url.href)}">Open ATHENA</a></p></td></tr></table></td></tr></table></body></html>`,
  }
}
