import { expect, it } from 'vitest';
import { parseValidationReport } from '../src/domain/validation-report';
const fixture = () => ({status:'completed',startedAt:'2026-11-25T16:04:57.994Z',runs:[
 {key:'post',actor:'apify/instagram-scraper',status:'verified',cleanup:'deleted',costUsd:0,runId:'private-id',summary:{postRecords:1,displayedLikes:6124,displayedComments:93}},
 {key:'comments',actor:'apify/instagram-comment-scraper',status:'verified',cleanup:'deleted',costUsd:0,summary:{commentRecords:15,uniqueCommenters:15,body:'private text'}}
]});
const url='https://www.instagram.com/p/test-post/?tracking=removed';
it('imports measured counts without inventing attributes or retaining raw fields',()=>{
 const report=parseValidationReport(fixture(),url);
 expect(report.commentAcquisition).toBeCloseTo(15/93);
 expect(report.costUsd).toBe(0);
 expect(report.url).toBe('https://www.instagram.com/p/test-post/');
 expect(report.attributionStatus).toBe('not_analyzed');
 expect(JSON.stringify(report)).not.toContain('private');
});
it('rejects incomplete records and repeated run types',()=>{
 const f=fixture(); f.runs[1]=f.runs[0];
 expect(()=>parseValidationReport(f,url)).toThrow();
 expect(()=>parseValidationReport({...fixture(),status:'failed'},url)).toThrow();
});
it('requires successful deletion and consistent unique counts',()=>{
 const f=fixture(); f.runs[1].cleanup='failed';
 expect(()=>parseValidationReport(f,url)).toThrow();
 const g=fixture(); g.runs[1].summary.uniqueCommenters=16;
 expect(()=>parseValidationReport(g,url)).toThrow();
});
it('rejects unrelated links and preserves an unknown ratio for zero displayed comments',()=>{
 expect(()=>parseValidationReport(fixture(),'https://example.com/p/test/')).toThrow();
 const f=fixture(); f.runs[0].summary.displayedComments=0;
 expect(parseValidationReport(f,url).commentAcquisition).toBeNull();
});
it('retains only bounded comments and builds safe profile links',()=>{
 const f={...fixture(),comments:Array.from({length:15},()=>({username:'example_user',text:'公開コメント',secret:'discard'}))};
 const report=parseValidationReport(f,url);
 expect(report.comments?.[0].profileUrl).toBe('https://www.instagram.com/example_user/');
 expect(JSON.stringify(report)).not.toContain('discard');
 expect(()=>parseValidationReport({...f,comments:[{username:'javascript:alert(1)',text:'x'}]},url)).toThrow();
 expect(()=>parseValidationReport({...f,comments:[]},url)).toThrow();
});
it('imports only aggregate input coverage, never the full profile checkpoint',()=>{
 const f={...fixture(),comments:Array.from({length:15},()=>({username:'sample',text:'comment'})),audience:{version:1,source:'public-profile-text',analyzedAt:'2026-11-27T00:00:00Z',people:[{username:'sample',status:'insufficient',gender:{value:'不明',confidence:0,reason:'不足',evidence:[]},age:{value:'不明',confidence:0,reason:'不足',evidence:[]},description:'不足',interests:[]}]},profileInputs:[{username:'sample',private:false,biography:'PRIVATE_UNNEEDED_BIO',latestPosts:[]}]};
 const report=parseValidationReport(f,url);
 expect(report.coverage?.public).toBe(1);expect(report.coverage?.publicNoPostText).toBe(1);
 expect(JSON.stringify(report)).not.toContain('PRIVATE_UNNEEDED_BIO');
 expect(report.attributionStatus).toBe('analyzed');
});
