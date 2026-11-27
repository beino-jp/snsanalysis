import {it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import AudienceOverview from '../src/components/audience-overview';
import type {AudiencePerson} from '../src/domain/audience';
const unknown={value:'不明' as const,confidence:0,reason:'根拠不足',evidence:[]};
const base=(username:string):AudiencePerson=>({username,status:'analyzed',gender:unknown,age:unknown,description:'関心あり',interests:[]});
it('keeps unknowns in the denominator and folds details without advertising confidence as accuracy',()=>{
 const people=[{...base('synthetic_a'),interests:[{value:'dog lovers',confidence:1,reason:'記述',evidence:['犬好き']}],gender:{value:'女性' as const,confidence:1,reason:'明示',evidence:['女性です']}},{...base('synthetic_b'),status:'private' as const}];
 const html=renderToStaticMarkup(createElement(AudienceOverview,{audience:{version:1,source:'public-profile-text',analyzedAt:'2026-11-27T00:00:00Z',people},total:2}));
 expect(html).toContain('1/2人（50.0%）');expect(html).toContain('不明 1人');
 expect(html).toContain('犬好き');expect(html).toContain('<details');expect(html).not.toContain('<details open');
 expect(html).not.toContain('確信度');expect(html).not.toContain('100%');expect(html).toContain('情報が不足している理由');
});
it('hides profile links for teens',()=>{
 const person={...base('synthetic_minor'),age:{value:'10代' as const,confidence:1,reason:'自己記述',evidence:['17歳']}};
 const html=renderToStaticMarkup(createElement(AudienceOverview,{audience:{version:1,source:'public-profile-text',analyzedAt:'2026-11-27T00:00:00Z',people:[person]},total:1}));
 expect(html).not.toContain('instagram.com/synthetic_minor');
});
