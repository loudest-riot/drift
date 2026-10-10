// Run with Node 24+: node tests/hines-places.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const data=JSON.parse(read('../public/data/hines-places.json'));
assert.equal(data.schema_version,1);
assert.equal(data.entries.length,36);
const seen=new Set();
for(const p of data.entries){
  assert.ok(p.id&&p.name&&p.kind);
  assert.ok(!seen.has(p.id),'duplicate id '+p.id);
  seen.add(p.id);
  assert.ok(p.source==null||/^https:\/\//.test(p.source));
  if(p.position==='reference'){
    assert.ok(Number.isFinite(p.lat)&&Number.isFinite(p.lng));
    assert.ok(p.lat>=42.30&&p.lat<=42.46);
    assert.ok(p.lng>=-83.53&&p.lng<=-83.22);
  }else{
    assert.equal(p.position,'awaiting_verification');
    assert.equal('lat' in p,false);
    assert.equal('lng' in p,false);
  }
}
const newburgh=data.entries.find(p=>p.id==='newburgh-lake-pointe-access');
assert.ok(newburgh?.featured);
assert.equal(newburgh.position,'awaiting_verification');
assert.equal(newburgh.source,null);
assert.ok(data.entries.some(p=>p.id==='newburgh-pointe'&&p.position==='reference'));
assert.ok(data.entries.some(p=>p.id==='newburgh-boat-launch'&&p.position==='reference'));
assert.match(read('../public/index.html'),/href="places\.html"/);
assert.match(read('../public/sw.js'),/drift-v25/);
assert.match(read('../public/app.js'),/loadHinesCatalog\(\)/);
assert.match(read('../public/app.js'),/SUBMIT FOR REVIEW/);
console.log('PASS Hines catalog completeness, reference pin bounds, provenance, featured access, links and submission UI.');
