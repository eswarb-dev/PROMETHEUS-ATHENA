// @deno-types="npm:@types/nodemailer@7.0.11"
import nodemailer from 'npm:nodemailer@10.1.2'
import { mailConfig } from './mailer.ts'
export function createMailTransport(get: (key: string) => string | undefined) {
  const config = mailConfig(get)
  const transport = nodemailer.createTransport(config)
  return {
    async sendTransactionalMail(recipient: string, content: { subject: string; text: string; html: string }) {
      return await transport.sendMail({ from: config.from, to: recipient, ...content })
    },
    close: () => transport.close(),
  }
}
