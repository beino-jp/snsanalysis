import {expect,it} from 'vitest';
import {safeAudienceError} from '../scripts/lib/audience-errors';
import {zodResponseFormat} from 'openai/helpers/zod';
import {audiencePerson} from '../src/domain/audience';
it('reports only safe status and schema paths without provider messages or values',()=>{
 const result=safeAudienceError({status:403,code:'invalid_api_key',message:'sk-secret private text'});
 expect(result.httpStatus).toBe(403);expect(JSON.stringify(result)).not.toContain('secret');
 const schemaError=safeAudienceError({name:'ZodError',issues:[{path:['interests',0,'confidence'],code:'invalid_type',received:'private'}]});
 expect(schemaError.issues?.[0].path).toBe('interests.0.confidence');
 expect(JSON.stringify(schemaError)).not.toContain('private');
});
it('uses a strict structured schema with explicit fields for AI analysis',()=>{
 const format=zodResponseFormat(audiencePerson,'audience_person');
 expect(format.type).toBe('json_schema');expect(format.json_schema.strict).toBe(true);
 expect(format.json_schema.schema.required).toContain('gender');
});
