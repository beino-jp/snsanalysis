// Log only fixed identifiers. Provider/DB errors may contain credentials or user data.
export type AuthStage='configuration'|'origin'|'input'|'supabase_login'|'supabase_verify'|'invitation_access'|'database_session'|'password_update'|'session_cookie';
const reasons=new Set(['UNCLASSIFIED','TIMEOUT','INVITATION_AUTH_REQUIRED','INVALID_AUTH_ORIGIN','INVITATION_NOT_ALLOWED','PASSWORD_UPDATE_UNCONFIRMED','LINK_ALREADY_USED','DATABASE_BINDING_MISSING','LOGIN_FAILED','FORBIDDEN','INVALID_INPUT','28P01','28000','3D000','42P01','42501','ETIMEDOUT','ECONNREFUSED','ENOTFOUND','ECONNRESET']);
function safeReason(error:unknown){
 if(!error||typeof error!=='object')return 'UNCLASSIFIED';
 const e=error as {code?:unknown;message?:unknown;name?:unknown};
 if(typeof e.code==='string'&&reasons.has(e.code))return e.code;
 if(typeof e.message==='string'&&reasons.has(e.message))return e.message;
 if(e.name==='ZodError')return 'INVALID_INPUT';
 if(e.name==='TimeoutError'||e.name==='AbortError')return 'TIMEOUT';
 return 'UNCLASSIFIED';
}
export class AuthFlowError extends Error{
 constructor(readonly stage:AuthStage,readonly reason:string){super(reason);}
}
export async function authStep<T>(stage:AuthStage,operation:()=>T|Promise<T>):Promise<T>{
 try{return await operation();}
 catch(error){if(error instanceof AuthFlowError)throw error;throw new AuthFlowError(stage,safeReason(error));}
}
export function reportAuthFailure(operation:'login'|'password_setup',error:unknown){
 const stage=error instanceof AuthFlowError?error.stage:'input';
 const reason=error instanceof AuthFlowError&&reasons.has(error.reason)?error.reason:safeReason(error);
 console.error(JSON.stringify({event:'AUTH_FLOW_FAILED',operation,stage,reason}));
}
