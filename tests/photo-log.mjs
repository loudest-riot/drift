// Run with Node 24+: node tests/photo-log.mjs
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';

const worker=(await import('data:text/javascript;base64,'+
  Buffer.from(readFileSync(new URL('../src/index.js',import.meta.url))).toString('base64'))).default;
const db=new DatabaseSync(':memory:');
const objects=new Map();
const env={
  DB:{
    prepare(sql){
      return {sql,args:[],bind(...args){this.args=args;return this;},
        async run(){return db.prepare(sql).run(...this.args);},
        async all(){return {results:db.prepare(sql).all(...this.args)};},
        async first(){return db.prepare(sql).get(...this.args);}
      };
    },
    async batch(items){for(const statement of items)db.exec(statement.sql);}
  },
  PHOTOS:{
    async put(key,bytes,opts){objects.set(key,{bytes,opts});},
    async get(key){
      const obj=objects.get(key);
      if(!obj)return null;
      return {body:new Blob([obj.bytes]).stream(),httpEtag:'"test"',
        writeHttpMetadata(headers){headers.set('content-type',obj.opts.httpMetadata.contentType);}};
    },
    async delete(key){objects.delete(key);}
  },
  ASSETS:{fetch(){return new Response('not needed');}}
};

const api=(path,opts={})=>worker.fetch(new Request('https://drift.test'+path,opts),env);
const coords={signal_id:'hpr-001',lat:42.36733,lng:-83.42335};
const create=async (isPublic,note)=>{
  const res=await api('/api/intercepts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...coords,public:isPublic,note})});
  assert.equal(res.status,201);
  return res.json();
};
const jpg=new Uint8Array([255,216,255,224,0,12,74,70,73,70,0,1,255,217]);
const upload=(id,token,contentType='image/jpeg',bytes=jpg)=>api('/api/intercepts/'+id+'/photo',{
  method:'POST',headers:{'content-type':contentType,'x-drift-photo-token':token},body:bytes
});

const first=await create(true,'From the lake');
assert.ok(first.photo_upload_token);
assert.equal((await upload(first.id,'incorrect')).status,403);
assert.equal((await upload(first.id,first.photo_upload_token,'image/svg+xml')).status,415);
assert.equal((await upload(first.id,first.photo_upload_token)).status,201);
assert.equal((await upload(first.id,first.photo_upload_token)).status,403);
const publicImage=await api('/api/intercepts/'+first.id+'/photo');
assert.equal(publicImage.status,200);
assert.equal(publicImage.headers.get('content-type'),'image/jpeg');
assert.deepEqual(new Uint8Array(await publicImage.arrayBuffer()),jpg);

const privateFind=await create(false,'My own field note');
assert.equal((await upload(privateFind.id,privateFind.photo_upload_token)).status,201);
assert.equal((await api('/api/intercepts/'+privateFind.id+'/photo')).status,404);
const textOnly=await create(true,'No picture');
const second=await create(true,'Another photograph');
assert.equal((await upload(second.id,second.photo_upload_token)).status,201);
const one=await api('/api/intercepts?photos_only=1&limit=1');
const page1=await one.json();
assert.equal(page1.intercepts.length,1);
assert.equal(page1.has_more,true);
assert.equal(page1.intercepts[0].id,second.id);
const page2=await (await api('/api/intercepts?photos_only=1&limit=1&offset=1')).json();
assert.equal(page2.intercepts.length,1);
assert.equal(page2.intercepts[0].id,first.id);
assert.equal(page2.has_more,false);
const all=await (await api('/api/intercepts?limit=50')).json();
assert.equal(all.intercepts.length,3);
assert.ok(all.intercepts.some(p=>p.id===textOnly.id));
assert.ok(!all.intercepts.some(p=>p.id===privateFind.id));
assert.ok(!JSON.stringify(all).includes(first.photo_upload_token));
assert.ok(!JSON.stringify(all).includes(privateFind.photo_upload_token));
assert.equal((await upload(first.id,second.photo_upload_token)).status,403);
console.log('PASS photo-only pagination, privacy, public retrieval, one-time photo authorization and MIME checks');
