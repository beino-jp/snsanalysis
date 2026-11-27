import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
it('prints only aggregate counts, never changes local input and ignores incomplete runs',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'reach-audit-'));
 try{
  await mkdir(join(folder,'.p0-results'));
  const file=join(folder,'.p0-results/audience-synthetic.json');
  const body=JSON.stringify({status:'completed',audience:{analyzedAt:'2026-11-26T00:00:00Z',people:[{username:'private-name',gender:{value:'不明'},age:{value:'不明'},interests:[]}]},profileInputs:[{username:'private-name',biography:'PRIVATE-BIO',latestPosts:[]}]});
  await writeFile(file,body);
  await writeFile(join(folder,'.p0-results/audience-incomplete.json'),JSON.stringify({status:'analyzing',audience:{analyzedAt:'2026-11-27T00:00:00Z'}}));
  const output=execFileSync(process.execPath,[resolve('scripts/audit-audience.mjs')],{cwd:folder,encoding:'utf8'});
  expect(output).toContain('処理完了：1人');expect(output).toContain('外部通信なし');
  expect(output).not.toContain('private-name');expect(output).not.toContain('PRIVATE-BIO');
  expect(await readFile(file,'utf8')).toBe(body);
 }finally{await rm(folder,{recursive:true,force:true});}
});
