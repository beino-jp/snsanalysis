import {NextRequest,NextResponse} from 'next/server';
import {cookieOptions,requireOrigin} from '@/server/auth';
import {finishPasswordSetup} from '@/server/password-setup';
export async function POST(req:NextRequest){
 try{
  await requireOrigin();
  const text=await req.text();
  if(Buffer.byteLength(text)>8192)throw Error('INVALID_INPUT');
  const cookie=await finishPasswordSetup(JSON.parse(text));
  const res=NextResponse.json({ok:true});
  res.cookies.set('reach-session',cookie,cookieOptions());
  res.headers.set('Cache-Control','no-store');
  return res;
 }catch{
  return NextResponse.json({error:'設定を完了できませんでした。招待先のメールアドレスとパスワードの条件を確認してください。再試行せず、管理者に新しいリンクを依頼してください。'},{status:400,headers:{'Cache-Control':'no-store'}});
 }
}
