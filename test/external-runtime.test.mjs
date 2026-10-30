import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chmodSync, mkdtempSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApplication } from '../dist/app.js';
import { readExternalConfig, validateConfig, ExternalRuntime } from '../dist/external-runtime.js';
import { openCatalog } from '../dist/catalog.js';

const token = 'test-secret-that-is-long-enough-to-be-private';
const ids = {
  a: 'sha256:53cfab8899f14848e3979a1afa2e41c12334fb05bccee5c55398d53598c04262',
  b: 'sha256:17498c7bc08280b1bc2077d9ee302bdada8fb401192f2efce61f594ad2b236e8',
  c: 'sha256:7410f8f433f8d7668000a290b573df8873334ca1f4aadc4622c48b76610b199f',
};
const config = { schemaVersion: 1, backendId: 'private-backend', targets: [{ id: 'private-target', name: 'Hello Test', applicationId: 'observatory-hello-reference', stage: 'Test', instanceId: 'private-incarnation', artifacts: [{version:'1.0.0',artifactId:ids.a},{version:'1.1.0',artifactId:ids.b},{version:'1.2.0',artifactId:ids.c}] }] };
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'ao-external-test-')); t.after(() => rmSync(directory, {recursive:true,force:true}));
  const configPath = join(directory,'private-config.json'); writeFileSync(configPath,JSON.stringify(config),{mode:0o600}); chmodSync(configPath,0o600);
  const credentials = readExternalConfig(configPath,token); const app = createApplication(join(directory,'db'),undefined,credentials); t.after(() => app.close());
  return { directory, app };
}
const auth = { authorization: `Bearer ${token}` };
const nowIso = () => new Date().toISOString();
function observation(eventId, artifactId = ids.a, version = '1.0.0', bootId = 'boot-one', extra = {}) {
  return {schemaVersion:1,eventId,backendId:'private-backend',applicationId:'observatory-hello-reference',destinationId:'private-target',instanceId:'private-incarnation',directiveId:null,kind:'observation',source:'bounded HTTP GET /version; runtime self-report',detail:'version response collected',outcome:'observed',observedAt:nowIso(),version,artifactId,bootId,...extra};
}
function receipt(eventId, directiveId, artifactId, outcome='completed', extra={}) {
  const at=nowIso(); return {schemaVersion:1,eventId,backendId:'private-backend',applicationId:'observatory-hello-reference',destinationId:'private-target',instanceId:'private-incarnation',directiveId,kind:'receipt',source:'external client',detail:'operation returned',outcome,artifactId,startedAt:at,finishedAt:at,...extra};
}
async function postEvent(app,event) { return app.inject({method:'POST',url:'/api/runtime/v1/targets/private-target/events',headers:{...auth,'content-type':'application/json'},payload:event}); }
async function createDirective(app, action, release, csrf, actor='Operator', rationale='Bounded alpha validation') {
  return app.inject({method:'POST',url:'/external/targets/private-target/directives',headers:{origin:'http://localhost:4310',host:'localhost:4310','content-type':'application/x-www-form-urlencoded'},payload:new URLSearchParams({csrf,action,release,actor,rationale}).toString()});
}

test('external configuration is private, bounded, and identities come from operator config', (t) => {
  const directory=mkdtempSync(join(tmpdir(),'ao-external-config-')); t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const file=join(directory,'config.json'); writeFileSync(file,JSON.stringify(config),{mode:0o600}); chmodSync(file,0o600);
  assert.equal(readExternalConfig(file,token).config.targets[0].id,'private-target');
  assert.throws(()=>readExternalConfig(file,undefined),/requires/);
  assert.throws(()=>validateConfig({...config,unexpected:true}),/config/);
  assert.throws(()=>validateConfig({...config,targets:[{...config.targets[0],artifacts:[{version:'1.0.0',artifactId:ids.a,command:'run'}]}]}),/artifact pair/);
  chmodSync(file,0o644); assert.throws(()=>readExternalConfig(file,token),/owner-only|private/);
  chmodSync(file,0o600); const link=join(directory,'linked-config.json'); symlinkSync(file,link); assert.throws(()=>readExternalConfig(link,token),/symbolic link/);
  const oversized=join(directory,'oversized.json'); writeFileSync(oversized,' '.repeat(65_537),{mode:0o600}); chmodSync(oversized,0o600); assert.throws(()=>readExternalConfig(oversized,token),/64 KiB/);
});

test('large external ledgers render bounded previews, retain full chronology and expose safe read-only pages', async (t) => {
  const directory=mkdtempSync(join(tmpdir(),'ao-external-history-')); t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const configPath=join(directory,'private-config.json'); writeFileSync(configPath,JSON.stringify(config),{mode:0o600}); chmodSync(configPath,0o600);
  const credentials=readExternalConfig(configPath,token); const catalog=openCatalog(join(directory,'db'));
  const runtime=new ExternalRuntime(catalog.db,credentials.config,token);
  const insertEvent=catalog.db.prepare(`INSERT INTO external_events (event_id,backend_id,application_id,destination_id,instance_id,directive_id,kind,source,detail,outcome,version,artifact_id,boot_id,observed_at,started_at,finished_at,recorded_at,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const base=Date.now()-200_000;
  for(let i=0;i<1200;i++) {
    const observedAt=new Date(base+i*100).toISOString(); const artifactId=i===0?ids.a:ids.b; const version=i===0?'1.0.0':'1.1.0';
    const event={schemaVersion:1,eventId:`observation-${String(i).padStart(4,'0')}`,backendId:'private-backend',applicationId:'observatory-hello-reference',destinationId:'private-target',instanceId:'private-incarnation',directiveId:null,kind:'observation',source:'bounded HTTP GET /version',detail:`retained observation ${i} ${'x'.repeat(90)}`,outcome:'observed',observedAt,version,artifactId,bootId:`boot-${i}`};
    const recordedAt=observedAt;
    insertEvent.run(event.eventId,event.backendId,event.applicationId,event.destinationId,event.instanceId,null,event.kind,event.source,event.detail,event.outcome,event.version,event.artifactId,event.bootId,event.observedAt,null,null,recordedAt,JSON.stringify(event));
  }
  const insertDirective=catalog.db.prepare('INSERT INTO external_directives (id,backend_id,application_id,destination_id,instance_id,action,version,artifact_id,created_at,expected_boot_id,actor,rationale) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  for(let i=0;i<300;i++) insertDirective.run(`directive-${String(i).padStart(4,'0')}`,'private-backend','observatory-hello-reference','private-target','private-incarnation','deploy','1.1.0',ids.b,new Date(base+i).toISOString(),null,'Operator',`rationale ${i}`);
  // Latest directive has a failed receipt; a newer fresh observation permits a new action.
  const latestDirective='directive-0299'; const receiptAt=new Date(base+110_000).toISOString();
  for(let i=0;i<300;i++) {
    const at=i===299?receiptAt:new Date(base+1_000+i).toISOString();
    const receiptEvent={schemaVersion:1,eventId:i===299?'latest-failed-receipt':`receipt-${String(i).padStart(4,'0')}`,backendId:'private-backend',applicationId:'observatory-hello-reference',destinationId:'private-target',instanceId:'private-incarnation',directiveId:`directive-${String(i).padStart(4,'0')}`,kind:'receipt',source:'external client',detail:'failed operation',outcome:'failed',artifactId:ids.b,startedAt:at,finishedAt:at};
    insertEvent.run(receiptEvent.eventId,receiptEvent.backendId,receiptEvent.applicationId,receiptEvent.destinationId,receiptEvent.instanceId,receiptEvent.directiveId,receiptEvent.kind,receiptEvent.source,receiptEvent.detail,receiptEvent.outcome,null,receiptEvent.artifactId,null,null,receiptEvent.startedAt,receiptEvent.finishedAt,at,JSON.stringify(receiptEvent));
  }
  catalog.close();
  const app=createApplication(join(directory,'db'),undefined,credentials); t.after(()=>app.close());

  const detail=await app.inject('/applications/hello-observatory');
  assert.equal(detail.statusCode,200); assert.ok(detail.body.length<45_000,`detail HTML was ${detail.body.length} bytes`);
  assert.match(detail.body,/Recent directive and event preview/); assert.match(detail.body,/at most 10 recent directives and five events per directive/);
  assert.doesNotMatch(detail.body,/observation-0000/); assert.match(detail.body,/Rollback to retained release/,'rollback eligibility must search the full retained ledger');

  const history=await app.inject('/applications/hello-observatory/history?page=1');
  assert.equal(history.statusCode,200); assert.match(history.body,/Page 1 of/); assert.match(history.body,/records 1–20 of 1500/); assert.ok(history.body.length<30_000);
  const later=await app.inject('/applications/hello-observatory/history?page=75');
  assert.equal(later.statusCode,200); assert.match(later.body,/observation-0000/,'old observations must remain navigable');
  for(const page of ['0','-1','1.5','1e6','999999999','01','9999999999']) {
    const response=await app.inject(`/applications/hello-observatory/history?page=${encodeURIComponent(page)}`);
    assert.ok([400,404].includes(response.statusCode),`${page} should be rejected or outside the ledger`);
  }
  assert.equal((await app.inject('/applications/hello-observatory/history?page=1&page=2')).statusCode,400);
  assert.equal((await app.inject({method:'POST',url:'/applications/hello-observatory/history?page=1'})).statusCode,405);
  const verify=openCatalog(join(directory,'db'));
  assert.equal((verify.db.prepare('SELECT COUNT(*) AS count FROM external_events').get()).count,1500);
  assert.equal((verify.db.prepare('SELECT COUNT(*) AS count FROM external_directives').get()).count,300);
  verify.close();
});

test('bearer auth, strict events, idempotency, correlation and persisted deploy then rollback progression', async (t) => {
  const {app,directory}=fixture(t);
  const unauthorized=await app.inject('/api/runtime/v1/targets/private-target/directive'); assert.equal(unauthorized.statusCode,401);
  assert.equal((await app.inject({url:'/api/runtime/v1/targets/private-target/directive',headers:{...auth,host:'outside.example'}})).statusCode,403);
  const initial=await app.inject({url:'/api/runtime/v1/targets/private-target/directive',headers:auth});
  assert.equal(initial.statusCode,200); assert.deepEqual(initial.json(),{schemaVersion:1,directive:null});
  const csrf=(await app.inject('/applications/hello-observatory')).body.match(/name="csrf" value="([a-f0-9]+)"/)?.[1]; assert.ok(csrf);
  const deployment=await createDirective(app,'deploy',`1.0.0|${ids.a}`,csrf); assert.equal(deployment.statusCode,303);
  const stored=await app.inject({url:'/api/runtime/v1/targets/private-target/directive',headers:auth});
  const d1=stored.json().directive; assert.equal(d1.expectedBootId,null); assert.equal(d1.action,'deploy');
  assert.equal(Object.keys(d1).sort().join(','),'action,applicationId,artifactId,backendId,createdAt,destinationId,expectedBootId,id,instanceId,version'.split(',').sort().join(','));
  let bad=await postEvent(app,observation('bad-extra',ids.a,'1.0.0','boot-one',{ignored:'x'})); assert.equal(bad.statusCode,400);
  bad=await postEvent(app,{...observation('wrong-target'),destinationId:'other'}); assert.equal(bad.statusCode,400);
  bad=await postEvent(app,{...observation('wrong-instance'),instanceId:'other'}); assert.equal(bad.statusCode,400);
  bad=await postEvent(app,{...observation('wrong-backend'),backendId:'other'}); assert.equal(bad.statusCode,400);
  bad=await postEvent(app,{...observation('wrong-pair'),artifactId:ids.b}); assert.equal(bad.statusCode,409);
  bad=await postEvent(app,{...observation('bad-time'),observedAt:new Date(Date.now()+31_000).toISOString()}); assert.equal(bad.statusCode,400);
  bad=await postEvent(app,{...observation('secret-detail'),detail:`token=${token}`}); assert.equal(bad.statusCode,400);
  bad=await postEvent(app,receipt('orphan-receipt','missing-directive',ids.a)); assert.equal(bad.statusCode,409);
  bad=await app.inject({method:'POST',url:'/api/runtime/v1/targets/private-target/events',headers:{authorization:'Bearer wrong','content-type':'application/json'},payload:'not-json'}); assert.equal(bad.statusCode,401);
  let obs=observation('obs-pre'); assert.equal((await postEvent(app,obs)).json().duplicate,false);
  assert.equal((await postEvent(app,obs)).json().duplicate,true);
  assert.equal((await postEvent(app,{...obs,detail:'mutated'})).statusCode,409);
  const dupDir=await createDirective(app,'rollback',`1.0.0|${ids.a}`,csrf); assert.equal(dupDir.statusCode,409);
  let rec=receipt('receipt-one',d1.id,ids.a); assert.equal((await postEvent(app,rec)).statusCode,200);
  let detail=await app.inject('/applications/hello-observatory'); assert.match(detail.body,/1.0.0/); assert.match(detail.body,/completed/); assert.match(detail.body,/fresh observed version readback/i); assert.doesNotMatch(detail.body,/Rollback to retained release/);
  // Receipt alone does not confirm state; a separately submitted, post-directive observation does.
  obs=observation('obs-after',ids.a,'1.0.0','boot-two',{directiveId:d1.id}); assert.equal((await postEvent(app,obs)).statusCode,200);
  const upgrade=await createDirective(app,'deploy',`1.1.0|${ids.b}`,csrf); assert.equal(upgrade.statusCode,303);
  const d2=(await app.inject({url:'/api/runtime/v1/targets/private-target/directive',headers:auth})).json().directive;
  assert.equal(d2.action,'deploy'); assert.equal(d2.expectedBootId,'boot-two');
  assert.equal((await postEvent(app,receipt('receipt-two',d2.id,ids.b))).statusCode,200);
  assert.equal((await postEvent(app,observation('obs-upgrade',ids.b,'1.1.0','boot-three',{directiveId:d2.id}))).statusCode,200);
  detail=await app.inject('/applications/hello-observatory'); assert.match(detail.body,/Rollback to retained release/);
  const rollback=await createDirective(app,'rollback',`1.0.0|${ids.a}`,csrf); assert.equal(rollback.statusCode,303);
  const d3=(await app.inject({url:'/api/runtime/v1/targets/private-target/directive',headers:auth})).json().directive;
  assert.equal(d3.action,'rollback'); assert.equal(d3.version,'1.0.0'); assert.equal(d3.expectedBootId,'boot-three');
  assert.equal((await postEvent(app,receipt('receipt-three',d3.id,ids.a))).statusCode,200);
  assert.equal((await postEvent(app,observation('obs-contradict',ids.b,'1.1.0','boot-four',{directiveId:d3.id}))).statusCode,200);
  detail=await app.inject('/applications/hello-observatory'); assert.match(detail.body,/Contradictory evidence/); assert.match(detail.body,/contradicts the completed directive/i);
  assert.doesNotMatch(detail.body,/class="external-control"/);
  assert.equal((await createDirective(app,'deploy',`1.2.0|${ids.c}`,csrf)).statusCode,409);
  const portfolio=await app.inject('/'); assert.match(portfolio.body,/Hello Test/); assert.match(portfolio.body,/1.1.0/);
  assert.equal((await app.inject({method:'GET',url:'/api/runtime/v1/targets/private-target/directive',headers:auth})).statusCode,200);
  assert.equal((await app.inject({method:'POST',url:'/api/runtime/v1/targets/private-target/directive',headers:auth})).statusCode,405);
  await app.close();
  const reopened=createApplication(join(directory,'db'),undefined,readExternalConfig(join(directory,'private-config.json'),token));
  t.after(()=>reopened.close());
  const persisted=await reopened.inject({url:'/api/runtime/v1/targets/private-target/directive',headers:auth}); assert.equal(persisted.json().directive.id,d3.id);
  const history=await reopened.inject('/applications/hello-observatory'); assert.match(history.body,/obs-contradict/);
});

test('unknown and stale evidence stay distinct; failed receipt needs a later fresh read before a new directive', (t) => {
  const directory=mkdtempSync(join(tmpdir(),'ao-external-clock-')); t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const catalog=openCatalog(join(directory,'db')); t.after(()=>catalog.close());
  let clock=Date.now(); const runtime=new ExternalRuntime(catalog.db,validateConfig(config),token,()=>new Date(clock));
  const d1=runtime.createDirective('private-target',{action:'deploy',version:'1.0.0',artifactId:ids.a,actor:'Operator',rationale:'Initial deployment'});
  const at=()=>new Date(clock).toISOString();
  const sendObservation=(eventId, directiveId, artifactId, version, bootId, observedAt=at())=>runtime.ingest('private-target',{schemaVersion:1,eventId,backendId:'private-backend',applicationId:'observatory-hello-reference',destinationId:'private-target',instanceId:'private-incarnation',directiveId,kind:'observation',source:'bounded HTTP GET /version',detail:'runtime self-report',outcome:'observed',observedAt,version,artifactId,bootId});
  const sendReceipt=(eventId,directiveId,outcome)=>runtime.ingest('private-target',{schemaVersion:1,eventId,backendId:'private-backend',applicationId:'observatory-hello-reference',destinationId:'private-target',instanceId:'private-incarnation',directiveId,kind:'receipt',source:'external client',detail:'operation returned',outcome,artifactId:ids.a,startedAt:at(),finishedAt:at()});
  assert.equal(sendObservation('before-failure',d1.id,ids.a,'1.0.0','boot-a').duplicate,false);
  sendReceipt('failed-receipt',d1.id,'failed');
  assert.throws(()=>runtime.createDirective('private-target',{action:'deploy',version:'1.1.0',artifactId:ids.b,actor:'Operator',rationale:'retry after failure'}),/after the failed receipt/);
  clock+=1000; sendObservation('after-failure',d1.id,ids.a,'1.0.0','boot-b');
  assert.equal(runtime.state().fresh,true);
  const d2=runtime.createDirective('private-target',{action:'deploy',version:'1.1.0',artifactId:ids.b,actor:'Operator',rationale:'new deliberate change'});
  assert.equal(d2.expectedBootId,'boot-b');
  clock+=301_000; assert.equal(runtime.state().fresh,false);
  assert.equal(runtime.state().lastObservation.version,'1.0.0');
  assert.throws(()=>runtime.createDirective('private-target',{action:'deploy',version:'1.2.0',artifactId:ids.c,actor:'Operator',rationale:'stale read'}),/unresolved directive/);
  // An observation collected earlier and delivered later cannot make the current state fresh.
  clock+=1; sendObservation('old-late-event',d2.id,ids.a,'1.0.0','boot-old',new Date(clock-600_000).toISOString());
  assert.equal(runtime.state().fresh,false);
  const unknownAt=at(); runtime.ingest('private-target',{schemaVersion:1,eventId:'unknown-now',backendId:'private-backend',applicationId:'observatory-hello-reference',destinationId:'private-target',instanceId:'private-incarnation',directiveId:null,kind:'observation',source:'bounded HTTP GET /version',detail:'target unavailable',outcome:'unknown',observedAt:unknownAt,version:null,artifactId:null,bootId:null});
  assert.equal(runtime.state().observation.outcome,'unknown'); assert.equal(runtime.state().fresh,false);
  assert.throws(()=>runtime.reconcile('private-target',{directiveId:d2.id,actor:'Operator',rationale:'stale or unknown evidence'}),/fresh observed version readback/);
});

test('observation chronology, directive-correlated receipts, post-receipt confirmation and boot changes', (t) => {
  const directory=mkdtempSync(join(tmpdir(),'ao-external-order-')); t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const catalog=openCatalog(join(directory,'db')); t.after(()=>catalog.close());
  let clock=Date.now(); const runtime=new ExternalRuntime(catalog.db,validateConfig(config),token,()=>new Date(clock)); const at=()=>new Date(clock).toISOString();
  const observe=(eventId,directiveId,version,artifactId,bootId,time=at())=>runtime.ingest('private-target',{schemaVersion:1,eventId,backendId:'private-backend',applicationId:'observatory-hello-reference',destinationId:'private-target',instanceId:'private-incarnation',directiveId,kind:'observation',source:'bounded HTTP GET /version',detail:'runtime self-report',outcome:'observed',observedAt:time,version,artifactId,bootId});
  const receipt=(eventId,directiveId,version,artifactId,outcome,finished=at())=>runtime.ingest('private-target',{schemaVersion:1,eventId,backendId:'private-backend',applicationId:'observatory-hello-reference',destinationId:'private-target',instanceId:'private-incarnation',directiveId,kind:'receipt',source:'external client',detail:'operation returned',outcome,artifactId,startedAt:finished,finishedAt:finished});
  const d1=runtime.createDirective('private-target',{action:'deploy',version:'1.0.0',artifactId:ids.a,actor:'Operator',rationale:'first'});
  clock+=2000; const unknownAt=at(); runtime.ingest('private-target',{schemaVersion:1,eventId:'later-unknown',backendId:'private-backend',applicationId:'observatory-hello-reference',destinationId:'private-target',instanceId:'private-incarnation',directiveId:null,kind:'observation',source:'bounded HTTP GET /version',detail:'target unavailable',outcome:'unknown',observedAt:unknownAt,version:null,artifactId:null,bootId:null});
  observe('late-old-observed',d1.id,'1.0.0',ids.a,'boot-old',new Date(clock-1000).toISOString());
  assert.equal(runtime.state().observation.eventId,'later-unknown'); assert.equal(runtime.state().fresh,false);
  assert.equal(receipt('unknown-receipt',d1.id,'1.0.0',ids.a,'unknown').accepted,true);
  assert.throws(()=>receipt('laundered-complete',d1.id,'1.0.0',ids.a,'completed'),/Conflicting receipt/);

  const nextDir=join(directory,'second-db'); const second=openCatalog(nextDir); t.after(()=>second.close());
  let secondClock=Date.now(); const rt=new ExternalRuntime(second.db,validateConfig(config),token,()=>new Date(secondClock)); const now=()=>new Date(secondClock).toISOString();
  const rec=(eventId,directiveId,artifactId,outcome,finish=now())=>rt.ingest('private-target',{schemaVersion:1,eventId,backendId:'private-backend',applicationId:'observatory-hello-reference',destinationId:'private-target',instanceId:'private-incarnation',directiveId,kind:'receipt',source:'external client',detail:'operation returned',outcome,artifactId,startedAt:finish,finishedAt:finish});
  const obs=(eventId,directiveId,version,artifactId,bootId,time=now())=>rt.ingest('private-target',{schemaVersion:1,eventId,backendId:'private-backend',applicationId:'observatory-hello-reference',destinationId:'private-target',instanceId:'private-incarnation',directiveId,kind:'observation',source:'bounded HTTP GET /version',detail:'runtime self-report',outcome:'observed',observedAt:time,version,artifactId,bootId});
  const old=rt.createDirective('private-target',{action:'deploy',version:'1.0.0',artifactId:ids.a,actor:'Operator',rationale:'first'});
  rec('old-failed',old.id,ids.a,'failed'); secondClock+=1000; obs('fresh-after-failed',old.id,'1.0.0',ids.a,'boot-one');
  const current=rt.createDirective('private-target',{action:'deploy',version:'1.1.0',artifactId:ids.b,actor:'Operator',rationale:'upgrade'});
  rec('delayed-old-receipt',old.id,ids.a,'failed'); assert.equal(rt.state().receipt,null);
  secondClock+=1000; obs('read-before-complete',current.id,'1.1.0',ids.b,'boot-one');
  secondClock+=1000; rec('current-complete',current.id,ids.b,'completed');
  assert.equal(rt.state().receipt.directiveId,current.id); assert.equal(rt.state().unresolved,true); assert.equal(rt.state().contradictory,false);
  secondClock+=1000; obs('read-same-boot',current.id,'1.1.0',ids.b,'boot-one');
  assert.equal(rt.state().contradictory,true); assert.equal(rt.state().unresolved,true);
  secondClock+=1000; obs('read-new-boot',current.id,'1.1.0',ids.b,'boot-two');
  assert.equal(rt.state().unresolved,false); assert.equal(rt.state().fresh,true);
});

test('unknown and missing receipts need an explicit witnessed continuation before a new directive', async (t) => {
  for (const receiptMode of ['missing','unknown']) {
    const {app,directory}=fixture(t);
    const csrf=(await app.inject('/applications/hello-observatory')).body.match(/name="csrf" value="([a-f0-9]+)"/)?.[1]; assert.ok(csrf);
    const created=await createDirective(app,'deploy',`1.0.0|${ids.a}`,csrf); assert.equal(created.statusCode,303);
    const d1=(await app.inject({url:'/api/runtime/v1/targets/private-target/directive',headers:auth})).json().directive;
    if (receiptMode === 'unknown') assert.equal((await postEvent(app,receipt('unknown-before-reconcile',d1.id,ids.a,'unknown'))).statusCode,200);
    const before=await app.inject('/applications/hello-observatory'); assert.match(before.body,/Execution outcome unknown/); assert.match(before.body,/No receipt received\.|unknown ·/i); assert.doesNotMatch(before.body,/action="\/external\/targets\/private-target\/reconcile"/);
    const postReconcile=(fields, origin='http://localhost:4310')=>app.inject({method:'POST',url:'/external/targets/private-target/reconcile',headers:{origin,host:'localhost:4310','content-type':'application/x-www-form-urlencoded'},payload:fields.toString()});
    const early=await postReconcile(new URLSearchParams({csrf,directiveId:d1.id,actor:'Operator',rationale:'Continue from readback'})); assert.equal(early.statusCode,400);
    await new Promise((resolve)=>setTimeout(resolve,4));
    const observed=observation(`witness-${receiptMode}`,ids.a,'1.0.0','boot-observed',{directiveId:d1.id}); assert.equal((await postEvent(app,observed)).statusCode,200);
    const witnessed=(await app.inject('/applications/hello-observatory')).body; assert.match(witnessed,/action="\/external\/targets\/private-target\/reconcile"/);
    assert.equal((await postReconcile(new URLSearchParams({csrf,directiveId:'old-directive-id',actor:'Operator',rationale:'Wrong directive'}))).statusCode,409);
    assert.equal((await postReconcile(new URLSearchParams({csrf,directiveId:d1.id,actor:'Operator',rationale:'Cross origin'}),'http://attacker.example')).statusCode,403);
    const duplicate=new URLSearchParams({csrf,directiveId:d1.id,actor:'Operator',rationale:'Continue from readback'}); duplicate.append('csrf',csrf);
    assert.equal((await postReconcile(duplicate)).statusCode,400);
    assert.equal((await postReconcile(new URLSearchParams({csrf,directiveId:d1.id,actor:'Operator'}))).statusCode,403);
    const apiForgery={...observed,eventId:`forge-${receiptMode}`,kind:'reconciliation',actor:'Operator',rationale:'fake'};
    assert.equal((await postEvent(app,apiForgery)).statusCode,400);
    const ack=await postReconcile(new URLSearchParams({csrf,directiveId:d1.id,actor:'Operator',rationale:`Continue after ${receiptMode} receipt; observed version only`})); assert.equal(ack.statusCode,303);
    const afterAck=(await app.inject('/applications/hello-observatory')).body;
    assert.match(afterAck,/Execution outcome unknown · operator continuation recorded/); assert.match(afterAck,/No receipt received\.|unknown ·/i); assert.match(afterAck,/Witness event/); assert.match(afterAck,/observed version only/);
    if (receiptMode === 'missing') {
      assert.equal((await postEvent(app,receipt('late-unknown-receipt',d1.id,ids.a,'unknown'))).statusCode,200);
      assert.match((await app.inject('/applications/hello-observatory')).body,/reconciliation required/);
      await new Promise((resolve)=>setTimeout(resolve,4));
      assert.equal((await postEvent(app,observation('read-after-late-receipt',ids.a,'1.0.0','boot-observed',{directiveId:d1.id}))).statusCode,200);
      assert.equal((await postReconcile(new URLSearchParams({csrf,directiveId:d1.id,actor:'Operator',rationale:'Reconcile after late receipt'}))).statusCode,303);
    } else {
      const priorFinish=new Date(Date.parse(observed.observedAt)-100).toISOString();
      assert.equal((await postEvent(app,receipt('repeat-unknown-receipt',d1.id,ids.a,'unknown',{startedAt:priorFinish,finishedAt:priorFinish}))).statusCode,200);
      assert.match((await app.inject('/applications/hello-observatory')).body,/reconciliation required/);
      assert.equal((await postReconcile(new URLSearchParams({csrf,directiveId:d1.id,actor:'Operator',rationale:'Acknowledge the latest receipt event'}))).statusCode,303);
    }
    await new Promise((resolve)=>setTimeout(resolve,4));
    assert.equal((await postEvent(app,observation(`benign-refresh-${receiptMode}`,ids.a,'1.0.0','boot-observed',{directiveId:d1.id}))).statusCode,200);
    assert.match((await app.inject('/applications/hello-observatory')).body,/operator continuation recorded/);
    await new Promise((resolve)=>setTimeout(resolve,4));
    assert.equal((await postEvent(app,observation(`changed-boot-${receiptMode}`,ids.a,'1.0.0','boot-changed',{directiveId:d1.id}))).statusCode,200);
    assert.match((await app.inject('/applications/hello-observatory')).body,/reconciliation required/);
    assert.equal((await createDirective(app,'deploy',`1.1.0|${ids.b}`,csrf)).statusCode,409);
    await new Promise((resolve)=>setTimeout(resolve,4));
    const unknownRead={schemaVersion:1,eventId:`unknown-refresh-${receiptMode}`,backendId:'private-backend',applicationId:'observatory-hello-reference',destinationId:'private-target',instanceId:'private-incarnation',directiveId:d1.id,kind:'observation',source:'bounded HTTP GET /version',detail:'target unavailable',outcome:'unknown',observedAt:new Date().toISOString(),version:null,artifactId:null,bootId:null};
    assert.equal((await postEvent(app,unknownRead)).statusCode,200); assert.equal((await createDirective(app,'deploy',`1.1.0|${ids.b}`,csrf)).statusCode,409);
    await new Promise((resolve)=>setTimeout(resolve,4));
    assert.equal((await postEvent(app,observation(`readback-recovered-${receiptMode}`,ids.a,'1.0.0','boot-recovered',{directiveId:d1.id}))).statusCode,200);
    assert.equal((await postReconcile(new URLSearchParams({csrf,directiveId:d1.id,actor:'Operator',rationale:'New boot observed after unknown read'}))).statusCode,303);
    const next=await createDirective(app,'deploy',`1.1.0|${ids.b}`,csrf); assert.equal(next.statusCode,303);
    const d2=(await app.inject({url:'/api/runtime/v1/targets/private-target/directive',headers:auth})).json().directive;
    assert.notEqual(d2.id,d1.id); assert.equal(d2.expectedBootId,'boot-recovered');
    const history=(await app.inject('/applications/hello-observatory/history')).body; assert.match(history,/witness-missing|witness-unknown/); assert.match(history,/Continue after (missing|unknown) receipt/);
    await app.close();
    const reopened=createApplication(join(directory,'db'),undefined,readExternalConfig(join(directory,'private-config.json'),token)); t.after(()=>reopened.close());
    const persisted=(await reopened.inject('/applications/hello-observatory/history')).body; assert.match(persisted,/witness-missing|witness-unknown/); assert.match(persisted,/Continue after (missing|unknown) receipt/);
  }
});
