import {vi,it,expect} from 'vitest';
const state=vi.hoisted(()=>({clients:[] as {url:string;queries:string[];ended:boolean}[]}));
vi.mock('pg',()=>({Client:class {
 value:{url:string;queries:string[];ended:boolean};
 constructor(o:{connectionString:string}){this.value={url:o.connectionString,queries:[],ended:false};state.clients.push(this.value);}
 on(){return this;} async connect(){} async query(sql:string){this.value.queries.push(sql);return {rows:[{url:this.value.url}]};} async end(){this.value.ended=true;}
},Pool:class {}}));
import {withDatabaseUrl,query,transaction} from '../src/server/db';
it('isolates concurrent workflow connection bindings and closes each query connection',async()=>{
 state.clients=[];
 const [a,b]=await Promise.all([withDatabaseUrl('postgres://first',()=>query('SELECT 1')),withDatabaseUrl('postgres://second',()=>query('SELECT 2'))]);
 expect(a[0].url).toBe('postgres://first');expect(b[0].url).toBe('postgres://second');expect(state.clients.every(c=>c.ended)).toBe(true);
});
it('keeps transactions on one connection and rolls back before releasing on failure',async()=>{
 state.clients=[];
 await withDatabaseUrl('postgres://first',()=>transaction(async q=>{await q('UPDATE test');}));
 expect(state.clients).toHaveLength(1);expect(state.clients[0].queries).toEqual(['BEGIN','UPDATE test','COMMIT']);
 await expect(withDatabaseUrl('postgres://second',()=>transaction(async()=>{throw Error('test');}))).rejects.toThrow('test');
 expect(state.clients[1].queries).toEqual(['BEGIN','ROLLBACK']);expect(state.clients[1].ended).toBe(true);
});
