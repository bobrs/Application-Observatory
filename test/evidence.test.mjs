import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir, hostname } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createApplication } from '../dist/app.js';
import { openCatalog } from '../dist/catalog.js';
import { ExternalRuntime, validateConfig } from '../dist/external-runtime.js';
import { EvidenceReader, evidenceQuery, snapshotQuery, PACKET_BUDGET } from '../dist/evidence.js';

const token = 'synthetic-evidence-collector-private-token';
const artifacts = [{ version: '1.0.0', artifactId: `sha256:${'a'.repeat(64)}` }, { version: '2.0.0', artifactId: `sha256:${'b'.repeat(64)}` }];
const target = (id, mode = 'managed') => ({ id, name: `Target ${id}`, applicationId: 'app-alpha', stage: 'QA', instanceId: `instance-${id}`, mode, artifacts: mode === 'planned' ? [] : artifacts, limitations: 'Synthetic declaration; health and independent Test not evaluated.' });
const config = (targets = [target('one'), target('two'), target('observe', 'observe-only'), target('planned', 'planned')]) => validateConfig({ schemaVersion: 1, backendId: 'fixture-backend', applications: [{ id: 'app-alpha', slug: 'alpha', name: 'Alpha <review>', purpose: 'Synthetic safe handoff fixture' }], targets });
const base = '/applications/alpha/targets/one';
function fixture(t, configuration = config(), credential = token) {
  const directory = mkdtempSync(join(tmpdir(), 'ao-evidence-')); const catalog = openCatalog(join(directory, 'db'));
  const app = createApplication(join(directory, 'db'), undefined, { config: configuration, token: credential });
  let clock = Date.now() - 30_000; let seq = 0;
  const runtime = new ExternalRuntime(catalog.db, configuration, credential, () => new Date(clock));
  const reader = new EvidenceReader(catalog.db, configuration, () => new Date(clock));
  t.after(async () => { await app.close(); catalog.close(); rmSync(directory, { recursive: true, force: true }); });
  const at = () => new Date(clock).toISOString();
  const common = (id, kind, directiveId = null) => { const selected = configuration.targets.find((item) => item.id === id); return { schemaVersion: 1, eventId: `record-${++seq}`, backendId: configuration.backendId, applicationId: selected.applicationId, destinationId: id, instanceId: selected.instanceId, directiveId, kind, source: 'curl https://private.example.invalid/source', detail: 'cat /private/raw.log' }; };
  return { directory, catalog, app, runtime, reader, config: configuration, at, tick: (ms = 1000) => clock += ms,
    observe(id = 'one', outcome = 'observed', release = artifacts[0], extra = {}) { const event = { ...common(id, 'observation'), outcome, observedAt: at(), version: outcome === 'observed' ? release.version : null, artifactId: outcome === 'observed' ? release.artifactId : null, bootId: outcome === 'observed' ? `boot-${seq}` : null, ...extra }; runtime.ingest(id, event); return event; },
    request(id = 'one') { return runtime.createDirective(id, { action: 'deploy', ...artifacts[1], actor: `${token} /private/operator`, rationale: 'Authorization: Bearer should-never-export; sudo node /private/command' }); },
    receipt(directiveId, outcome = 'unknown', id = 'one') { const event = { ...common(id, 'receipt', directiveId), outcome, artifactId: artifacts[1].artifactId, startedAt: at(), finishedAt: at() }; runtime.ingest(id, event); return event; } };
}
const counts = (db) => [db.prepare('SELECT COUNT(*) AS n FROM external_events').get().n, db.prepare('SELECT COUNT(*) AS n FROM external_directives').get().n];
const json = async (app, url) => { const response = await app.inject(url); assert.equal(response.statusCode, 200, response.body); return response.json(); };

test('safe packet keeps unknown nulls, separate receipts, original times and all unsafe text withheld; reads never probe or act', async (t) => {
  const f = fixture(t); const known = f.observe(); const directive = f.request(); f.tick(); const receipt = f.receipt(directive.id); f.tick(); const unknown = f.observe('one', 'unknown');
  const before = counts(f.catalog.db); const fetch = globalThis.fetch; globalThis.fetch = () => { throw new Error('No probes allowed'); };
  try {
    const packet = await json(f.app, `${base}/evidence.json`);
    assert.equal(packet.packetSchema, 'observatory-evidence-v1');
    assert.equal(packet.facts.executionUnknown, true); assert.equal(packet.facts.receiptCondition, 'unknown');
    const record = packet.records.find((row) => row.id === unknown.eventId);
    assert.equal(record.version, null); assert.equal(record.artifactId, null); assert.equal(record.bootId, null); assert.equal(record.observedAt, unknown.observedAt);
    assert.ok(packet.facts.lastKnown.includes(known.eventId)); assert.ok(packet.facts.receipt.includes(receipt.eventId));
    assert.equal(record.collectorSource.availability, 'withheld'); assert.equal(record.verifiedCollector.availability, 'uncollected');
    assert.equal(packet.directives[0].declaredOperator.provenance, 'self-declared, unauthenticated');
    assert.deepEqual(packet.facts.httpStatus, { value: null, availability: 'uncollected' });
    for (const value of [JSON.stringify(packet), (await f.app.inject(base)).body, JSON.stringify(await json(f.app, record.recordRef)), JSON.stringify(await json(f.app, packet.preview.events.first))]) {
      assert.doesNotMatch(value, /private\.example|private\/|should-never-export|sudo node|csrf|payload_json|Authorization: Bearer/); assert.ok(!value.includes(token));
    }
    for (const method of ['GET', 'HEAD']) for (const url of [base, packet.links.snapshot, record.recordRef, packet.preview.directives.first, packet.links.originalLocalArchives.events]) assert.equal((await f.app.inject({ method, url })).statusCode, 200);
    for (const path of [base, `${base}/evidence.json`, record.recordRef]) assert.equal((await f.app.inject({ method: 'POST', url: path })).statusCode, 405);
    assert.deepEqual(counts(f.catalog.db), before);
    const response = await f.app.inject(packet.links.snapshot); assert.equal(response.headers['cache-control'], 'no-store'); assert.equal(response.headers['x-content-type-options'], 'nosniff'); assert.match(response.headers['content-type'], /application\/json/);
    assert.match(response.headers['content-disposition'], /^inline; filename="observatory-one-evidence.json"$/);
    assert.match((await f.app.inject(base)).body, /Existing managed controls/);
    assert.equal(packet.projectionSource.revision?.length, 40); assert.notEqual(packet.projectionSource.revision, '3e5ee4925540c300a9b1ae9bdc267254ea644a7a');
  } finally { globalThis.fetch = fetch; }
});

test('pinned snapshots freeze both ledgers and evaluation, close lookup/record escapes and isolate scope', async (t) => {
  const f = fixture(t); const first = f.observe(); const original = f.reader.packet('alpha', 'one');
  f.tick(600_000); const later = f.observe(); const directive = f.request(); f.tick(); const receipt = f.receipt(directive.id);
  const pinned = f.reader.packet('alpha', 'one', original.snapshot);
  assert.deepEqual(pinned, original); assert.equal(pinned.facts.freshAtEvaluation, true);
  assert.equal(f.reader.packet('alpha', 'one').facts.executionUnknown, true);
  const query = snapshotQuery(original.snapshot);
  for (const path of [`records/events/${later.eventId}`, `records/events/${receipt.eventId}`, `records/directives/${directive.id}`]) assert.equal((await f.app.inject(`${base}/${path}?${query}`)).statusCode, 404);
  assert.equal((await f.app.inject(`${base}/directives?through=0&before=1&lookup=${directive.id}`)).body.includes(directive.id), false);
  const other = f.observe('two');
  assert.equal((await f.app.inject(`${base}/records/events/${other.eventId}`)).statusCode, 404);
  assert.equal((await f.app.inject(`/applications/wrong/targets/one/records/events/${first.eventId}`)).statusCode, 404);
  const safeRecord = await json(f.app, `${base}/records/events/${first.eventId}?${query}`); assert.equal(safeRecord.record.id, first.eventId);
  assert.deepEqual((await json(f.app, `${base}/records/directives?${query}`)).records, []);
});

test('read transaction excludes a competing writer inserting both event and eventless directive between cutoff SELECTs', (t) => {
  const f = fixture(t); f.observe();
  f.catalog.db.pragma('journal_mode = WAL');
  const writer = openCatalog(join(f.directory, 'db')); t.after(() => writer.close());
  const writerRuntime = new ExternalRuntime(writer.db, f.config, token, () => new Date(f.at()));
  const originalPrepare = f.catalog.db.prepare.bind(f.catalog.db); let inserted = false;
  f.catalog.db.prepare = (sql) => {
    const statement = originalPrepare(sql);
    if (!inserted && sql.includes('MAX(seq)')) {
      const get = statement.get.bind(statement);
      statement.get = (...args) => {
        const value = get(...args); inserted = true;
        writer.db.transaction(() => {
          writerRuntime.createDirective('one', { action: 'deploy', ...artifacts[1], actor: 'Concurrent operator', rationale: 'Synthetic concurrent insertion' });
          writerRuntime.ingest('one', { schemaVersion: 1, eventId: 'concurrent-event', backendId: f.config.backendId, applicationId: 'app-alpha', destinationId: 'one', instanceId: 'instance-one', directiveId: null, kind: 'observation', source: 'Concurrent collector', detail: '', outcome: 'unknown', version: null, artifactId: null, bootId: null, observedAt: f.at() });
        })();
        return value;
      };
    }
    return statement;
  };
  try {
    const packet = f.reader.packet('alpha', 'one');
    assert.equal(inserted, true); assert.equal(packet.snapshot.eventsThrough, 1); assert.equal(packet.snapshot.directivesThrough, 0);
    assert.equal(packet.facts.directive, null); assert.equal(packet.records.some((record) => record.id === 'concurrent-event'), false);
    assert.deepEqual(counts(f.catalog.db), [2, 1]);
  } finally { f.catalog.db.prepare = originalPrepare; }
});

test('configuration fingerprint covers full normalized context; missing/replaced context and bad descriptors fail explicitly', async (t) => {
  const f = fixture(t); f.observe(); const packet = f.reader.packet('alpha', 'one');
  for (const change of [
    (value) => value.backendId = 'replacement', (value) => value.applications[0].purpose = 'Changed purpose',
    (value) => value.targets[0].stage = 'Demo', (value) => value.targets[0].limitations = 'Changed limitation',
    (value) => value.targets[0].instanceId = 'replacement', (value) => value.targets[0].mode = 'observe-only',
    (value) => value.targets[0].artifacts[0].artifactId = `sha256:${'c'.repeat(64)}`,
  ]) {
    const value = structuredClone(f.config); change(value); const reader = new EvidenceReader(f.catalog.db, validateConfig(value));
    assert.throws(() => reader.packet('alpha', 'one', packet.snapshot), /configuration or scope changed/);
  }
  const reordered = structuredClone(f.config); reordered.targets[0].artifacts.reverse();
  assert.equal(new EvidenceReader(f.catalog.db, reordered).packet('alpha', 'one', packet.snapshot).snapshot.config, packet.snapshot.config);
  assert.throws(() => new EvidenceReader(f.catalog.db, config([target('two')])).packet('alpha', 'one', packet.snapshot), /configuration is missing/);
  const query = snapshotQuery(packet.snapshot);
  for (const bad of ['backend=x', `${query}&extra=1`, `${query}&config=${packet.snapshot.config}`, `${query}&before=1`, query.replace('eventsThrough=1', 'eventsThrough=-1'), query.replace('eventsThrough=1', 'eventsThrough=9007199254740992'), query.replace('evaluatedAt=', 'evaluatedAt=%00'), `${query}%xx`, 'x'.repeat(2049)]) {
    assert.equal((await f.app.inject(`${base}/evidence.json?${bad}`)).statusCode, 400, bad);
  }
  assert.equal((await f.app.inject(`${base}/evidence.json?${query.replace('observatory-projection-v1', 'future-v99')}`)).statusCode, 409);
  assert.equal((await f.app.inject(`${base}/evidence.json?${query.replace('eventsThrough=1', 'eventsThrough=2')}`)).statusCode, 409);
  for (const before of ['0', '3', '9007199254740992']) assert.equal((await f.app.inject(`${base}/records/events?${query}&before=${before}`)).statusCode, 400);
  assert.throws(() => evidenceQuery(`${base}?${query}&eventsThrough=1`), /repeated/);
  f.catalog.db.prepare('DELETE FROM external_events').run();
  assert.equal((await f.app.inject(packet.links.snapshot)).statusCode, 409);
});

test('original continuation witnesses survive later matching reads, stale contradiction remains separate, and planned replacement has metadata only', async (t) => {
  const f = fixture(t); f.observe(); const directive = f.request(); f.tick(); const receipt = f.receipt(directive.id); f.tick(); const witness = f.observe('one', 'observed', artifacts[1]);
  const reconciliation = f.runtime.reconcile('one', { directiveId: directive.id, actor: 'Unsafe /private/actor', rationale: 'Unsafe command: sudo action' });
  for (let index = 0; index < 24; index++) { f.tick(); f.observe('one', 'observed', artifacts[1], { bootId: witness.bootId }); }
  const packet = f.reader.packet('alpha', 'one');
  assert.equal(packet.facts.executionUnknown, true); assert.equal(packet.facts.reconciled, true);
  assert.ok(packet.facts.witness.includes(witness.eventId)); assert.ok(packet.facts.witnessReceipt.includes(receipt.eventId));
  const receiptRecord = packet.records.find((record) => record.id === receipt.eventId);
  assert.ok(receiptRecord.directiveRef.value.includes('directivesThrough='));
  assert.equal((await json(f.app, receiptRecord.directiveRef.value)).record.id, directive.id);
  const decisionRecord = packet.records.find((record) => record.id === reconciliation.eventId);
  assert.equal((await json(f.app, decisionRecord.witnessRef.value)).record.id, witness.eventId);
  assert.ok(packet.records.some((row) => row.id === witness.eventId)); assert.ok(packet.records.some((row) => row.id === reconciliation.eventId));
  assert.notEqual(packet.facts.observation, packet.facts.witness);
  assert.equal(packet.records.filter((record) => record.id === witness.eventId).length, 1);
  const changed = structuredClone(f.config); changed.targets[0] = { ...changed.targets[0], mode: 'planned', artifacts: [] };
  const planned = new EvidenceReader(f.catalog.db, validateConfig(changed)).packet('alpha', 'one');
  assert.equal(planned.facts, null); assert.deepEqual(planned.records, []); assert.deepEqual(planned.directives, []); assert.equal(planned.preview.events, null);
  for (const id of ['observe', 'planned']) { const page = await f.app.inject(`/applications/alpha/targets/${id}`); assert.equal(page.statusCode, 200); assert.doesNotMatch(page.body, /Existing managed controls|method="post"|csrf/); }
  // The ordinary managed state remains the gate authority; the read projection matches it.
  for (const key of ['fresh', 'executionUnknown', 'unresolved', 'contradictory', 'reconciled']) assert.equal(key === 'fresh' ? packet.facts.freshAtEvaluation : packet.facts[key], f.runtime.state('one')[key]);
  const f2 = fixture(t); f2.observe(); const d2 = f2.request(); f2.tick(); f2.receipt(d2.id, 'completed'); f2.tick(); f2.observe('one', 'observed', artifacts[0]); f2.tick(600_000);
  const contradiction = f2.reader.packet('alpha', 'one'); assert.equal(contradiction.facts.contradictory, true); assert.equal(contradiction.facts.freshAtEvaluation, false); assert.equal(contradiction.facts.receiptCondition, 'completed-unconfirmed');
  f.catalog.db.prepare('DELETE FROM external_events WHERE event_id=?').run(witness.eventId);
  assert.throws(() => f.reader.packet('alpha', 'one', packet.snapshot), /retained reconciliation witness is missing/);
});

test('bounded safe pages traverse retained records exactly once and pinned cross-ledger references never widen scope', async (t) => {
  const f = fixture(t); for (let index = 0; index < 63; index++) { f.observe(index % 5 ? 'one' : 'two'); f.tick(); }
  // Eventless directives are retained and paged independently of events.
  const insert = f.catalog.db.prepare('INSERT INTO external_directives(id,backend_id,application_id,destination_id,instance_id,action,version,artifact_id,created_at,expected_boot_id,actor,rationale) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
  for (let index = 0; index < 27; index++) insert.run(`eventless-${index}`, f.config.backendId, 'app-alpha', 'one', 'instance-one', 'deploy', artifacts[0].version, artifacts[0].artifactId, f.at(), null, 'Unsafe actor', 'Unsafe rationale');
  const packet = f.reader.packet('alpha', 'one');
  for (const kind of ['events', 'directives']) {
    let url = packet.preview[kind].first; const ids = [];
    while (url) { const page = await json(f.app, url); assert.ok(page.records.length <= (kind === 'events' ? 20 : 10)); ids.push(...page.records.map((row) => row.id)); url = page.next; }
    assert.equal(ids.length, packet.preview[kind].total); assert.equal(new Set(ids).size, ids.length);
  }
  assert.equal(packet.preview.directives.total, 27); assert.equal(packet.directives.length, 10); assert.equal(packet.preview.directives.previewTruncated, true);
  assert.equal(packet.links.originalLocalArchives.scope.includes('across retained'), true);
  const correlated = packet.records.find((record) => record.directiveId);
  if (correlated) assert.ok(correlated.directiveRef.value.includes('directivesThrough='));
});

test('large mixed-scope history stays bounded with measured cold and warm responses; overflow has an explicit safe manifest', async (t) => {
  const configuration = config(Array.from({ length: 20 }, (_, index) => target(index ? `target-${index}` : 'one')));
  const f = fixture(t, configuration); f.observe();
  const measure = async () => {
    const start = performance.now(); const cold = await f.app.inject(`${base}/evidence.json`); const coldMs = performance.now() - start; const samples = [];
    for (let index = 0; index < 10; index++) { const at = performance.now(); assert.equal((await f.app.inject(`${base}/evidence.json`)).statusCode, 200); samples.push(performance.now() - at); }
    samples.sort((a, b) => a - b); return { coldMs, medianMs: samples[5], p95Ms: samples[9], bytes: Buffer.byteLength(cold.body) };
  };
  const baseline = await measure();
  const row = f.catalog.db.prepare('SELECT * FROM external_events LIMIT 1').get();
  const insert = f.catalog.db.prepare('INSERT INTO external_events(event_id,backend_id,application_id,destination_id,instance_id,directive_id,kind,source,detail,outcome,version,artifact_id,boot_id,observed_at,started_at,finished_at,recorded_at,payload_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  f.catalog.db.transaction(() => {
    for (let index = 0; index < 10_000; index++) { const id = `large-${index}`; const selected = configuration.targets[index % 20]; const payload = { ...JSON.parse(row.payload_json), eventId: id, destinationId: selected.id, instanceId: index % 3 ? selected.instanceId : 'old-incarnation' };
      insert.run(id, row.backend_id, row.application_id, selected.id, payload.instanceId, null, row.kind, row.source, row.detail, row.outcome, row.version, row.artifact_id, row.boot_id, row.observed_at, null, null, row.recorded_at, JSON.stringify(payload)); }
  })();
  const populated = await measure(); const packet = await json(f.app, `${base}/evidence.json`); const html = await f.app.inject(base);
  assert.ok(populated.bytes <= PACKET_BUDGET); assert.ok(Buffer.byteLength(html.body) <= 256 * 1024); assert.ok(packet.records.length <= 26);
  t.diagnostic(JSON.stringify({ runtime: process.version, machine: `${hostname()} ${process.platform}/${process.arch}`, fixture: '20 targets; 10001 observations mixed current/old incarnations; one cold and 10 warm packet renders', baseline, populated, htmlBytes: Buffer.byteLength(html.body) }));
  // Maximal legitimate IDs amplify repeated relative links. The explicit manifest must
  // retain all fact refs and safe page continuation rather than silently trim a witness.
  const long = 'x'.repeat(120); const longConfig = validateConfig({ schemaVersion: 1, backendId: long, applications: [{ id: long, slug: long, name: 'Long bounded fixture', purpose: 'Packet budget measurement' }], targets: [{ ...target(long), name: 'Long bounded target', applicationId: long, instanceId: 'i'.repeat(120) }] });
  const g = fixture(t, longConfig); const sql = g.catalog.db.prepare('INSERT INTO external_events(event_id,backend_id,application_id,destination_id,instance_id,directive_id,kind,source,detail,outcome,version,artifact_id,boot_id,observed_at,started_at,finished_at,recorded_at,payload_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  for (let index = 0; index < 20; index++) sql.run(`e${String(index).padStart(3, '0')}${'x'.repeat(116)}`, long, long, long, 'i'.repeat(120), null, 'observation', 'Not exported', '', 'observed', artifacts[0].version, artifacts[0].artifactId, 'b'.repeat(120), g.at(), null, null, g.at(), '{}');
  const insertLongDirective = g.catalog.db.prepare('INSERT INTO external_directives(id,backend_id,application_id,destination_id,instance_id,action,version,artifact_id,created_at,expected_boot_id,actor,rationale) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
  for (let index = 0; index < 10; index++) insertLongDirective.run(`d${String(index).padStart(3, '0')}${'x'.repeat(116)}`, long, long, long, 'i'.repeat(120), 'deploy', artifacts[0].version, artifacts[0].artifactId, g.at(), null, 'Withheld actor', 'Withheld explanation');
  const large = await json(g.app, `/applications/${long}/targets/${long}/evidence.json`);
  assert.throws(() => g.reader.context('x'.repeat(161), long), /bounded read-link limit/); assert.ok(Buffer.byteLength(JSON.stringify(large)) <= PACKET_BUDGET);
  assert.equal(large.completeness.boundedManifest, true, 'Maximum bounded IDs must exercise the overflow branch');
  assert.equal(large.facts.freshAtEvaluation, true);
  const manifestHtml = await g.app.inject(`/applications/${long}/targets/${long}`);
  assert.equal(manifestHtml.statusCode, 200);
  assert.match(manifestHtml.body, /Reported version 1.0.0/);
  assert.match(manifestHtml.body, /Fresh at this evaluation/);
  assert.match(manifestHtml.body, /Inline consequential records omitted by the packet budget/);
  assert.match(manifestHtml.body, /Packet size budget exceeded/);
  assert.ok(manifestHtml.body.includes(g.at()));
  assert.doesNotMatch(manifestHtml.body, /Current version unknown|No observation received in this exact current scope|No successful current read established|No consequential records in the bounded preview/);
  const unknownAt = new Date(Date.parse(g.at()) + 1000).toISOString();
  sql.run(`u${'x'.repeat(119)}`, long, long, long, 'i'.repeat(120), null, 'observation', 'Withheld collector', '', 'unknown', null, null, null, unknownAt, null, null, g.at(), '{}');
  const unknownManifest = await json(g.app, `/applications/${long}/targets/${long}/evidence.json`);
  assert.equal(unknownManifest.completeness.boundedManifest, true);
  assert.equal(unknownManifest.facts.observationSummary.outcome, 'unknown');
  assert.equal(unknownManifest.facts.observationSummary.version, null);
  const unknownHtml = await g.app.inject(`/applications/${long}/targets/${long}`);
  assert.match(unknownHtml.body, /Latest unknown/);
  assert.match(unknownHtml.body, /Historical last-known version 1.0.0/);
  assert.doesNotMatch(unknownHtml.body, /No observation received in this exact current scope|No consequential records in the bounded preview/);
  if (large.completeness.boundedManifest) { assert.deepEqual(large.records, []); assert.ok(large.facts.observation); assert.ok(large.preview.events.first); assert.match(large.gaps.join(' '), /budget exceeded/); }
});


test('known configured bearer in native IDs or boot identity fails closed on every new GET/HEAD export surface', async (t) => {
  for (const field of ['bootId', 'eventId']) {
    const f = fixture(t); const event = f.observe('one', 'observed', artifacts[0], { [field]: token });
    const packet = f.reader.packet('alpha', 'one'); // The selector remains credential-independent.
    assert.ok(JSON.stringify(packet).includes(token));
    const before = counts(f.catalog.db);
    for (const method of ['GET', 'HEAD']) for (const url of [base, `${base}?${snapshotQuery(packet.snapshot)}`, packet.links.current, packet.links.snapshot, `${base}/records/events/${encodeURIComponent(event.eventId)}`, packet.facts.observation, packet.preview.events.first, `${base}/records/events`]) {
      const response = await f.app.inject({ method, url });
      assert.equal(response.statusCode, 409, `${field} ${method} ${url.split('?')[0]}`);
      assert.ok(!response.body.includes(token)); assert.ok(!JSON.stringify(response.headers).includes(token));
      assert.ok(!response.body.includes(encodeURIComponent(token)));
      if (method === 'GET') assert.match(response.body, /Evidence unavailable/);
    }
    assert.deepEqual(counts(f.catalog.db), before);
  }
  // Directive native identity and its URL reference have the same boundary protection.
  const f = fixture(t); const directive = f.request();
  f.catalog.db.prepare('UPDATE external_directives SET id=? WHERE id=?').run(token, directive.id);
  const packet = f.reader.packet('alpha', 'one');
  for (const method of ['GET', 'HEAD']) for (const url of [base, packet.links.current, packet.links.snapshot, packet.facts.directive, `${base}/records/directives/${token}`, packet.preview.directives.first, `${base}/records/directives`]) {
    const response = await f.app.inject({ method, url }); assert.equal(response.statusCode, 409); assert.ok(!response.body.includes(token)); assert.ok(!JSON.stringify(response.headers).includes(token));
  }
});

test('known credential in configuration metadata is rejected before HTML rendering, including URI encoded forms', async (t) => {
  const credential = 'synthetic/native+opaque=long-private-value';
  for (const value of [credential, encodeURIComponent(credential), encodeURIComponent(credential).toLowerCase(), encodeURIComponent(credential).replace('%2F', '%2f')]) {
    const configuration = config(); configuration.applications[0].name = `Configured ${value}`;
    const f = fixture(t, validateConfig(configuration), credential);
    const packet = f.reader.packet('alpha', 'one'); const before = counts(f.catalog.db);
    for (const method of ['GET', 'HEAD']) for (const url of [base, `${base}?${snapshotQuery(packet.snapshot)}`, packet.links.current, packet.links.snapshot]) {
      const response = await f.app.inject({ method, url }); assert.equal(response.statusCode, 409);
      for (const forbidden of [credential, encodeURIComponent(credential), value]) { assert.ok(!response.body.includes(forbidden)); assert.ok(!JSON.stringify(response.headers).includes(forbidden)); }
    }
    assert.deepEqual(counts(f.catalog.db), before);
  }
});
