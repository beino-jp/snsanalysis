import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {defaults} from '../src/domain/types';
// Offline artifact only. Does not connect, apply changes, or include any credentials.
const literal=(value:string)=>"'"+value.replace(/'/g,"''")+"'";
const schema=await readFile(new URL('../db/schema.sql',import.meta.url),'utf8');
const access=await readFile(new URL('../db/harden-access.sql',import.meta.url),'utf8');
const seed=[`INSERT INTO settings(id,payload) VALUES('default',${literal(JSON.stringify(defaults))}::jsonb) ON CONFLICT DO NOTHING;`,...defaults.categories.map(c=>`INSERT INTO categories(name,guidance) VALUES(${literal(c.name)},${literal(c.guidance)}) ON CONFLICT DO NOTHING;`)].join('\n');
const sql=`-- Reach Insight: run only in the dedicated snsanalysis project as postgres.\n-- Creates app tables, restricts direct Data API access, and seeds default settings.\n-- Existing data and settings are preserved; Supabase Auth is unchanged.\nBEGIN;\nSET LOCAL search_path=public;\n${schema}\n${access}\n${seed}\nCOMMIT;\nSELECT '初期設定が完了しました' AS result;\n`;
await mkdir('attachments',{recursive:true});
await writeFile('attachments/supabase-setup.sql',sql,'utf8');
console.log('Prepared attachments/supabase-setup.sql (offline only)');
