export async function updateSupabasePassword(origin:string,apiKey:string,accessToken:string,password:string){
 // Workers supports follow/manual, not redirect:error. Reject redirects ourselves
 // so a provider redirect cannot forward the bearer or password to another URL.
 const response=await fetch(origin+'/auth/v1/user',{
  method:'PUT',redirect:'manual',
  headers:{apikey:apiKey,Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},
  body:JSON.stringify({password}),signal:AbortSignal.timeout(15000),
 });
 if(!response.ok)throw Error('PASSWORD_UPDATE_UNCONFIRMED');
}
