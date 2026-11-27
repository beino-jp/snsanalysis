import { NextRequest,NextResponse } from 'next/server';
import { requireMutation } from '@/server/auth';
import { liveLimits,liveUrl,LIVE_CEILING_YEN } from '@/server/live/budget';
export async function POST(req:NextRequest){
  try{
    await requireMutation();
    const input=await req.json() as {url?:unknown};
    if(typeof input.url!=='string'||input.url.length>500)throw Error('URL_REQUIRED');
    const url=liveUrl(input.url);
    const {monthly}=liveLimits();
    return NextResponse.json({url,ceilingYen:LIVE_CEILING_YEN,monthlyApiBudgetYen:monthly,scope:'投稿1件・コメント最大20件・プロフィール最大20人。返信・いいねユーザー一覧は対象外です。',note:'無料枠などの制限で取得数が減る場合があります。性別・年代は本人の明示情報がなければ不明です。'});
  }catch{
    return NextResponse.json({error:'現在は実データ分析の準備中です。投稿URLと利用設定を管理者に確認してください。'},{status:400});
  }
}
