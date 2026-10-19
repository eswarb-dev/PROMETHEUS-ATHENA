export async function schedulerAuthorized(supplied: string | null, expected: string | undefined) {
  if (!supplied || !expected || expected.length<32) return false
  const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))
  const [left,right] = await Promise.all([digest(supplied),digest(expected)])
  let difference = 0
  for (let index=0;index<left.length;index++) difference |= left[index]^right[index]
  return difference === 0
}
