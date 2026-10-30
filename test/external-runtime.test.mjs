import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chmodSync, mkdtempSync, rmSync, writeFileSync, symlinkSync, readFileSync } from 'node:fs';
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

test('accepted Aloha example identity is valid, ingestible, and hello slug is reserved', (t) => {
  const example = validateConfig(JSON.parse(readFileSync(new URL('../examples/external-runtime-config.example.json', import.meta.url), 'utf8')));
  const alohaTarget = example.targets.find((target) => target.id === 'x01-aloha-qa');
  assert.equal(alohaTarget.applicationId, 'observatory-aloha-reference');
  const directory = mkdtempSync(join(tmpdir(), 'ao-external-example-')); t.after(() => rmSync(directory, { recursive: true, force: true }));
  const catalog = openCatalog(join(directory, 'db')); t.after(() => catalog.close());
  const runtime = new ExternalRuntime(catalog.db, example, token);
  const artifact = alohaTarget.artifacts[0];
  const event = { schemaVersion: 1, eventId: 'example-aloha-observation', backendId: example.backendId,
    applicationId: 'observatory-aloha-reference', destinationId: alohaTarget.id, instanceId: alohaTarget.instanceId,
    directiveId: null, kind: 'observation', source: 'example configured collector', detail: 'accepted app identity',
    outcome: 'observed', observedAt: nowIso(), version: artifact.version, artifactId: artifact.artifactId, bootId: 'example-aloha-boot' };
  assert.deepEqual(runtime.ingest(alohaTarget.id, event), { schemaVersion: 1, accepted: true, duplicate: false });
  const apps = example.applications;
  assert.throws(() => validateConfig({ ...JSON.parse(readFileSync(new URL('../examples/external-runtime-config.example.json', import.meta.url), 'utf8')),
    applications: apps.map((application) => application.id === 'observatory-aloha-reference' ? { ...application, slug: 'hello-observatory' } : application) }), /reserved/);
  assert.throws(() => validateConfig({ ...JSON.parse(readFileSync(new URL('../examples/external-runtime-config.example.json', import.meta.url), 'utf8')),
    applications: [...apps, { id: 'another-hello-app', slug: 'hello-observatory', name: 'Another Hello', purpose: 'Must not take the canonical route.' }] }), /reserved/);
});

test('multi-application targets isolate evidence, enforce declared modes and render scoped bounded routes', async (t) => {
  const multi = {
    schemaVersion: 1, backendId: 'private-backend',
    applications: [
      { id: 'observatory-hello-reference', slug: 'hello-observatory', name: 'Hello Observatory', purpose: 'Accepted reference app' },
      { id: 'observatory-aloha-reference', slug: 'aloha-observatory', name: 'Aloha Observatory', purpose: 'Second configured app <safe>' },
    ],
    targets: [
      { ...config.targets[0], id: 'hello-managed', name: 'Hello Test', instanceId: 'hello-test-instance' },
      { ...config.targets[0], id: 'hello-managed-2', name: 'Hello Test Canary', instanceId: 'hello-canary-instance' },
      { ...config.targets[0], id: 'hello-observe', name: 'Hello QA', stage: 'QA', instanceId: 'hello-qa-instance', mode: 'observe-only', limitations: 'Runtime self-report & local collector only.' },
      { ...config.targets[0], id: 'aloha-qa', name: 'Aloha QA', applicationId: 'observatory-aloha-reference', stage: 'QA', instanceId: 'aloha-qa-instance', mode: 'observe-only' },
      { ...config.targets[0], id: 'aloha-qa-stale', name: 'Aloha QA Canary', applicationId: 'observatory-aloha-reference', stage: 'QA', instanceId: 'aloha-qa-canary-instance', mode: 'observe-only' },
      { ...config.targets[0], id: 'aloha-demo-runtime', name: 'Aloha Demo Runtime', applicationId: 'observatory-aloha-reference', stage: 'Demo', instanceId: 'aloha-demo-runtime-instance', mode: 'observe-only' },
      { ...config.targets[0], id: 'aloha-demo', name: 'Aloha Demo', applicationId: 'observatory-aloha-reference', stage: 'Demo', instanceId: 'aloha-demo-instance', mode: 'planned', artifacts: [], limitations: 'Metadata only <script>safe</script>.' },
    ],
  };
  const normalized = validateConfig(multi);
  assert.equal(normalized.targets[0].mode, 'managed');
  assert.match(normalized.targets[0].limitations, /health and independent Test acceptance are not evaluated/);
  assert.equal(validateConfig({ ...multi, targets: [] }).targets.length, 0, 'application-only metadata remains valid without target records');
  assert.equal(validateConfig(config).applications[0].slug, 'hello-observatory');
  assert.throws(() => validateConfig({ ...multi, applications: [...multi.applications, { ...multi.applications[1], id: 'other-id' }] }), /unique/);
  assert.throws(() => validateConfig({ ...multi, applications: [...multi.applications, { ...multi.applications[1], slug: 'application-observatory' }] }), /self-entry/);
  assert.throws(() => validateConfig({ ...multi, applications: [{ ...multi.applications[0], purpose: 'Client secret=example-value' }, multi.applications[1]] }), /application metadata/);
  assert.throws(() => validateConfig({ ...multi, targets: [{ ...multi.targets[0], limitations: 'Read https://internal.example.invalid:4310 for status.' }, ...multi.targets.slice(1)] }), /without endpoints/);
  assert.throws(() => validateConfig({ ...multi, targets: [{ ...multi.targets[0], limitations: 'Use node ./private/runner.js' }, ...multi.targets.slice(1)] }), /without endpoints/);
  assert.throws(() => validateConfig({ ...multi, targets: [...multi.targets, { ...multi.targets[0], id: 'x'.repeat(121) }] }), /target config/);
  assert.throws(() => validateConfig({ ...multi, targets: Array(21).fill(multi.targets[0]).map((target, i) => ({ ...target, id: `target-${i}`, instanceId: `instance-${i}` })) }), /20 targets/);

  const directory = mkdtempSync(join(tmpdir(), 'ao-external-multi-')); t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, 'private-config.json'); writeFileSync(file, JSON.stringify(multi), { mode: 0o600 }); chmodSync(file, 0o600);
  const credentials = readExternalConfig(file, token); const app = createApplication(join(directory, 'db'), undefined, credentials); t.after(() => app.close());
  const at = nowIso();
  const observationFor = (targetId, applicationId, instanceId, eventId) => ({ schemaVersion: 1, eventId, backendId: 'private-backend', applicationId, destinationId: targetId, instanceId, directiveId: null, kind: 'observation', source: 'bounded collector', detail: 'self-reported version', outcome: 'observed', observedAt: at, version: '1.0.0', artifactId: ids.a, bootId: `boot-${eventId}` });
  const helloEvent = observationFor('hello-observe', 'observatory-hello-reference', 'hello-qa-instance', 'hello-observed');
  const alohaEvent = observationFor('aloha-qa', 'observatory-aloha-reference', 'aloha-qa-instance', 'aloha-observed');
  const alohaStale = { ...observationFor('aloha-qa-stale', 'observatory-aloha-reference', 'aloha-qa-canary-instance', 'aloha-stale'), observedAt: new Date(Date.now() - 400_000).toISOString() };
  const helloFresh = observationFor('hello-managed-2', 'observatory-hello-reference', 'hello-canary-instance', 'hello-canary-observed');
  assert.equal((await app.inject({ method: 'POST', url: '/api/runtime/v1/targets/hello-observe/events', headers: { ...auth, 'content-type': 'application/json' }, payload: helloEvent })).statusCode, 200);
  assert.equal((await app.inject({ method: 'POST', url: '/api/runtime/v1/targets/aloha-qa/events', headers: { ...auth, 'content-type': 'application/json' }, payload: alohaEvent })).statusCode, 200);
  assert.equal((await app.inject({ method: 'POST', url: '/api/runtime/v1/targets/aloha-qa-stale/events', headers: { ...auth, 'content-type': 'application/json' }, payload: alohaStale })).statusCode, 200);
  assert.equal((await app.inject({ method: 'POST', url: '/api/runtime/v1/targets/hello-managed-2/events', headers: { ...auth, 'content-type': 'application/json' }, payload: helloFresh })).statusCode, 200);
  const wrongTarget = await app.inject({ method: 'POST', url: '/api/runtime/v1/targets/aloha-qa/events', headers: { ...auth, 'content-type': 'application/json' }, payload: { ...helloEvent, eventId: 'wrong-app-event' } });
  assert.equal(wrongTarget.statusCode, 400);
  assert.equal((await app.inject({ url: '/api/runtime/v1/targets/aloha-demo/directive', headers: auth })).statusCode, 404);
  assert.equal((await app.inject({ url: '/applications/aloha-observatory/targets/aloha-demo/history' })).statusCode, 200, 'planned targets keep read-only archives available without gaining a runtime interface');
  assert.equal((await app.inject({ url: '/applications/aloha-observatory/targets/hello-observe/history' })).statusCode, 404);
  const helloPage = await app.inject('/applications/hello-observatory');
  const helloCsrf = helloPage.body.match(/name="csrf" value="([a-f0-9]+)"/)?.[1]; assert.ok(helloCsrf);
  const firstDirective = await app.inject({ method: 'POST', url: '/external/targets/hello-managed/directives', headers: { origin: 'http://localhost:4310', host: 'localhost:4310', 'content-type': 'application/x-www-form-urlencoded' }, payload: new URLSearchParams({ csrf: helloCsrf, action: 'deploy', release: `1.1.0|${ids.b}`, actor: 'Operator', rationale: 'Independent target gate' }).toString() });
  assert.equal(firstDirective.statusCode, 303);
  const secondDirective = await app.inject({ method: 'POST', url: '/external/targets/hello-managed-2/directives', headers: { origin: 'http://localhost:4310', host: 'localhost:4310', 'content-type': 'application/x-www-form-urlencoded' }, payload: new URLSearchParams({ csrf: helloCsrf, action: 'deploy', release: `1.1.0|${ids.b}`, actor: 'Operator', rationale: 'Separate target remains eligible' }).toString() });
  assert.equal(secondDirective.statusCode, 303, 'an unresolved target A must not block a distinct target B');

  const aloha = await app.inject('/applications/aloha-observatory');
  assert.equal(aloha.statusCode, 200); assert.match(aloha.body, /Aloha Observatory/); assert.match(aloha.body, /Metadata only &lt;script&gt;safe&lt;\/script&gt;/);
  assert.match(aloha.body, /Observed/); assert.match(aloha.body, /Stale/); assert.match(aloha.body, /Planned/); assert.doesNotMatch(aloha.body, /Create deploy directive|Create rollback directive|name="action"/);
  const hello = await app.inject('/applications/hello-observatory');
  assert.equal(hello.statusCode, 200); assert.match(hello.body, /Hello Test/); assert.match(hello.body, /Hello Test Canary/); assert.match(hello.body, /Hello QA/); assert.match(hello.body, /Independent target gate/);
  assert.doesNotMatch(hello.body, /aloha-observed/);
  const scopedHello = await app.inject('/applications/hello-observatory/targets/hello-observe/history');
  const scopedAloha = await app.inject('/applications/aloha-observatory/targets/aloha-qa/history');
  assert.match(scopedHello.body, /hello-observed/); assert.doesNotMatch(scopedHello.body, /aloha-observed/);
  assert.match(scopedAloha.body, /aloha-observed/); assert.doesNotMatch(scopedAloha.body, /hello-observed/);
  assert.equal((await app.inject('/applications/hello-observatory/history')).statusCode, 409, 'legacy alias refuses multiple Hello targets');
  const observeDirective = await app.inject({ url: '/api/runtime/v1/targets/hello-observe/directive', headers: auth });
  assert.equal(observeDirective.statusCode, 200); assert.equal(observeDirective.json().directive, null);
  const observeReceipt = { ...receipt('observe-receipt', 'missing-directive', ids.a), applicationId: 'observatory-hello-reference', destinationId: 'hello-observe', instanceId: 'hello-qa-instance' };
  const deniedReceipt = await app.inject({ method: 'POST', url: '/api/runtime/v1/targets/hello-observe/events', headers: { ...auth, 'content-type': 'application/json' }, payload: observeReceipt });
  assert.equal(deniedReceipt.statusCode, 409);
  const db = openCatalog(join(directory, 'db')); assert.equal(db.db.prepare("SELECT COUNT(*) AS n FROM external_events WHERE destination_id='aloha-demo'").get().n, 0); db.close();
});

test('replacement backend or incarnation cannot inherit live state while target archive remains exact and scoped', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'ao-external-replacement-')); t.after(() => rmSync(directory, { recursive: true, force: true }));
  const dbPath = join(directory, 'db'); const catalog = openCatalog(dbPath);
  const at = nowIso(); const targetId = 'private-target'; const applicationId = 'observatory-hello-reference';
  const directive = { id: 'old-directive-001', backend_id: 'private-backend', application_id: applicationId, destination_id: targetId,
    instance_id: 'private-incarnation', action: 'deploy', version: '1.0.0', artifact_id: ids.a, created_at: at,
    expected_boot_id: null, actor: 'Old operator', rationale: 'Retained before replacement' };
  catalog.db.prepare('INSERT INTO external_directives (id,backend_id,application_id,destination_id,instance_id,action,version,artifact_id,created_at,expected_boot_id,actor,rationale) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(directive.id, directive.backend_id, directive.application_id, directive.destination_id, directive.instance_id, directive.action, directive.version, directive.artifact_id, directive.created_at, directive.expected_boot_id, directive.actor, directive.rationale);
  const historyRows = [
    { schemaVersion: 1, eventId: 'old-observation-001', backendId: 'private-backend', applicationId, destinationId: targetId, instanceId: 'private-incarnation', directiveId: directive.id, kind: 'observation', source: 'old collector', detail: 'old observed version', outcome: 'observed', observedAt: at, version: '1.0.0', artifactId: ids.a, bootId: 'old-boot' },
    { schemaVersion: 1, eventId: 'old-unknown-receipt-001', backendId: 'private-backend', applicationId, destinationId: targetId, instanceId: 'private-incarnation', directiveId: directive.id, kind: 'receipt', source: 'old client', detail: 'receipt was not received', outcome: 'unknown', artifactId: ids.a, startedAt: at, finishedAt: at },
    { schemaVersion: 1, eventId: 'old-reconciliation-001', backendId: 'private-backend', applicationId, destinationId: targetId, instanceId: 'private-incarnation', directiveId: directive.id, kind: 'reconciliation', source: 'Local operator reconciliation', detail: 'old explicit continuation', outcome: 'acknowledged', actor: 'Old operator', rationale: 'Old explicit continuation', witnessEventId: 'old-observation-001', observedAt: at, version: '1.0.0', artifactId: ids.a, bootId: 'old-boot', witnessReceiptEventId: 'old-unknown-receipt-001', witnessReceiptOutcome: 'unknown', recordedAt: at },
  ];
  const insertEvent = catalog.db.prepare('INSERT INTO external_events (event_id,backend_id,application_id,destination_id,instance_id,directive_id,kind,source,detail,outcome,version,artifact_id,boot_id,observed_at,started_at,finished_at,recorded_at,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  for (const event of historyRows) {
    const raw = JSON.stringify(event);
    insertEvent.run(event.eventId, event.backendId, event.applicationId, event.destinationId, event.instanceId, event.directiveId, event.kind, event.source, event.detail, event.outcome,
      event.version ?? null, event.artifactId ?? null, event.bootId ?? null, event.observedAt ?? null, event.startedAt ?? null, event.finishedAt ?? null, event.recordedAt ?? at, raw);
  }
  const foreignEvents = [
    { ...historyRows[0], eventId: 'other-application-secret', applicationId: 'observatory-aloha-reference' },
    { ...historyRows[0], eventId: 'other-target-secret', destinationId: 'another-target' },
  ];
  for (const event of foreignEvents) insertEvent.run(event.eventId, event.backendId, event.applicationId, event.destinationId, event.instanceId, event.directiveId, event.kind, event.source, event.detail, event.outcome, event.version, event.artifactId, event.bootId, event.observedAt, null, null, at, JSON.stringify(event));
  const originalPayloads = catalog.db.prepare('SELECT event_id,payload_json FROM external_events WHERE destination_id=? AND application_id=? ORDER BY seq').all(targetId, applicationId);
  const originalDirective = catalog.db.prepare('SELECT * FROM external_directives WHERE id=?').get(directive.id);
  catalog.close();

  const cases = [
    { name: 'new instance', backendId: 'private-backend', instanceId: 'replacement-incarnation', mode: 'managed' },
    { name: 'new backend', backendId: 'replacement-backend', instanceId: 'private-incarnation', mode: 'managed' },
    { name: 'planned mode after replacement', backendId: 'replacement-backend', instanceId: 'replacement-incarnation', mode: 'planned' },
  ];
  for (const replacement of cases) {
    const appConfig = { schemaVersion: 1, backendId: replacement.backendId,
      applications: [{ id: applicationId, slug: 'hello-observatory', name: 'Hello Observatory', purpose: 'Accepted reference application' }],
      targets: [{ id: targetId, name: 'Hello Test', applicationId, stage: 'Test', instanceId: replacement.instanceId,
        mode: replacement.mode, artifacts: replacement.mode === 'planned' ? [] : [{ version: '1.0.0', artifactId: ids.a }, { version: '1.1.0', artifactId: ids.b }] }] };
    const app = createApplication(dbPath, undefined, { config: appConfig, token }); let closed = false;
    const close = async () => { if (!closed) { closed = true; await app.close(); } }; t.after(close);
    const api = await app.inject({ url: `/api/runtime/v1/targets/${targetId}/directive`, headers: auth });
    if (replacement.mode === 'planned') assert.equal(api.statusCode, 404);
    else assert.deepEqual(api.json(), { schemaVersion: 1, directive: null });
    const detail = await app.inject('/applications/hello-observatory');
    assert.equal(detail.statusCode, 200);
    if (replacement.mode === 'planned') {
      assert.match(detail.body, /No valid version observed yet/);
      assert.match(detail.body, /href="\/applications\/hello-observatory\/targets\/private-target\/history"/);
      assert.match(detail.body, /Inspect retained historical directives/);
    }
    else assert.match(detail.body, /No observation received\./);
    assert.doesNotMatch(detail.body, /Rollback to retained release/);
    if (replacement.mode !== 'planned') {
      const observed = { ...observation(`replacement-observation-${replacement.name.replaceAll(' ', '-')}`), backendId: replacement.backendId,
        instanceId: replacement.instanceId, directiveId: directive.id };
      const receiptEvent = { ...receipt(`replacement-receipt-${replacement.name.replaceAll(' ', '-')}`, directive.id, ids.a, 'unknown'), backendId: replacement.backendId, instanceId: replacement.instanceId };
      assert.equal((await app.inject({ method: 'POST', url: `/api/runtime/v1/targets/${targetId}/events`, headers: { ...auth, 'content-type': 'application/json' }, payload: observed })).statusCode, 409,
        `${replacement.name}: observation must not correlate to an archived directive`);
      assert.equal((await app.inject({ method: 'POST', url: `/api/runtime/v1/targets/${targetId}/events`, headers: { ...auth, 'content-type': 'application/json' }, payload: receiptEvent })).statusCode, 409,
        `${replacement.name}: receipt must not correlate to an archived directive`);
    }
    const history = await app.inject(`/applications/hello-observatory/targets/${targetId}/history`);
    assert.equal(history.statusCode, 200); assert.match(history.body, /across all retained backends and instances/);
    for (const event of historyRows) assert.ok(history.body.includes(event.eventId), `${replacement.name}: archive should retain ${event.eventId}`);
    assert.doesNotMatch(history.body, /other-application-secret|other-target-secret/);
    assert.match(history.body, /private-backend/); assert.match(history.body, /private-incarnation/);
    const lookup = await app.inject(`/applications/hello-observatory/targets/${targetId}/directives?through=0&before=1&lookup=${directive.id}`);
    assert.equal(lookup.statusCode, 200); assert.match(lookup.body, /Associated historical directive/); assert.match(lookup.body, /Original backend private-backend · instance private-incarnation/);
    assert.match(lookup.body, /old-directive-001/); assert.match(lookup.body, /Retained before replacement/);
    assert.equal((await app.inject(`/applications/hello-observatory/targets/${targetId}/directives?lookup=${'x'.repeat(121)}`)).statusCode, 400);
    const reopened = openCatalog(dbPath);
    assert.deepEqual(reopened.db.prepare('SELECT event_id,payload_json FROM external_events WHERE destination_id=? AND application_id=? ORDER BY seq').all(targetId, applicationId), originalPayloads,
      `${replacement.name}: archive reads must not rewrite retained event bytes`);
    assert.deepEqual(reopened.db.prepare('SELECT * FROM external_directives WHERE id=?').get(directive.id), originalDirective,
      `${replacement.name}: archive reads must not rewrite retained directive row`);
    reopened.close();
    if (replacement.mode !== 'planned') {
      const csrf = detail.body.match(/name="csrf" value="([a-f0-9]+)"/)?.[1]; assert.ok(csrf);
      const freshDirective = await app.inject({ method: 'POST', url: `/external/targets/${targetId}/directives`,
        headers: { origin: 'http://localhost:4310', host: 'localhost:4310', 'content-type': 'application/x-www-form-urlencoded' },
        payload: new URLSearchParams({ csrf, action: 'deploy', release: `1.0.0|${ids.a}`, actor: 'New operator', rationale: 'New scope starts independently' }).toString() });
      assert.equal(freshDirective.statusCode, 303, `${replacement.name}: archived unresolved evidence must not block a fresh directive`);
    }
    await close();
  }
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
  insertDirective.run('directive-zero-events','private-backend','observatory-hello-reference','private-target','private-incarnation','rollback','1.0.0',ids.a,new Date(base-1).toISOString(),'expected-old-boot','Zero event operator','This directive has no event rows and remains inspectable.');
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

  const history=await app.inject('/applications/hello-observatory/history');
  assert.equal(history.statusCode,200); assert.match(history.body,/Records 1–20 of 1500/); assert.match(history.body,/stable snapshot/); assert.ok(history.body.length<30_000);
  assert.doesNotMatch(history.body,/<form\b/i,'history reads do not offer dispatch or observation controls');
  const through=Number(history.body.match(/snapshot (\d+)/)?.[1]); const before=Number(history.body.match(/before=(\d+)/)?.[1]); assert.ok(through>before);
  let oldPage=history; let foundOld=false;
  while(!foundOld) {
    foundOld ||= oldPage.body.includes('observation-0000');
    if(foundOld) break;
    const next=oldPage.body.match(/href="\/applications\/hello-observatory\/history\?through=\d+&amp;before=(\d+)"/);
    assert.ok(next,'older-event navigation should continue to the retained oldest row');
    oldPage=await app.inject(`/applications/hello-observatory/history?through=${through}&before=${next[1]}`);
    assert.equal(oldPage.statusCode,200);
  }
  assert.ok(foundOld,'old observations must remain navigable');
  for(const query of ['through=0&before=0','through=-1&before=2','through=1e6&before=1','through=99999999999999999&before=1','through=01&before=1','through=1','page=1','x=1']) {
    assert.equal((await app.inject(`/applications/hello-observatory/history?${query}`)).statusCode,400,`${query} must be rejected`);
  }
  assert.equal((await app.inject('/applications/hello-observatory/history?through=1&through=2&before=1')).statusCode,400);
  assert.equal((await app.inject({method:'POST',url:'/applications/hello-observatory/history?through=1&before=1'})).statusCode,405);
  const directives=await app.inject('/applications/hello-observatory/directives');
  assert.equal(directives.statusCode,200); assert.match(directives.body,/rationale 299/); assert.match(directives.body,/Expected boot ID/);
  assert.doesNotMatch(directives.body,/<form\b/i,'directive ledger reads do not offer dispatch or observation controls');
  const dthrough=Number(directives.body.match(/snapshot (\d+)/)?.[1]); const dbefore=Number(directives.body.match(/before=(\d+)/)?.[1]);
  const emptyDirectivePage=await app.inject(`/applications/hello-observatory/directives?through=${dthrough}&before=2`);
  assert.ok(emptyDirectivePage.body.includes('This directive has no event rows')); assert.ok(emptyDirectivePage.body.includes('expected-old-boot'));
  assert.equal((await app.inject('/applications/hello-observatory/directives?through=1&through=2&before=1')).statusCode,400);
  const verify=openCatalog(join(directory,'db'));
  assert.equal((verify.db.prepare('SELECT COUNT(*) AS count FROM external_events').get()).count,1500);
  assert.equal((verify.db.prepare('SELECT COUNT(*) AS count FROM external_directives').get()).count,301);
  verify.close();
});

test('mixed-precision ISO chronology selects latest, latest-known and rollback eligibility by milliseconds', (t) => {
  const directory=mkdtempSync(join(tmpdir(),'ao-external-precision-')); t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const catalog=openCatalog(join(directory,'db')); t.after(()=>catalog.close());
  let clock=Date.parse('2026-10-30T12:00:00.900Z'); const runtime=new ExternalRuntime(catalog.db,validateConfig(config),token,()=>new Date(clock));
  const put=(eventId,outcome,observedAt,artifactId=null,version=null)=>runtime.ingest('private-target',{schemaVersion:1,eventId,backendId:'private-backend',applicationId:'observatory-hello-reference',destinationId:'private-target',instanceId:'private-incarnation',directiveId:null,kind:'observation',source:'bounded HTTP GET /version',detail:'mixed precision test',outcome,observedAt,version,artifactId,bootId:outcome==='observed'?'boot-mixed':null});
  put('known-millis','observed','2026-10-30T12:00:00.250Z',ids.a,'1.0.0');
  put('unknown-no-millis','unknown','2026-10-30T12:00:00Z');
  assert.equal(runtime.state('private-target').observation.eventId,'known-millis','.250Z is later than the no-millisecond .000Z timestamp');
  put('unknown-later','unknown','2026-10-30T12:00:00.500Z');
  assert.equal(runtime.state('private-target').observation.eventId,'unknown-later');
  assert.equal(runtime.state('private-target').lastObservation.eventId,'known-millis','latest known observation excludes the later unknown');
  put('later-known','observed','2026-10-30T12:00:00.900Z',ids.b,'1.1.0');
  assert.equal(runtime.state('private-target').observation.eventId,'later-known'); assert.equal(runtime.state('private-target').lastObservation.eventId,'later-known');
  put('later-second-no-millis','observed','2026-10-30T12:00:01Z',ids.c,'1.2.0');
  assert.equal(runtime.state('private-target').observation.eventId,'later-second-no-millis');
  assert.equal(runtime.hasEarlierObservedArtifact('private-target',ids.b,'2026-10-30T12:00:01Z'),true);
  assert.equal(runtime.hasEarlierObservedArtifact('private-target',ids.c,'2026-10-30T12:00:00.900Z'),false);

  const rollbackCatalog=openCatalog(join(directory,'rollback-db'));
  const rollbackRuntime=new ExternalRuntime(rollbackCatalog.db,validateConfig(config),token,()=>new Date('2026-10-30T12:00:00.002Z'));
  const rollbackObservation=(eventId,artifactId,version,observedAt)=>rollbackRuntime.ingest('private-target',{schemaVersion:1,eventId,backendId:'private-backend',applicationId:'observatory-hello-reference',destinationId:'private-target',instanceId:'private-incarnation',directiveId:null,kind:'observation',source:'bounded HTTP GET /version',detail:'rollback precision test',outcome:'observed',observedAt,version,artifactId,bootId:`boot-${eventId}`});
  rollbackObservation('rollback-older-no-ms',ids.a,'1.0.0','2026-10-30T12:00:00Z');
  rollbackObservation('rollback-current-millis',ids.b,'1.1.0','2026-10-30T12:00:00.001Z');
  assert.equal(rollbackRuntime.state('private-target').observation.eventId,'rollback-current-millis');
  assert.equal(rollbackRuntime.state('private-target').fresh,true);
  assert.equal(rollbackRuntime.hasEarlierObservedArtifact('private-target',ids.a,'2026-10-30T12:00:00.001Z'),true);
  const rollbackDirective=rollbackRuntime.createDirective('private-target',{action:'rollback',version:'1.0.0',artifactId:ids.a,actor:'Operator',rationale:'Chronologically earlier mixed precision artifact'});
  assert.equal(rollbackDirective.action,'rollback'); rollbackCatalog.close();
});

test('event and directive keyset traversals remain duplicate-free within their opening snapshots', async (t) => {
  const {app,directory}=fixture(t); const db=openCatalog(join(directory,'db')); t.after(()=>db.close());
  const eventInsert=db.db.prepare(`INSERT INTO external_events (event_id,backend_id,application_id,destination_id,instance_id,directive_id,kind,source,detail,outcome,version,artifact_id,boot_id,observed_at,started_at,finished_at,recorded_at,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const directiveInsert=db.db.prepare('INSERT INTO external_directives (id,backend_id,application_id,destination_id,instance_id,action,version,artifact_id,created_at,expected_boot_id,actor,rationale) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  for(let i=0;i<45;i++) {
    const event={schemaVersion:1,eventId:`snapshot-event-${i}`,backendId:'private-backend',applicationId:'observatory-hello-reference',destinationId:'private-target',instanceId:'private-incarnation',directiveId:null,kind:'observation',source:'test',detail:`snap-${i}`,outcome:'unknown',observedAt:'2026-10-30T12:00:00Z',version:null,artifactId:null,bootId:null};
    eventInsert.run(event.eventId,event.backendId,event.applicationId,event.destinationId,event.instanceId,null,event.kind,event.source,event.detail,event.outcome,null,null,null,event.observedAt,null,null,event.observedAt,JSON.stringify(event));
    directiveInsert.run(`snapshot-directive-${i}`,'private-backend','observatory-hello-reference','private-target','private-incarnation','deploy','1.0.0',ids.a,`2026-10-30T12:00:${String(i).padStart(2,'0')}Z`,null,'Snapshot operator',`snapshot rationale ${i}`);
  }
  const readSnapshot=async (path, marker) => {
    const seen=[]; const records=[]; let url=path; let snapshot;
    while(url) {
      const response=await app.inject(url); assert.equal(response.statusCode,200);
      const body=response.body; snapshot ??= Number(body.match(/snapshot (\d+)/)?.[1]);
      const found=path.includes('history')?[...body.matchAll(/<p>snapshot-event-([0-9]+) ·/g)]:[...body.matchAll(/snapshot rationale ([0-9]+)<\/dd>/g)];
      seen.push(...found.map((match)=>Number(match[1])));
      records.push(...(path.includes('history')?[...body.matchAll(/<p>(snapshot-event-[0-9]+|appended-event-during-traversal) ·/g)].map((match)=>match[1]):[...body.matchAll(/<li id="directive-([^"]+)">/g)].map((match)=>match[1])));
      const match=body.match(new RegExp(`${path.includes('history')?'history':'directives'}\\?through=${snapshot}&amp;before=([0-9]+)`));
      url=match?`${path}?through=${snapshot}&before=${match[1]}`:null;
      if(seen.length===20) {
        // Insert after the first page; the fixed upper sequence excludes it from the traversal.
        const suffix=path.includes('history')?'event':'directive';
        const event={schemaVersion:1,eventId:`appended-${suffix}-during-traversal`,backendId:'private-backend',applicationId:'observatory-hello-reference',destinationId:'private-target',instanceId:'private-incarnation',directiveId:null,kind:'observation',source:'test',detail:'new-after-snapshot',outcome:'unknown',observedAt:'2026-10-30T12:00:00Z',version:null,artifactId:null,bootId:null};
        eventInsert.run(event.eventId,event.backendId,event.applicationId,event.destinationId,event.instanceId,null,event.kind,event.source,event.detail,event.outcome,null,null,null,event.observedAt,null,null,event.observedAt,JSON.stringify(event));
        directiveInsert.run(`appended-${suffix}-during-traversal`,'private-backend','observatory-hello-reference','private-target','private-incarnation','deploy','1.0.0',ids.a,'2026-10-30T12:00:59Z',null,'New operator','new after snapshot');
      }
    }
    return {seen,records};
  };
  const events=await readSnapshot('/applications/hello-observatory/history','snapshot-event-');
  assert.equal(events.seen.length,45); assert.equal(new Set(events.seen).size,45); assert.ok(!events.seen.includes(NaN));
  assert.equal(events.records.length,45); assert.equal(new Set(events.records).size,45); assert.ok(!events.records.includes('appended-event-during-traversal'));
  const directives=await readSnapshot('/applications/hello-observatory/directives','snapshot rationale ');
  assert.equal(directives.seen.length,45); assert.equal(new Set(directives.seen).size,45); assert.ok(!directives.seen.includes(NaN));
  assert.equal(directives.records.length,46); assert.equal(new Set(directives.records).size,46); assert.ok(directives.records.includes('appended-event-during-traversal')); assert.ok(!directives.records.includes('appended-directive-during-traversal'));
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
  assert.equal(runtime.state('private-target').fresh,true);
  const d2=runtime.createDirective('private-target',{action:'deploy',version:'1.1.0',artifactId:ids.b,actor:'Operator',rationale:'new deliberate change'});
  assert.equal(d2.expectedBootId,'boot-b');
  clock+=301_000; assert.equal(runtime.state('private-target').fresh,false);
  assert.equal(runtime.state('private-target').lastObservation.version,'1.0.0');
  assert.throws(()=>runtime.createDirective('private-target',{action:'deploy',version:'1.2.0',artifactId:ids.c,actor:'Operator',rationale:'stale read'}),/unresolved directive/);
  // An observation collected earlier and delivered later cannot make the current state fresh.
  clock+=1; sendObservation('old-late-event',d2.id,ids.a,'1.0.0','boot-old',new Date(clock-600_000).toISOString());
  assert.equal(runtime.state('private-target').fresh,false);
  const unknownAt=at(); runtime.ingest('private-target',{schemaVersion:1,eventId:'unknown-now',backendId:'private-backend',applicationId:'observatory-hello-reference',destinationId:'private-target',instanceId:'private-incarnation',directiveId:null,kind:'observation',source:'bounded HTTP GET /version',detail:'target unavailable',outcome:'unknown',observedAt:unknownAt,version:null,artifactId:null,bootId:null});
  assert.equal(runtime.state('private-target').observation.outcome,'unknown'); assert.equal(runtime.state('private-target').fresh,false);
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
  assert.equal(runtime.state('private-target').observation.eventId,'later-unknown'); assert.equal(runtime.state('private-target').fresh,false);
  assert.equal(receipt('unknown-receipt',d1.id,'1.0.0',ids.a,'unknown').accepted,true);
  assert.throws(()=>receipt('laundered-complete',d1.id,'1.0.0',ids.a,'completed'),/Conflicting receipt/);

  const nextDir=join(directory,'second-db'); const second=openCatalog(nextDir); t.after(()=>second.close());
  let secondClock=Date.now(); const rt=new ExternalRuntime(second.db,validateConfig(config),token,()=>new Date(secondClock)); const now=()=>new Date(secondClock).toISOString();
  const rec=(eventId,directiveId,artifactId,outcome,finish=now())=>rt.ingest('private-target',{schemaVersion:1,eventId,backendId:'private-backend',applicationId:'observatory-hello-reference',destinationId:'private-target',instanceId:'private-incarnation',directiveId,kind:'receipt',source:'external client',detail:'operation returned',outcome,artifactId,startedAt:finish,finishedAt:finish});
  const obs=(eventId,directiveId,version,artifactId,bootId,time=now())=>rt.ingest('private-target',{schemaVersion:1,eventId,backendId:'private-backend',applicationId:'observatory-hello-reference',destinationId:'private-target',instanceId:'private-incarnation',directiveId,kind:'observation',source:'bounded HTTP GET /version',detail:'runtime self-report',outcome:'observed',observedAt:time,version,artifactId,bootId});
  const old=rt.createDirective('private-target',{action:'deploy',version:'1.0.0',artifactId:ids.a,actor:'Operator',rationale:'first'});
  rec('old-failed',old.id,ids.a,'failed'); secondClock+=1000; obs('fresh-after-failed',old.id,'1.0.0',ids.a,'boot-one');
  const current=rt.createDirective('private-target',{action:'deploy',version:'1.1.0',artifactId:ids.b,actor:'Operator',rationale:'upgrade'});
  rec('delayed-old-receipt',old.id,ids.a,'failed'); assert.equal(rt.state('private-target').receipt,null);
  secondClock+=1000; obs('read-before-complete',current.id,'1.1.0',ids.b,'boot-one');
  secondClock+=1000; rec('current-complete',current.id,ids.b,'completed');
  assert.equal(rt.state('private-target').receipt.directiveId,current.id); assert.equal(rt.state('private-target').unresolved,true); assert.equal(rt.state('private-target').contradictory,false);
  secondClock+=1000; obs('read-same-boot',current.id,'1.1.0',ids.b,'boot-one');
  assert.equal(rt.state('private-target').contradictory,true); assert.equal(rt.state('private-target').unresolved,true);
  secondClock+=1000; obs('read-new-boot',current.id,'1.1.0',ids.b,'boot-two');
  assert.equal(rt.state('private-target').unresolved,false); assert.equal(rt.state('private-target').fresh,true);
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
