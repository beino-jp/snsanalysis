import { expect, it } from 'vitest';
import { zodResponseFormat } from 'openai/helpers/zod';
import { audiencePerson } from '../src/domain/audience';
it('generates strict structured output with the installed OpenAI and Zod versions', () => {
  const format = zodResponseFormat(audiencePerson, 'audience_person');
  expect(format.type).toBe('json_schema');
  expect(format.json_schema.strict).toBe(true);
  expect(format.json_schema.schema?.additionalProperties).toBe(false);
  expect(format.json_schema.schema?.required).toContain('interests');
});
