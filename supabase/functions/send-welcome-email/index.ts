import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
// @deno-types="npm:@types/nodemailer@7.0.11"
import nodemailer from 'npm:nodemailer@10.1.2'
import { mailConfig, mailFailure } from '../_shared/mail/mailer.ts'
import { welcomeTemplate } from '../_shared/mail/templates.ts'
import type { WelcomeClaim } from '../_shared/mail/types.ts'
import { validWelcomeBody } from '../_shared/mail/authorization.ts'

Deno.serve(async request => {
  const appUrl = Deno.env.get('ATHENA_APP_URL') ?? 'http://localhost:5173'
  const origin = request.headers.get('origin')
  const allowed = [new URL(appUrl).origin, 'http://127.0.0.1:5173']
  const headers: Record<string,string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin' }
  if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin
  const respond = (status: number, state: string) => new Response(JSON.stringify({ status: state }), { status, headers })
  if (origin && !allowed.includes(origin)) return respond(403,'forbidden')
  if (request.method === 'OPTIONS') return new Response(null,{ status: 204, headers: { ...headers, 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info', 'Access-Control-Allow-Methods': 'POST' } })
  if (request.method !== 'POST') return respond(405,'method_not_allowed')
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return respond(401,'unauthorized')
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{ auth: { persistSession: false, autoRefreshToken: false } })
    const { data: { user }, error: authError } = await admin.auth.getUser(authorization.slice(7))
    if (authError || !user) return respond(401,'unauthorized')
    if (!user.email_confirmed_at) return respond(403,'email_unverified')
    const body = await request.text()
    if (!validWelcomeBody(body)) return respond(400,'invalid_request')
    const config = mailConfig(key => Deno.env.get(key))
    const template = welcomeTemplate('',appUrl)
    if (!template) return respond(503,'mail_unavailable')
    const { data, error } = await admin.rpc('claim_welcome_mail',{ p_user_id: user.id })
    if (error) return respond(503,'mail_unavailable')
    if (!data) return respond(200,'no_delivery_due')
    const claim = data as WelcomeClaim
    const transport = nodemailer.createTransport(config)
    let result: { status: string; code?: string; messageId?: string }
    try {
      const delivery = await transport.sendMail({ from: config.from, to: claim.email, ...welcomeTemplate(claim.name,appUrl) })
      result = { status: 'sent', messageId: delivery.messageId }
    } catch (error) {
      const failure = mailFailure(error)
      result = { status: failure.status, code: failure.code }
    } finally { transport.close() }
    const { data: recorded, error: recordError } = await admin.rpc('finish_welcome_mail',{ p_id: claim.id, p_claim_token: claim.claimToken, p_status: result.status, p_error_code: result.code ?? null, p_provider_message_id: result.messageId ?? null })
    // A lost acknowledgement leaves 'sending' locked; retries cannot duplicate a possibly accepted email.
    if (recordError || !recorded) return respond(503,'delivery_status_unknown')
    return respond(200,result.status)
  } catch { return respond(503,'mail_unavailable') }
})
