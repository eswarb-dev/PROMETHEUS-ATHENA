// Operator-only CLI. No frontend imports and no credential persistence.
const secret=process.env.GMAIL_OAUTH_BOOTSTRAP_SECRET
if(!secret||secret.length<32){console.error('Set GMAIL_OAUTH_BOOTSTRAP_SECRET in this terminal session.');process.exitCode=1}
else {
  try {
    const response=await fetch('https://frvradlyzonrghjoachd.supabase.co/functions/v1/gmail-oauth-start',{method:'POST',headers:{'x-athena-gmail-bootstrap':secret},redirect:'error',signal:AbortSignal.timeout(15000)})
    const data=await response.json()
    if(!response.ok||typeof data.authorizationUrl!=='string')throw Error()
    const url=new URL(data.authorizationUrl)
    if(url.origin!=='https://accounts.google.com'||url.pathname!=='/o/oauth2/v2/auth')throw Error()
    console.log('Open this one-time authorization URL within 10 minutes:')
    console.log(url.toString())
  }catch{console.error('Gmail OAuth could not start. Check server configuration; no credentials were printed.');process.exitCode=1}
}
