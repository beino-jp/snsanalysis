import {expect,it} from 'vitest';
import {liveView} from '../src/server/live/view';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import LiveAnalysis from '../src/components/live-analysis';
it('never sends individual identifiers, profile text or evidence in client results',()=>{
  const finding={value:'不明',confidence:0,reason:'private detail',evidence:['private quote']};
  const output=liveView({id:'test',checkpoint:{secret:'checkpoint-secret'},report:{audience:{people:[{username:'real-person',status:'analyzed',gender:finding,age:finding,interests:[{...finding,value:'旅行'}]}]}}});
  const text=JSON.stringify(output);
  for(const secret of ['real-person','private detail','private quote','checkpoint-secret'])expect(text).not.toContain(secret);
  expect(output.report?.gender).toEqual({'不明':1});expect(output.report?.interests).toEqual([{label:'旅行',count:1}]);
});
it('shows preparation state and cost confirmation without enabling paid execution',()=>{
  const html=renderToStaticMarkup(createElement(LiveAnalysis,{enabled:false}));
  expect(html).toContain('実データ分析は準備中');expect(html).toContain('disabled');expect(html).toContain('対象と費用を確認する');
});
