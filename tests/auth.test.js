import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAuthService } from '../src/services/authService.js'
import { authErrorMessage, authErrorCategory } from '../src/auth/authErrors.js'
import { recoveryUrl, initialAuthView, maskEmail, otpLength } from '../src/auth/authConfig.js'
import { recoveryOwner, rememberRecovery } from '../src/auth/recoveryState.js'

test('auth service calls only Supabase Auth with scoped payloads and confirmed sessions', async () => {
  const calls = []
  const user = { id: 'auth-contract-owner' }
  const response = { data: { user, session: { user, access_token: 'contract-test-token' } }, error: null }
  const methods = ['signInWithPassword','signUp','verifyOtp','resend','resetPasswordForEmail','updateUser','signOut']
  const client = { auth: Object.fromEntries(methods.map(name => [name, async (...args) => { calls.push({ name, args }); return response }])) }
  const service = createAuthService(client)
  await service.signIn(' owner@example.invalid ', ' untrimmed test password ')
  assert.deepEqual(calls.at(-1), { name: 'signInWithPassword', args: [{ email: 'owner@example.invalid', password: ' untrimmed test password ' }] })
  await service.signUp({ name: ' Owner ', email: 'owner@example.invalid', password: 'signup-test-password', skills: ['Excluded'] })
  assert.deepEqual(calls.at(-1).args[0], { email: 'owner@example.invalid', password: 'signup-test-password', options: { data: { name: 'Owner' } } })
  await service.verifySignupOtp({ email: 'owner@example.invalid', token: '1'.repeat(otpLength) })
  assert.equal(calls.at(-1).args[0].type, 'email')
  await assert.rejects(service.verifySignupOtp({ email: 'owner@example.invalid', token: '1' }), { code: 'otp_expired' })
  await service.resendSignupOtp('owner@example.invalid')
  assert.deepEqual(calls.at(-1).args[0], { type: 'signup', email: 'owner@example.invalid' })
  await service.updateRecoveredPassword('replacement-test-password')
  assert.deepEqual(calls.at(-1).args[0], { password: 'replacement-test-password' })
  await service.signOut()
  client.auth.signInWithPassword = async () => ({ data: { user }, error: null })
  await assert.rejects(service.signIn('owner@example.invalid', 'test-password'), { code: 'session_missing' })
  client.auth.verifyOtp = async () => ({ data: {}, error: { code: 'otp_expired' } })
  await assert.rejects(service.verifySignupOtp({ email: 'owner@example.invalid', token: '1'.repeat(otpLength) }), { code: 'otp_expired' })
})
test('auth distinguishes operational failures without exposing provider detail', () => {
  assert.equal(authErrorCategory({ name: 'AuthRetryableFetchError', status: 500 }), 'AUTH_PROVIDER_ERROR')
  assert.equal(authErrorCategory({ name: 'AuthRetryableFetchError', status: 500, message: 'Error sending confirmation email' }), 'AUTH_MAIL_DELIVERY_ERROR')
  assert.equal(authErrorCategory(new TypeError('fetch failed')), 'AUTH_NETWORK_ERROR')
  assert.equal(authErrorCategory({ status: 429 }), 'AUTH_RATE_LIMITED')
  assert.equal(authErrorCategory({ code: 'email_address_not_authorized' }), 'AUTH_EMAIL_UNAUTHORIZED')
  assert.equal(authErrorCategory({ status: 422 }), 'AUTH_INVALID_REQUEST')
  assert.ok(!authErrorMessage({ name: 'AuthRetryableFetchError', status: 500 }).includes('connection'))
})

test('auth errors and URL handling expose no internal detail or arbitrary destination', () => {
  assert.equal(authErrorMessage({ code: 'invalid_credentials', message: 'private internal detail' }), 'Email or password is incorrect.')
  assert.equal(authErrorMessage({ status: 429 }), 'Too many attempts. Try again shortly.')
  assert.equal(authErrorMessage({ code: 'email_not_confirmed' }), 'Verify your email before signing in.')
  assert.equal(authErrorMessage({ code: 'otp_expired' }), 'The code is invalid or has expired. Request a new code.')
  assert.ok(!authErrorMessage({ message: 'secret internal text' }).includes('secret'))
  assert.equal(recoveryUrl('http://localhost:5173'), 'http://localhost:5173/?auth=reset')
  assert.equal(initialAuthView('?auth=signup&next=https://untrusted.invalid'), 'signup')
  assert.equal(initialAuthView('?auth=https://untrusted.invalid'), 'login')
  assert.equal(initialAuthView('?auth=verify&email=private@example.invalid'), 'login')
  assert.equal(maskEmail('owner@example.invalid'), 'ow***@example.invalid')
  const markers = new Map()
  const storage = { getItem: key => markers.get(key), setItem: (key,value) => markers.set(key,value), removeItem: key => markers.delete(key) }
  rememberRecovery('owner-id', storage)
  assert.equal(recoveryOwner(storage), 'owner-id')
  rememberRecovery(null, storage)
  assert.equal(recoveryOwner(storage), null)
  const blocked = { getItem: () => { throw Error() }, removeItem: () => { throw Error() } }
  assert.equal(recoveryOwner(blocked), null)
  assert.doesNotThrow(() => rememberRecovery(null, blocked))
})
