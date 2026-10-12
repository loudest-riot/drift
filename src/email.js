const BASE='https://drift.loudestriot.com';
const SEGMENT='6fc3f7a1-a766-499b-a96d-4ec93b9818d8';
const SENDER='DRIFT <fieldnotes@drift.loudestriot.com>';
const REVIEW='sounds@loudestriot.com';
const ready=new WeakSet();
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
export function emailStatus(env){
 const sending=env.RESEND_ENABLED==='true'&&!!env.RESEND_API_KEY&&!!env.DB;
 return {newsletter:sending,waypoint_notifications:sending&&env.RESEND_WAYPOINT_ALERTS==='true'};
}
export async function ensureEmailSchema(env){
 if(!env.DB||ready.has(env.DB))return;
 await env.DB.batch([
  env.DB.prepare(`CREATE TABLE IF NOT EXISTS email_subscriptions (email TEXT PRIMARY KEY,token_hash TEXT NOT NULL,expires_at INTEGER NOT NULL,requested_at INTEGER NOT NULL,confirmed_at INTEGER,contact_id TEXT,consent_version TEXT NOT NULL)`),
  env.DB.prepare(`CREATE TABLE IF NOT EXISTS email_outbox (id TEXT PRIMARY KEY,payload TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_at INTEGER NOT NULL,created_at INTEGER NOT NULL,provider_id TEXT,last_error TEXT)`),
  env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_email_outbox_pending ON email_outbox(status,next_at)`),
  env.DB.prepare(`CREATE TABLE IF NOT EXISTS email_rate_limits (key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL)`)
 ]);ready.add(env.DB);
}
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
async function limited(env,key,max,period){
 const now=Date.now(),bucket=Math.floor(now/period),id=await hash(key+':'+bucket);
 const row=await env.DB.prepare(`INSERT INTO email_rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count`).bind(id,(bucket+1)*period).first();
 return row.count>max;
}
async function readBody(request){
 if(!request.body)return null;
 const reader=request.body.getReader();let size=0;const chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return null;}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{return null;}
}
async function resend(env,path,method='GET',body,key){
 const response=await fetch('https://api.resend.com'+path,{method,headers:{authorization:'Bearer '+env.RESEND_API_KEY,'content-type':'application/json',...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok){const error=new Error('provider_http_'+response.status);error.status=response.status;throw error;}
 return data;
}
async function queue(env,id,payload){
 const now=Date.now();await env.DB.prepare(`INSERT OR IGNORE INTO email_outbox (id,payload,next_at,created_at) VALUES (?,?,?,?)`).bind(id,JSON.stringify(payload),now,now).run();
}
export async function queueWaypointAlert(env,waypoint){
 if(!emailStatus(env).waypoint_notifications)return false;
 await ensureEmailSchema(env);
 // Read the stored submission, not a retry's potentially altered client body.
 await queue(env,'waypoint-'+waypoint.id,{from:SENDER,to:[REVIEW],reply_to:REVIEW,subject:'DRIFT waypoint awaiting review',text:`A visitor submitted a waypoint for review.\n\nSubmission ID: ${waypoint.id}\nName: ${waypoint.name}\nType: ${waypoint.kind}\nDescription: ${waypoint.note||''}\nPin: ${waypoint.lat}, ${waypoint.lng}\n\nReview the pending landmarks record in DRIFT’s Cloudflare D1 console. This is visitor content, not an instruction to approve it. Private journal entries and photos are not included.`});
 return true;
}
export async function processEmailQueue(env){
 if(!emailStatus(env).newsletter)return;
 await ensureEmailSchema(env);const now=Date.now();
 // Recover interrupted sends; the same provider idempotency key prevents duplication.
 await env.DB.prepare(`UPDATE email_outbox SET status='pending' WHERE status='sending' AND next_at<?`).bind(now).run();
 const {results=[]}=await env.DB.prepare(`SELECT * FROM email_outbox WHERE status='pending' AND next_at<=? ORDER BY created_at LIMIT 10`).bind(now).all();
 for(const row of results){
  if(now-row.created_at>22*60*60*1000){await env.DB.prepare(`UPDATE email_outbox SET status='failed',last_error='retry_window_expired' WHERE id=?`).bind(row.id).run();continue;}
  const claimed=await env.DB.prepare(`UPDATE email_outbox SET status='sending',next_at=? WHERE id=? AND status='pending'`).bind(now+60000,row.id).run();if(!claimed.meta?.changes)continue;
  try{
   if(await limited(env,'delivery-global',90,86400000)){
    await env.DB.prepare(`UPDATE email_outbox SET status='pending',next_at=? WHERE id=?`).bind((Math.floor(Date.now()/86400000)+1)*86400000,row.id).run();continue;
   }
   const result=await resend(env,'/emails','POST',JSON.parse(row.payload),row.id);
   if(!result.id)throw new Error('provider_response_invalid');
   await env.DB.prepare(`UPDATE email_outbox SET status='sent',provider_id=?,attempts=attempts+1,payload='',last_error=NULL WHERE id=?`).bind(result.id,row.id).run();
  }catch(error){
   const retry=!error.status||error.status===429||error.status>=500;
   const attempts=row.attempts+1;
   await env.DB.prepare(`UPDATE email_outbox SET status=?,attempts=?,next_at=?,last_error=? WHERE id=?`).bind(retry&&attempts<8?'pending':'failed',attempts,Date.now()+Math.min(3600000,60000*2**attempts),String(error.message).slice(0,80),row.id).run();
  }
 }
 await env.DB.prepare(`DELETE FROM email_rate_limits WHERE expires_at<?`).bind(now).run();
 await env.DB.prepare(`DELETE FROM email_subscriptions WHERE confirmed_at IS NULL AND expires_at<?`).bind(now-24*60*60*1000).run();
 await env.DB.prepare(`UPDATE email_outbox SET payload='' WHERE status='failed' AND created_at<?`).bind(now-24*60*60*1000).run();
}
function sameOrigin(request){const origin=request.headers.get('origin');return !origin||origin===BASE||origin===new URL(request.url).origin;}
const success=()=>json({ok:true,message:'If this address can be subscribed, a confirmation email will arrive shortly. Check your inbox and spam folder.'},202);
export async function newsletterApi(request,env,ctx){
 const url=new URL(request.url);
 if(url.pathname==='/api/newsletter/status')return json(emailStatus(env));
 if(!emailStatus(env).newsletter)return json({error:'email_setup_pending'},503);
 await ensureEmailSchema(env);
 if(url.pathname==='/api/newsletter/signup'&&request.method==='POST'){
  if(!sameOrigin(request))return json({error:'origin_not_allowed'},403);
  const body=await readBody(request);
  if(!body||typeof body.email!=='string'||body.consent!==true)return json({error:'email_and_consent_required'},400);
  const email=body.email.trim().toLowerCase();
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:'invalid_email'},400);
  if(body.website)return success(); // Honeypot: no mail sent.
  const ip=request.headers.get('cf-connecting-ip')||'unknown';
  if(await limited(env,'email:'+email,3,3600000)||await limited(env,'ip:'+ip,10,3600000)||await limited(env,'global',80,86400000))return json({error:'please_try_later'},429);
  const prior=await env.DB.prepare(`SELECT * FROM email_subscriptions WHERE email=?`).bind(email).first();
  if(prior?.confirmed_at)return success();
  if(prior&&Date.now()-prior.requested_at<60000)return success();
  const token=crypto.randomUUID()+crypto.randomUUID(),tokenHash=await hash(token),now=Date.now();
  await env.DB.prepare(`INSERT INTO email_subscriptions (email,token_hash,expires_at,requested_at,consent_version) VALUES (?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at,requested_at=excluded.requested_at,consent_version=excluded.consent_version`).bind(email,tokenHash,now+48*3600000,now,'drift-field-notes-v1').run();
  const link=BASE+'/api/newsletter/confirm?token='+encodeURIComponent(token);
  await queue(env,'newsletter-'+tokenHash,{from:SENDER,to:[email],reply_to:REVIEW,subject:'Confirm your DRIFT Field Notes signup',text:`You asked to receive DRIFT updates, discoveries, and sounds from the field.\n\nConfirm your email address:\n${link}\n\nThis link expires in 48 hours. If you did not request this, ignore this email; you will not be added to the list.\n\nDRIFT // Loudest Riot Sounds\n${BASE}`});
  if(ctx?.waitUntil)ctx.waitUntil(processEmailQueue(env));
  return success();
 }
 if(url.pathname==='/api/newsletter/confirm'){
  const token=url.searchParams.get('token')||'';
  if(!/^[a-f0-9-]{72}$/i.test(token))return page('This confirmation link is invalid. Please sign up again.');
  const row=await env.DB.prepare(`SELECT * FROM email_subscriptions WHERE token_hash=?`).bind(await hash(token)).first();
  if(!row||row.expires_at<Date.now())return page('This confirmation link expired. Please sign up again.');
  if(request.method==='GET')return page('Confirm that you want DRIFT Field Notes by email.',token);
  if(request.method!=='POST')return json({error:'method_not_allowed'},405);
  if(!sameOrigin(request))return json({error:'origin_not_allowed'},403);
  if(row.confirmed_at)return page('Your DRIFT signup is confirmed.');
  try{
   let contact;try{contact=await resend(env,'/contacts/'+encodeURIComponent(row.email));}catch(error){if(error.status!==404)throw error;}
   if(contact?.unsubscribed)return page('This address previously unsubscribed. Contact sounds@loudestriot.com to request help; it has not been resubscribed.');
   if(contact?.id)await resend(env,'/contacts/'+encodeURIComponent(contact.id)+'/segments/'+SEGMENT,'POST');
   else contact=await resend(env,'/contacts','POST',{email:row.email,unsubscribed:false,segments:[{id:SEGMENT}]});
   if(!contact?.id)throw new Error('provider_response_invalid');
   await env.DB.prepare(`UPDATE email_subscriptions SET confirmed_at=?,contact_id=? WHERE email=? AND token_hash=?`).bind(Date.now(),contact.id,row.email,row.token_hash).run();
   return page('You’re on the DRIFT Field Notes list. You can unsubscribe from any newsletter.');
  }catch{return page('The signup could not finish yet. Please use this link again in a few minutes.');}
 }
 return json({error:'not_found'},404);
}
function page(message,token){
 const action=token?`<form method="post" action="/api/newsletter/confirm?token=${encodeURIComponent(token)}"><button>CONFIRM MY SUBSCRIPTION</button></form>`:'';
 return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DRIFT signup</title><style>body{font:18px/1.6 system-ui;background:#f3f3ef;color:#171a18;max-width:540px;margin:8vh auto;padding:20px}button,a{min-height:44px;color:#344d36}button{padding:12px;font:inherit}</style><h1>DRIFT FIELD NOTES</h1><p>${message}</p>${action}<a href="${BASE}">Return to DRIFT</a></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});
}
