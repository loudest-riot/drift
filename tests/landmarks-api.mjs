// Run with Node 24+: node tests/landmarks-api.mjs
import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';
const worker=(await import('data:text/javascript;base64,'+Buffer.from(readFileSync(new URL('../src/index.js', import.meta.url))).toString('base64'))).default;
const db=new DatabaseSync(':memory:');const env={DB:{prepare(sql){return {args:[],bind(...args){this.args=args;return this;},async run(){return db.prepare(sql).run(...this.args);},async all(){return {results:db.prepare(sql).all(...this.args)};},async first(){return db.prepare(sql).get(...this.args);},sql};},async batch(items){for(const i of items)db.exec(i.sql);}}};
const valid={id:crypto.randomUUID(),name:'Woodland',kind:'PARK',lat:42.37,lng:-83.4,note:'Quiet place',status:'approved',public:true};
const post=body=>worker.fetch(new Request('https://drift.test/api/landmarks',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),env);
let r=await post(valid);assert.equal(r.status,201);assert.equal(db.prepare('SELECT status FROM landmarks').get().status,'pending');await post(valid);assert.equal(db.prepare('SELECT count(*) AS n FROM landmarks').get().n,1);
r=await worker.fetch(new Request('https://drift.test/api/landmarks'),env);assert.deepEqual((await r.json()).landmarks,[]);
for(const b of [null,[],{...valid,lat:null},{...valid,lng:''},{...valid,lat:91},{...valid,name:' '},{...valid,kind:'ADMIN'},{...valid,note:'x'.repeat(501)},{...valid,id:'abc'}])assert.equal((await post(b)).status,400);
assert.equal((await post({...valid,note:'x'.repeat(9000)})).status,413);
db.prepare("UPDATE landmarks SET status='approved'").run();await post({...valid,name:'Unauthorized overwrite'});assert.equal(db.prepare('SELECT name FROM landmarks').get().name,'Woodland');r=await worker.fetch(new Request('https://drift.test/api/landmarks'),env);assert.equal((await r.json()).landmarks.length,1);
db.prepare("UPDATE landmarks SET status='rejected'").run();r=await worker.fetch(new Request('https://drift.test/api/landmarks'),env);assert.equal((await r.json()).landmarks.length,0);
console.log('PASS SQL schema, persistence, pending-only submission, approved-only listing, idempotency, immutable submitted copy, input validation and body limits');
