import { mailConfig, mailFailure, SENDER } from './mailer.ts'
import { welcomeTemplate } from './templates.ts'
import { validWelcomeBody } from './authorization.ts'
const check = (value: unknown) => { if (!value) throw Error('Assertion failed') }
Deno.test('sender and SMTP configuration fail closed without credentials', () => {
  for (const values of [{}, { PROMETHEUS_MAIL_FROM: 'other@example.invalid' }]) {
    let rejected = false
    try { mailConfig(key => (values as Record<string,string>)[key]) } catch { rejected = true }
    check(rejected)
  }
  check(SENDER === 'prometheus.inference@gmail.com')
})
Deno.test('recipient and owner cannot be supplied by the caller', () => {
  check(validWelcomeBody('{}'))
  check(!validWelcomeBody('{"toEmail":"other@example.invalid"}'))
  check(!validWelcomeBody('{"userId":"someone-else"}'))
  check(!validWelcomeBody('[]'))
  check(!validWelcomeBody('null'))
})
Deno.test('welcome content escapes user input and excludes tracking', () => {
  const content = welcomeTemplate('<script>unsafe</script>', 'https://athena.example.invalid')
  check(content.html.includes('&lt;script&gt;'))
  check(!/<script|<img|utm_|pixel\.gif/i.test(content.html))
  check(content.text.includes('Your learning profile is ready'))
  let rejected = false
  try { welcomeTemplate('Owner','javascript:alert(1)') } catch { rejected = true }
  check(rejected)
})
Deno.test('SMTP failures never return raw messages and do not retry ambiguous delivery', () => {
  check(mailFailure({ code: 'EAUTH', message: 'private provider detail' }).code === 'MAIL_AUTH')
  check(mailFailure({ responseCode: 421, command: 'MAIL FROM' }).status === 'retry_wait')
  check(mailFailure({ code: 'ETIMEDOUT', command: 'CONN' }).status === 'retry_wait')
  check(mailFailure({ code: 'ETIMEDOUT', command: 'DATA' }).status === 'unknown_delivery')
  check(mailFailure({ responseCode: 550, command: 'RCPT TO' }).status === 'failed')
  check(!JSON.stringify(mailFailure({ message: 'private provider detail' })).includes('private'))
})
