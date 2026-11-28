import { audienceCounts, type AudiencePerson } from '../../domain/audience';
export function liveView(row:Record<string,any>){
  const r=row.report;
  const people:AudiencePerson[]=r?.audience?.people??[];
  const interests=new Map<string,number>();
  for(const p of people)for(const value of new Set(p.interests.map(i=>i.value)))interests.set(value,(interests.get(value)??0)+1);
  // Client responses intentionally contain aggregates only, never profile/quote checkpoints.
  return {id:row.id,url:row.url,status:row.status,ceilingYen:row.ceiling_yen,actualYen:row.actual_yen,costUsd:row.cost_usd,error:row.error,createdAt:row.created_at,report:r?{
    displayedLikes:r.displayedLikes,displayedComments:r.displayedComments,commentRecords:r.commentRecords,uniqueCommenters:r.uniqueCommenters,
    analyzedPeople:people.length,gender:audienceCounts(people,'gender'),age:audienceCounts(people,'age'),
    interestPeople:people.filter(p=>p.interests.length>0).length,interests:[...interests].map(([label,count])=>({label,count})),
    privatePeople:people.filter(p=>p.status==='private').length,insufficientPeople:people.filter(p=>p.status==='insufficient').length,
  }:null};
}
export type LiveView=ReturnType<typeof liveView>;
