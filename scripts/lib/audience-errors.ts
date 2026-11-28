export function safeAudienceError(e:unknown){
 const x=e as {status?:number;name?:string;code?:string;message?:string;issues?:{path:(string|number)[];code:string}[]};
 const status=Number.isInteger(x?.status)?x.status:undefined;
 const known=['insufficient_quota','invalid_api_key','model_not_found','rate_limit_exceeded'];
 const fields=new Set(['username','status','gender','age','interests','description','value','confidence','reason','evidence']);
 return {httpStatus:status,kind:x?.name==='ZodError'?'OUTPUT_SCHEMA':x?.name==='SyntaxError'?'OUTPUT_JSON':status?'API_ERROR':'LOCAL_ERROR',
 code:known.includes(x?.code??'')?x.code:x?.message==='PROFILE_INPUTS_MISSING'?'PROFILE_INPUTS_MISSING':x?.message==='AI_REFUSAL'?'AI_REFUSAL':'CHECK_REQUIRED',
 issues:x?.name==='ZodError'?x.issues?.map(i=>({path:i.path.filter(p=>typeof p==='number'||fields.has(p)).join('.'),code:i.code})):undefined};
}
