// @ts-types="npm:@types/sanitize-html@2.16.2"
import sanitizeHtml from 'npm:sanitize-html@2.18.1'
// @ts-types="npm:@types/nodemailer@7.0.11/lib/addressparser/index.d.ts"
import addressParser from 'npm:nodemailer@10.1.2/lib/addressparser/index.js'
import { BODY_BYTES, MIME_INPUT_BYTES, SYSTEM_MAILBOX } from './constants.ts'
import { GmailError } from './errors.ts'
import type { GmailMessage, GmailPart, InboundMessage } from './types.ts'
const encoder=new TextEncoder()
export const clipUtf8=(value:string,limit:number)=>new TextDecoder().decode(encoder.encode(value).subarray(0,limit),{stream:true})
const header=(part:GmailPart,name:string)=>part.headers?.filter(item=>item.name.toLowerCase()===name.toLowerCase()).slice(0,10).map(item=>item.value).join(', ')??''
function addresses(value:string){
  if(value.length>32768)throw new GmailError('GMAIL_MESSAGE')
  return addressParser(value,{flatten:true}).filter(item=>'address' in item&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(item.address)).slice(0,100).map(item=>({email:item.address.toLowerCase(),name:clipUtf8(item.name??'',1024)}))
}
const safeOptions={allowedTags:['p','br','b','strong','i','em','ul','ol','li','blockquote','pre','code'],allowedAttributes:{},nonTextTags:['script','style','iframe','object','embed','form','textarea','option','noscript','svg','math'],allowProtocolRelative:false}
export function sanitizeMessageHtml(value:string){
  const clean=sanitizeHtml(clipUtf8(value,MIME_INPUT_BYTES),safeOptions)
  return encoder.encode(clean).length<=BODY_BYTES?clean:null
}
function decodePart(data:string){
  // Decode at most the permitted prefix, including for oversized API fixtures.
  const prefix=data.slice(0,Math.ceil(MIME_INPUT_BYTES/3)*4).replaceAll('-','+').replaceAll('_','/')
  try{return clipUtf8(new TextDecoder().decode(Uint8Array.from(atob(prefix),char=>char.charCodeAt(0))),MIME_INPUT_BYTES)}catch{throw new GmailError('GMAIL_MESSAGE')}
}
export function normalizeGmailMessage(message:GmailMessage):InboundMessage {
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(message.id)||!/^[A-Za-z0-9_-]{1,128}$/.test(message.threadId)||!message.payload||message.labelIds?.some(label=>['SENT','DRAFT'].includes(label)))throw new GmailError('GMAIL_MESSAGE')
  const date=Number(message.internalDate)
  if(!/^\d{1,16}$/.test(message.internalDate)||!Number.isFinite(date)||date<=0||date>8640000000000000)throw new GmailError('GMAIL_MESSAGE')
  const from=addresses(header(message.payload,'From')),to=addresses(header(message.payload,'To')),cc=addresses(header(message.payload,'Cc'))
  const delivered=addresses(header(message.payload,'Delivered-To'))
  if(from.length!==1||from[0].email===SYSTEM_MAILBOX||![...to,...cc,...delivered].some(item=>item.email===SYSTEM_MAILBOX))throw new GmailError('GMAIL_MESSAGE')
  const text:string[]=[],html:string[]=[];let attachment=false,parts=0,remaining=MIME_INPUT_BYTES
  const walk=(part:GmailPart,depth:number)=>{
    if(++parts>200||depth>12)throw new GmailError('GMAIL_MESSAGE')
    if(part.filename||part.body?.attachmentId||/\battachment\b/i.test(header(part,'Content-Disposition'))||part.mimeType&&!part.mimeType.startsWith('multipart/')&&!['text/plain','text/html'].includes(part.mimeType)&&part.body?.data){attachment=true;return}
    if(part.body?.data&&['text/plain','text/html'].includes(part.mimeType??'')&&remaining>0){
      const body=clipUtf8(decodePart(part.body.data),remaining);remaining-=encoder.encode(body).length
      ;(part.mimeType==='text/plain'?text:html).push(body)
    }
    for(const child of part.parts??[])walk(child,depth+1)
  }
  walk(message.payload,0)
  const rawHtml=html.join('\n'),safeHtml=rawHtml?sanitizeMessageHtml(rawHtml):null
  const fallback=rawHtml?sanitizeHtml(clipUtf8(rawHtml,MIME_INPUT_BYTES),{...safeOptions,allowedTags:[]}):''
  return {providerMessageId:message.id,providerThreadId:message.threadId,direction:'inbound',senderEmail:from[0].email,senderName:from[0].name||null,
    toAddresses:[...new Set(to.map(item=>item.email))],ccAddresses:[...new Set(cc.map(item=>item.email))],subject:clipUtf8(header(message.payload,'Subject'),4096),
    textBody:clipUtf8(text.length?text.join('\n'):fallback,BODY_BYTES)||null,sanitizedHtmlBody:safeHtml,snippet:message.snippet?clipUtf8(message.snippet,1024):null,
    internalDate:new Date(date).toISOString(),hasAttachments:attachment}
}
