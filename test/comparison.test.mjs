import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApplication } from '../dist/app.js';
import { openCatalog } from '../dist/catalog.js';
import { ExternalRuntime, validateConfig } from '../dist/external-runtime.js';
import { EvidenceReader, snapshotQuery, PACKET_BUDGET } from '../dist/evidence.js';

const credential = 'synthetic-comparison-private-credential';
const releases = [{ version: '1.0.0', artifactId: `sha256:${'a'.repeat(64)}` }, { version: '2.0.0', artifactId: `sha256:${'b'.repeat(64)}` }];
const configuration = () => validateConfig({ schemaVersion: 1, backendId: 'comparison-backend', applications: [{ id: 'app-alpha', slug: 'alpha', name: 'Alpha <fixture>', purpose: 'Comparison fixture only' }], targets: ['one', 'two', 'planned'].map((id) => ({ id, name: `Placement ${id}`, applicationId: 'app-alpha', stage: 'QA', instanceId: `instance-${id}`, artifacts: id === 'planned' ? [] : releases, mode: id === 'planned' ? 'planned' : 'managed', limitations: 'Synthetic metadata; no health or independent Test evaluation.' })) });
const base = '/applications/alpha/targets/one';
function fixture(t, config = configuration(), offset = -30_000, secret = credential) {
  const directory = mkdtempSync(join(tmpdir(), 'ao-comparison-')); const dbDir = join(directory, 'db'); const catalog = openCatalog(dbDir);
  const app = createApplication(dbDir, undefined, { config, token: secret });
  let clock = Date.now() + offset; let sequence = 0;
  const runtime = new ExternalRuntime(catalog.db, config, secret, () => new Date(clock));
  const reader = new EvidenceReader(catalog.db, config, () => new Date(clock));
  t.after(async () => { await app.close(); catalog.close(); rmSync(directory, { recursive: true, force: true }); });
  const at = () => new Date(clock).toISOString();
  const common = (targetId, kind, directiveId = null) => { const target = config.targets.find((item) => item.id === targetId); return { schemaVersion: 1, eventId: `comparison-${++sequence}`, backendId: config.backendId, applicationId: target.applicationId, destinationId: targetId, instanceId: target.instanceId, directiveId, kind, source: 'curl https://unshared.example.invalid/collector', detail: 'cat /unshared/raw.log' }; };
  return { app, catalog, dbDir, config, runtime, reader, at, tick: (ms = 1000) => clock += ms,
    observe(targetId = 'one', release = releases[0], extra = {}) { const event = { ...common(targetId, 'observation'), outcome: 'observed', ...release, bootId: `boot-${sequence}`, observedAt: at(), ...extra }; runtime.ingest(targetId, event); return event; },
    request(targetId = 'one') { return runtime.createDirective(targetId, { action: 'deploy', ...releases[1], actor: `${secret} /unshared/operator`, rationale: 'Authorization: Bearer private-fixture; sudo node /unshared/action' }); },
    receipt(directiveId, outcome = 'unknown') { const event = { ...common('one', 'receipt', directiveId), outcome, artifactId: releases[1].artifactId, startedAt: at(), finishedAt: at() }; runtime.ingest('one', event); return event; },
  };
}
const counts = (db) => [db.prepare('SELECT COUNT(*) AS n FROM external_events').get().n, db.prepare('SELECT COUNT(*) AS n FROM external_directives').get().n];
const get = async (app, url) => { const response = await app.inject(url); assert.equal(response.statusCode, 200, response.body); return response.json(); };
const compareUrl = (snapshot, path = base, format = 'comparison.json') => `${path}/${format}?${snapshotQuery(snapshot)}`;

test('comparison counts new evidence separately, preserves unknown receipt and original continuation witness after matching reads', async (t) => {
  const f = fixture(t); f.observe(); const directive = f.request(); const baseline = f.reader.packet('alpha', 'one');
  f.tick(); const receipt = f.receipt(directive.id); f.tick(); const witness = f.observe('one', releases[1]);
  const decision = f.runtime.reconcile('one', { directiveId: directive.id, actor: 'Unsafe /unshared/actor', rationale: 'sudo action with private fixture input' });
  f.tick(); const later = f.observe('one', releases[1], { bootId: witness.bootId });
  const result = await get(f.app, compareUrl(baseline.snapshot));
  assert.equal(result.comparisonSchema, 'observatory-comparison-v1'); assert.deepEqual(result.baseline.snapshot, baseline.snapshot);
  assert.equal(result.changes.addedEvents, 4); assert.equal(result.changes.addedDirectives, 0); assert.equal(result.changes.noNewRecords, false);
  assert.equal(result.baseline.facts.receiptCondition, 'missing'); assert.equal(result.current.facts.receiptCondition, 'unknown');
  assert.equal(result.current.facts.executionUnknown, true); assert.equal(result.current.facts.reconciled, true); assert.equal(result.current.facts.unresolved, false);
  assert.equal(result.current.facts.observation.id, later.eventId); assert.equal(result.current.facts.reconciliation.id, decision.eventId);
  assert.equal(result.current.facts.reconciliation.witnessEventId, witness.eventId); assert.equal(result.current.facts.reconciliation.witnessReceiptEventId, receipt.eventId); assert.equal(result.current.facts.reconciliation.witnessReceiptOutcome, 'unknown');
  for (const reference of [result.current.facts.observation.recordRef, result.current.facts.receipt.recordRef, result.current.facts.reconciliation.witnessRef.value]) assert.ok(reference.includes(snapshotQuery(result.current.snapshot)));
  assert.equal((await get(f.app, result.current.facts.reconciliation.witnessRef.value)).record.id, witness.eventId);
  assert.equal(result.current.facts.directive.declaredOperator.availability, 'withheld'); assert.equal(result.current.facts.observation.collectorSource.availability, 'withheld');
  assert.equal(result.attribution.deploymentActor.availability, 'uncollected');
  const labels = result.changes.changedFacts.map((change) => change.field); for (const key of ['observation.version', 'observation.bootId', 'receipt', 'reconciliation']) assert.ok(labels.includes(key));
  assert.equal('records' in result, false); assert.equal('records' in result.baseline, false); assert.equal('directives' in result.current, false);
  const html = await f.app.inject(compareUrl(baseline.snapshot, base, 'compare')); assert.match(html.body, /Saved baseline/); assert.match(html.body, /Current persisted evidence/); assert.match(html.body, /original outcome unknown/);
  for (const output of [JSON.stringify(result), html.body]) { assert.doesNotMatch(output, /unshared|private-fixture|sudo node|payload_json|csrf/); assert.ok(!output.includes(credential)); }
  const oldAgain = f.reader.packet('alpha', 'one', baseline.snapshot); assert.deepEqual(oldAgain, baseline);
  assert.equal((await get(f.app, baseline.links.comparison)).baseline.snapshot.evaluatedAt, baseline.snapshot.evaluatedAt);
  assert.match((await f.app.inject(`${base}?${snapshotQuery(baseline.snapshot)}`)).body, /Compare this snapshot with current evidence/);
});

test('no-new-record comparison separates frozen freshness, current reevaluation and completed receipt aging without invented collection', async (t) => {
  const f = fixture(t, configuration(), -600_000); const first = f.observe(); f.tick(); const directive = f.request(); f.tick(); const receipt = f.receipt(directive.id, 'completed'); f.tick(); const matched = f.observe('one', releases[1]);
  const baseline = f.reader.packet('alpha', 'one'); assert.equal(baseline.facts.receiptCondition, 'completed');
  const before = counts(f.catalog.db); const result = await get(f.app, compareUrl(baseline.snapshot));
  assert.equal(result.changes.noNewRecords, true); assert.equal(result.changes.addedEvents, 0); assert.equal(result.changes.addedDirectives, 0); assert.equal(result.changes.evidenceChanged, false);
  assert.equal(result.changes.freshnessOnly, true); assert.equal(result.changes.freshnessChanged, true); assert.equal(result.changes.baselineFreshnessChanged, true);
  assert.equal(result.baseline.facts.freshAtEvaluation, true); assert.equal(result.baselineReevaluation.observationFresh, false); assert.equal(result.baselineReevaluation.lastKnownFresh, false); assert.equal(result.current.facts.freshAtEvaluation, false);
  assert.equal(result.baseline.facts.receiptCondition, 'completed'); assert.equal(result.current.facts.receiptCondition, 'completed-unconfirmed'); assert.equal(result.current.facts.executionUnknown, false);
  assert.equal(result.baseline.facts.observation.id, matched.eventId); assert.equal(result.current.facts.observation.id, matched.eventId); assert.equal(result.current.facts.observation.observedAt, matched.observedAt); assert.equal(result.current.facts.receipt.recordedAt, f.runtime.state('one').receipt.recordedAt);
  assert.notEqual(result.current.snapshot.evaluatedAt, result.baseline.snapshot.evaluatedAt); assert.notEqual(result.current.snapshot.evaluatedAt, result.current.facts.observation.observedAt);
  assert.equal(result.current.facts.receipt.id, receipt.eventId); assert.notEqual(first.eventId, matched.eventId);
  const html = await f.app.inject(compareUrl(baseline.snapshot, base, 'compare')); assert.match(html.body, /No new records arrived/); assert.match(html.body, /Freshness and dependent projections changed/); assert.match(html.body, /Saved latest observation fresh at current evaluation: <strong>no/);
  assert.deepEqual(counts(f.catalog.db), before);
});

test('saved observation can age while new current observation is fresh; backfill and periodic records do not imply version/boot changes', (t) => {
  const f = fixture(t, configuration(), -600_000); const old = f.observe(); const baseline = f.reader.packet('alpha', 'one');
  f.tick(600_000); const newer = f.observe('one', releases[0], { bootId: old.bootId });
  const result = f.reader.compare('alpha', 'one', baseline.snapshot);
  assert.equal(result.baseline.facts.freshAtEvaluation, true); assert.equal(result.current.facts.freshAtEvaluation, true); assert.equal(result.baselineReevaluation.observationFresh, false);
  assert.equal(result.changes.baselineFreshnessChanged, true); assert.equal(result.changes.selectedFreshnessChanged, false); assert.equal(result.changes.freshnessOnly, false);
  assert.ok(result.changes.changedFacts.some((change) => change.field === 'baselineObservationFreshNow'));
  assert.equal(result.changes.changedFacts.some((change) => ['observation.version', 'observation.artifactId', 'observation.bootId'].includes(change.field)), false);
  const current = f.reader.packet('alpha', 'one'); f.tick(); f.observe('one', releases[0], { bootId: old.bootId, observedAt: old.observedAt });
  const backfill = f.reader.compare('alpha', 'one', current.snapshot);
  assert.equal(backfill.changes.addedEvents, 1); assert.equal(backfill.changes.evidenceChanged, false); assert.equal(backfill.current.facts.observation.id, newer.eventId);
});

test('eventless directives, completed-unconfirmed and latest unknown nulls remain separate native facts', (t) => {
  const f = fixture(t); f.observe(); const baseline = f.reader.packet('alpha', 'one'); f.tick(); const directive = f.request();
  const requested = f.reader.compare('alpha', 'one', baseline.snapshot); assert.equal(requested.changes.addedDirectives, 1); assert.equal(requested.changes.addedEvents, 0); assert.equal(requested.current.facts.directive.id, directive.id); assert.equal(requested.current.facts.receiptCondition, 'missing');
  f.tick(); f.receipt(directive.id, 'completed'); const completed = f.reader.compare('alpha', 'one', baseline.snapshot); assert.equal(completed.current.facts.receiptCondition, 'completed-unconfirmed'); assert.equal(completed.current.facts.executionUnknown, false);
  f.tick(); f.observe('one', releases[0], { outcome: 'unknown', version: null, artifactId: null, bootId: null });
  const unknown = f.reader.compare('alpha', 'one', baseline.snapshot); assert.equal(unknown.current.facts.observation.outcome, 'unknown'); for (const key of ['version', 'artifactId', 'bootId']) assert.equal(unknown.current.facts.observation[key], null); assert.equal(unknown.current.facts.lastKnown.version, '1.0.0');
});

test('comparison holds one read view when another connection inserts both ledger records between baseline/current projections', (t) => {
  const f = fixture(t); f.observe(); const baseline = f.reader.packet('alpha', 'one'); f.catalog.db.pragma('journal_mode = WAL');
  const writer = openCatalog(f.dbDir); t.after(() => writer.close()); const runtime = new ExternalRuntime(writer.db, f.config, credential, () => new Date(f.at()));
  const packet = f.reader.packet.bind(f.reader); let inserted = false;
  f.reader.packet = (...args) => { const value = packet(...args); if (!inserted) { inserted = true; writer.db.transaction(() => { runtime.createDirective('one', { action: 'deploy', ...releases[1], actor: 'Concurrent fixture actor', rationale: 'Synthetic eventless directive' }); runtime.ingest('one', { schemaVersion: 1, eventId: 'concurrent-comparison', backendId: f.config.backendId, applicationId: 'app-alpha', destinationId: 'one', instanceId: 'instance-one', directiveId: null, kind: 'observation', source: 'Concurrent collector', detail: '', outcome: 'unknown', version: null, artifactId: null, bootId: null, observedAt: f.at() }); })(); } return value; };
  try { const result = f.reader.compare('alpha', 'one', baseline.snapshot); assert.equal(inserted, true); assert.equal(result.changes.noNewRecords, true); assert.equal(result.current.snapshot.eventsThrough, baseline.snapshot.eventsThrough); assert.equal(result.current.snapshot.directivesThrough, baseline.snapshot.directivesThrough); assert.equal(result.current.facts.directive, null); assert.deepEqual(counts(f.catalog.db), [2, 1]); }
  finally { f.reader.packet = packet; }
  const after = f.reader.compare('alpha', 'one', baseline.snapshot); assert.equal(after.changes.addedEvents, 1); assert.equal(after.changes.addedDirectives, 1);
});

test('planned and no-data comparison do not invent runtime evidence; other scopes do not increment current counts', async (t) => {
  const f = fixture(t); const empty = f.reader.packet('alpha', 'one'); const noData = await get(f.app, compareUrl(empty.snapshot)); assert.equal(noData.changes.noNewRecords, true); assert.equal(noData.current.facts.observation, null); assert.equal(noData.baselineReevaluation.observationFresh, null);
  f.observe('two'); const unchanged = f.reader.compare('alpha', 'one', empty.snapshot); assert.equal(unchanged.changes.addedEvents, 0); assert.equal(unchanged.changes.evidenceChanged, false);
  const planned = f.reader.packet('alpha', 'planned'); const result = await get(f.app, compareUrl(planned.snapshot, '/applications/alpha/targets/planned'));
  assert.equal(result.baseline.facts, null); assert.equal(result.current.facts, null); assert.equal(result.changes.noNewRecords, null); assert.equal(result.changes.addedEvents, null); assert.equal(result.changes.addedDirectives, null);
  const html = await f.app.inject(compareUrl(planned.snapshot, '/applications/alpha/targets/planned', 'compare')); assert.match(html.body, /Planned metadata only/); assert.doesNotMatch(html.body, /Current version unknown|Execution outcome unknown|method="post"|csrf|Existing managed controls/);
});

test('both comparison formats reject missing/ambiguous baselines and replacement context, and GET/HEAD never acts or changes counts', async (t) => {
  const f = fixture(t); f.observe(); const baseline = f.reader.packet('alpha', 'one'); const query = snapshotQuery(baseline.snapshot); const before = counts(f.catalog.db); const fetch = globalThis.fetch; globalThis.fetch = () => { throw new Error('Comparison cannot collect'); };
  try {
    for (const method of ['GET', 'HEAD']) for (const format of ['compare', 'comparison.json']) {
      for (const suffix of ['', '?', '?backend=one', `?${query}&q=extra`, `?${query}&before=1`, `?${query}&instance=duplicate`, `?${query}&config=%xx`, `?${query.replace('eventsThrough=1', 'eventsThrough=-1')}`, `?${'x'.repeat(2049)}`]) assert.equal((await f.app.inject({ method, url: `${base}/${format}${suffix}` })).statusCode, 400, suffix);
      assert.equal((await f.app.inject({ method, url: compareUrl(baseline.snapshot, base, format) })).statusCode, 200);
    }
    for (const format of ['compare', 'comparison.json']) assert.equal((await f.app.inject({ method: 'POST', url: compareUrl(baseline.snapshot, base, format) })).statusCode, 405);
    assert.deepEqual(counts(f.catalog.db), before);
  } finally { globalThis.fetch = fetch; }
  const response = await f.app.inject(compareUrl(baseline.snapshot)); assert.equal(response.headers['cache-control'], 'no-store'); assert.equal(response.headers['x-content-type-options'], 'nosniff'); assert.match(response.headers['content-type'], /application\/json/); assert.equal(response.headers['referrer-policy'], 'no-referrer');
  for (const change of [(c) => c.backendId = 'replacement', (c) => c.targets[0].instanceId = 'replacement', (c) => c.targets[0].limitations = 'Changed declaration']) {
    const config = structuredClone(f.config); change(config); const replacement = createApplication(f.dbDir, undefined, { config, token: credential });
    try { for (const format of ['compare', 'comparison.json']) { const reply = await replacement.inject(compareUrl(baseline.snapshot, base, format)); assert.equal(reply.statusCode, 409); assert.match(reply.body, /unavailable/); } } finally { await replacement.close(); }
  }
  assert.equal((await f.app.inject(compareUrl(baseline.snapshot, '/applications/wrong/targets/one'))).statusCode, 404);
});

test('known-credential guard covers all new comparison outputs, including encoded configuration, without changing native facts', async (t) => {
  const f = fixture(t); f.observe('one', releases[0], { bootId: credential }); const baseline = f.reader.packet('alpha', 'one'); assert.equal(f.reader.compare('alpha', 'one', baseline.snapshot).current.facts.observation.bootId, credential);
  for (const method of ['GET', 'HEAD']) for (const format of ['compare', 'comparison.json']) { const reply = await f.app.inject({ method, url: compareUrl(baseline.snapshot, base, format) }); assert.equal(reply.statusCode, 409); assert.ok(!reply.body.includes(credential)); assert.ok(!JSON.stringify(reply.headers).includes(credential)); }
  const secret = 'synthetic/native+opaque=private-comparison'; const config = configuration(); config.targets[0].name = encodeURIComponent(secret).replace('%2F', '%2f'); const g = fixture(t, validateConfig(config), -30_000, secret); const snapshot = g.reader.packet('alpha', 'one').snapshot;
  for (const method of ['GET', 'HEAD']) for (const format of ['compare', 'comparison.json']) { const reply = await g.app.inject({ method, url: compareUrl(snapshot, base, format) }); assert.equal(reply.statusCode, 409); for (const forbidden of [secret, encodeURIComponent(secret), config.targets[0].name]) { assert.ok(!reply.body.includes(forbidden)); assert.ok(!JSON.stringify(reply.headers).includes(forbidden)); } }
});

test('maximum identity manifest compares compact safe summaries within JSON/HTML budgets without copying packet arrays', async (t) => {
  const long = 'x'.repeat(120); const slug = 's'.repeat(160); const config = validateConfig({ schemaVersion: 1, backendId: long, applications: [{ id: long, slug, name: 'Bounded comparison', purpose: 'p'.repeat(500) }], targets: [{ id: long, name: 'Maximal target', applicationId: long, stage: 'QA', instanceId: 'i'.repeat(120), mode: 'managed', limitations: 'l'.repeat(1000), artifacts: releases }] });
  const f = fixture(t, config); const path = `/applications/${slug}/targets/${long}`;
  const insert = f.catalog.db.prepare('INSERT INTO external_events(event_id,backend_id,application_id,destination_id,instance_id,directive_id,kind,source,detail,outcome,version,artifact_id,boot_id,observed_at,started_at,finished_at,recorded_at,payload_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  for (let index = 0; index < 20; index++) insert.run(`e${String(index).padStart(3, '0')}${'x'.repeat(116)}`, long, long, long, 'i'.repeat(120), null, 'observation', 'Withheld fixture', '', 'observed', releases[0].version, releases[0].artifactId, 'b'.repeat(120), f.at(), null, null, f.at(), '{}');
  const insertDirective = f.catalog.db.prepare('INSERT INTO external_directives(id,backend_id,application_id,destination_id,instance_id,action,version,artifact_id,created_at,expected_boot_id,actor,rationale) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
  for (let index = 0; index < 10; index++) insertDirective.run(`d${String(index).padStart(3, '0')}${'x'.repeat(116)}`, long, long, long, 'i'.repeat(120), 'deploy', releases[1].version, releases[1].artifactId, f.at(), null, 'Withheld fixture', 'Withheld explanation');
  const baseline = f.reader.packet(slug, long); assert.equal(baseline.completeness.boundedManifest, true);
  const response = await f.app.inject(compareUrl(baseline.snapshot, path)); assert.equal(response.statusCode, 200, response.body); assert.ok(Buffer.byteLength(response.body) <= PACKET_BUDGET);
  const comparison = response.json(); assert.equal(comparison.baseline.facts.observation.version, '1.0.0'); assert.equal(comparison.current.facts.observation.version, '1.0.0'); assert.equal(comparison.baseline.facts.directive.id.length, 120); assert.equal(comparison.changes.noNewRecords, true); assert.equal('records' in comparison.current, false);
  const html = await f.app.inject(compareUrl(baseline.snapshot, path, 'compare')); assert.equal(html.statusCode, 200); assert.ok(Buffer.byteLength(html.body) < 256 * 1024); assert.match(html.body, /Reported version 1.0.0/); assert.doesNotMatch(html.body, /No observation received|No selected evidence or projection changed.*Current version unknown/);
});
