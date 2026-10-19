import { GmailError } from './errors.ts'
export async function readJson(response: Response, maxBytes=65536):Promise<Record<string,unknown>> {
  if (!response.body) throw new GmailError('GMAIL_UNAVAILABLE')
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0
  try {
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes){await reader.cancel();throw new GmailError('GMAIL_UNAVAILABLE')}chunks.push(value)}
    const data=new Uint8Array(size);let offset=0
    for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length}
    const parsed=JSON.parse(new TextDecoder().decode(data))
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new GmailError('GMAIL_UNAVAILABLE')
    return parsed
  }catch{throw new GmailError('GMAIL_UNAVAILABLE')}
  finally{reader.releaseLock()}
}
