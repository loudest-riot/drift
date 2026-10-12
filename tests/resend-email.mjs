import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import worker from '../src/index.js';
import {processEmailQueue} from '../src/email.js';
const db=new DatabaseSync(':memory:');
const env={RESEND_API_KEY:'test-only',RESEND_ENABLED:'true',RESEND_WAYPOINT_ALERTS:'true',DB:{
 prepare(sql){return {sql,args:[],bind(...args){this.args=args;return this;},async run(){const result=db.prepare(sql).run(...this.args);return {meta:{changes:result.changes}};},async all(){return {results:db.prepare(sql).all(...this.args)};},async first(){return db.prepare(sql).get(...this.args);}};},
 async batch(items){for(const item of items)db.exec(item.sql);}
}};
const jobs=[];const ctx={waitUntil:promise=>jobs.push(promise)};
const requests=[];const contacts=new Map();let failSend=false;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 const path=new URL(url).pathname;const body=options.body?JSON.parse(options.body):null;requests.push({path,options,body});
 if(path==='/emails'){if(failSend)return Response.json({error:'temporary'},{status:503});return Response.json({id:'sent-'+requests.length});}
 if(path==='/contacts'&&options.method==='POST'){const contact={id:crypto.randomUUID(),...body};contacts.set(body.email,contact);return Response.json(contact);}
 if(path.includes('/segments/'))return Response.json({id:'segment'});
 if(path.startsWith('/contacts/')){const contact=contacts.get(decodeURIComponent(path.slice('/contacts/'.length)));return contact?Response.json(contact):Response.json({}, {status:404});}
 throw Error('unexpected provider request');
};
const api=(path,options={})=>worker.fetch(new Request('https://drift.test'+path,options),env,ctx);
const signup=(email,extra={})=>api('/api/newsletter/signup',{method:'POST',headers:{'content-type':'application/json',origin:'https://drift.test'},body:JSON.stringify({email,consent:true,...extra})});
const flush=async()=>{while(jobs.length)await Promise.all(jobs.splice(0));};
try{
 const disabled=await worker.fetch(new Request('https://drift.test/api/newsletter/status'),{});assert.deepEqual(await disabled.json(),{newsletter:false,waypoint_notifications:false});
 for(const email of ['invalid','a@b@c.com','a b@c.com'])assert.equal((await signup(email)).status,400);
 assert.equal((await signup('hello@example.com',{consent:false})).status,400);
 assert.equal((await signup('bot@example.com',{website:'filled'})).status,202);assert.equal(requests.length,0);
 assert.equal((await api('/api/newsletter/signup',{method:'POST',headers:{origin:'https://other.test'},body:'{}'})).status,403);
 assert.equal((await signup('first@example.com')).status,202);await flush();
 assert.equal(contacts.size,0,'unconfirmed signup must not create a contact');
 const email=requests.find(r=>r.path==='/emails');assert.ok(email.options.headers['Idempotency-Key']);
 const token=new URL(email.body.text.match(/https:\/\/drift[^\s]+/)[0]).searchParams.get('token');
 const get=await api('/api/newsletter/confirm?token='+token);assert.match(await get.text(),/method="post"/);assert.equal(get.headers.get('referrer-policy'),'no-referrer');assert.equal(contacts.size,0,'scanner GET must not confirm');
 const post=await api('/api/newsletter/confirm?token='+token,{method:'POST'});assert.match(await post.text(),/on the DRIFT/);assert.equal(contacts.size,1);
 assert.equal(contacts.get('first@example.com').segments[0].id,'6fc3f7a1-a766-499b-a96d-4ec93b9818d8');
 const before=requests.length;await api('/api/newsletter/confirm?token='+token,{method:'POST'});assert.equal(requests.length,before);
 assert.equal(db.prepare('SELECT confirmed_at FROM email_subscriptions WHERE email=?').get('first@example.com').confirmed_at>0,true);
 assert.equal((await signup('first@example.com')).status,202);await flush();assert.equal(requests.length,before);
 contacts.set('unsubscribed@example.com',{id:'old',unsubscribed:true});await signup('unsubscribed@example.com');await flush();
 const second=requests.filter(r=>r.path==='/emails').at(-1);const token2=new URL(second.body.text.match(/https:\/\/drift[^\s]+/)[0]).searchParams.get('token');
 assert.match(await (await api('/api/newsletter/confirm?token='+token2,{method:'POST'})).text(),/not been resubscribed/);assert.equal(contacts.get('unsubscribed@example.com').unsubscribed,true);
 const wp={id:crypto.randomUUID(),name:'Lake rock',kind:'ROCK',note:'A submitted observation',lat:42.37,lng:-83.4,entries:[{note:'PRIVATE SHOULD NEVER SEND'}]};
 const submit=body=>api('/api/waypoints',{method:'POST',body:JSON.stringify(body)});
 assert.equal((await (await submit(wp)).json()).notification_queued,true);await flush();
 const alert=requests.filter(r=>r.path==='/emails').at(-1);assert.deepEqual(alert.body.to,['sounds@loudestriot.com']);assert.match(alert.body.text,/Lake rock/);assert.ok(!alert.body.text.includes('PRIVATE SHOULD NEVER SEND'));
 await submit({...wp,name:'Retry with altered name'});await flush();assert.equal(requests.filter(r=>r.path==='/emails'&&r.options.headers['Idempotency-Key']==='waypoint-'+wp.id).length,1);
 const retry={...wp,id:crypto.randomUUID()};failSend=true;await submit(retry);await flush();
 assert.equal(db.prepare('SELECT status FROM email_outbox WHERE id=?').get('waypoint-'+retry.id).status,'pending');
 const retryKey=requests.filter(r=>r.path==='/emails').at(-1).options.headers['Idempotency-Key'];failSend=false;
 db.prepare("UPDATE email_outbox SET next_at=0 WHERE id=?").run(retryKey);await processEmailQueue(env);
 assert.equal(requests.filter(r=>r.path==='/emails').at(-1).options.headers['Idempotency-Key'],retryKey);
 assert.equal(db.prepare('SELECT status,payload FROM email_outbox WHERE id=?').get(retryKey).status,'sent');assert.equal(db.prepare('SELECT payload FROM email_outbox WHERE id=?').get(retryKey).payload,'');
 // The quiet resend cooldown is followed by a strict hourly limit.
 for(let i=0;i<3;i++)await signup('rate@example.com');assert.equal((await signup('rate@example.com')).status,429);await flush();
 assert.match(await (await api('/api/newsletter/confirm?token=bad')).text(),/invalid/);
 console.log('PASS inactive configuration, consent/validation, honeypot/origin checks, scanner-safe double opt-in, segment membership, unsubscribe preservation, private-content exclusion, idempotent alerts, retry and payload cleanup, signup rate limits');
}finally{globalThis.fetch=originalFetch;db.close();}
