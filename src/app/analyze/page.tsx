import { redirect } from 'next/navigation';
import { requireAuth,internalEmail } from '@/server/auth';
import { liveLimits } from '@/server/live/budget';
import LiveAnalysis from '@/components/live-analysis';
export const dynamic='force-dynamic';
export default async function AnalyzePage(){
  let email:string;
  try{email=await requireAuth();}catch{redirect('/login');}
  let enabled=false;
  try{liveLimits();enabled=process.env.DEPLOY_TARGET==='cloudflare';}catch{}
  return <LiveAnalysis enabled={enabled} internal={internalEmail(email)}/>;
}
