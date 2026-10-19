export type Env = (name: string)=>string|undefined
export type OAuthConfig = {clientId:string;clientSecret:string}
export type OAuthTokens = {accessToken:string;refreshToken?:string;expiresIn:number;scopes:string[]}
export type GmailPart = {mimeType?:string;filename?:string;headers?:Array<{name:string;value:string}>;body?:{data?:string;attachmentId?:string;size?:number};parts?:GmailPart[]}
export type GmailMessage = {id:string;threadId:string;internalDate:string;labelIds?:string[];snippet?:string;payload?:GmailPart}
export type InboundMessage = {providerMessageId:string;providerThreadId:string;direction:'inbound';senderEmail:string;senderName:string|null;toAddresses:string[];ccAddresses:string[];subject:string;textBody:string|null;sanitizedHtmlBody:string|null;snippet:string|null;internalDate:string;hasAttachments:boolean}
export interface GmailStore {
  hasRefreshToken():Promise<boolean>
  createState(hash:string,verifier:string):Promise<boolean>
  consumeState(hash:string):Promise<string|null>
  saveConnection(mailbox:string,scopes:string[],refreshToken?:string):Promise<boolean>
  readRefreshToken():Promise<string|null>
  recordRefresh(error?:'GMAIL_REAUTHORIZE'|'GMAIL_UNAVAILABLE'):Promise<void>
  storeMessage(message:InboundMessage):Promise<{stored:boolean;duplicate:boolean}>
}
