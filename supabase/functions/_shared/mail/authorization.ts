export function validWelcomeBody(body: string) {
  return body.trim() === '' || body.trim() === '{}'
}
