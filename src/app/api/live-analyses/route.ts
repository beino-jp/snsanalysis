import { NextRequest,NextResponse } from 'next/server';
import { requireAuth,requireMutation } from '@/server/auth';
import { ownedLive,reserveLive,liveRequest } from '@/server/live/budget';
import { dispatchLive } from '@/server/live/dispatch';
import { liveView } from '@/server/live/view';
export async function GET(){
  try{return NextResponse.json((await ownedLive(await requireAuth())).map(liveView));}
  catch{return NextResponse.json({error:'ログインと接続設定を確認してください。'},{status:401});}
}
export async function POST(req:NextRequest){
  try{
    const owner=await requireMutation();
    if(process.env.DEPLOY_TARGET!=='cloudflare')throw Error('WORKFLOW_REQUIRED');
    const input=liveRequest.parse(await req.json());
    const r=await reserveLive(owner,input);
    if(r.created)await dispatchLive(r.id);
    return NextResponse.json({id:r.id});
  }catch(e){
    const message=e instanceof Error&&e.message==='MONTHLY_BUDGET_LIMIT'?'今月の分析費用枠が不足しています。実行中の分析の完了を待つか、管理者にお問い合わせください。':'開始を確認できませんでした。履歴を確認し、同じ分析を繰り返し登録しないでください。';
    return NextResponse.json({error:message},{status:400});
  }
}
