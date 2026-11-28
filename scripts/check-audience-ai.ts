import 'dotenv/config';
import OpenAI from 'openai';
import {zodResponseFormat} from 'openai/helpers/zod';
import {audiencePerson} from '../src/domain/audience';
import {safeAudienceError} from './lib/audience-errors';
// Synthetic text only. No Instagram data is sent and no Apify Actor is started.
try{
 const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0,timeout:30000});
 const r=await client.chat.completions.create({model:'gpt-4.1-mini',store:false,max_completion_tokens:400,response_format:zodResponseFormat(audiencePerson,'audience_person'),messages:[{role:'user',content:'Return a synthetic example for username example_user. All attributes unknown (不明), confidence 0, no evidence and no interests. status insufficient. description test.'}]});
 console.log('AI通信：成功');console.log('終了理由：'+r.choices[0]?.finish_reason);
 const parsed=audiencePerson.safeParse(JSON.parse(r.choices[0]?.message.content??'{}'));
 console.log('出力形式：'+(parsed.success?'成功':'不一致'));
 console.log('使用トークン：'+r.usage?.total_tokens);
}catch(e){console.log('AI診断：'+JSON.stringify(safeAudienceError(e)));}
