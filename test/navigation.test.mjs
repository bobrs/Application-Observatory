import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createApplication } from '../dist/app.js';
import { openCatalog } from '../dist/catalog.js';
import { ExternalRuntime, validateConfig } from '../dist/external-runtime.js';
import { externalApplicationViews } from '../dist/portfolio.js';
import { createExercise } from '../dist/exercise/controller.js';

const token = 'synthetic-navigation-fixture-credential';
const artifacts = [{ version: '1.0.0', artifactId: `sha256:${'a'.repeat(64)}` }, { version: '2.0.0', artifactId: `sha256:${'b'.repeat(64)}` }];
const application = (id, name = id) => ({ id: `app-${id}`, slug: id, name, purpose: 'Synthetic navigation fixture only' });
const target = (id, app = 'alpha', stage = 'QA', mode = 'managed') => ({ id, name: `Placement ${id}`, applicationId: `app-${app}`, stage, instanceId: `instance-${id}`, mode,
  artifacts: mode === 'planned' ? [] : artifacts, limitations: 'Synthetic configuration declaration, not operational acceptance.' });
const configuration = (targets = [target('qa-one'), target('qa-two'), target('demo-planned', 'beta', 'Demo', 'planned')]) => validateConfig({ schemaVersion: 1, backendId: 'fixture-backend',
  applications: [application('alpha', 'Alpha & friends'), application('beta', 'Beta <review>'), application('empty', 'Unplaced app')], targets });
function fixture(t, config = configuration()) {
  const directory = mkdtempSync(join(tmpdir(), 'ao-navigation-'));
  const catalog = openCatalog(join(directory, 'db'));
  const app = createApplication(join(directory, 'db'), undefined, { config, token });
  t.after(async () => { await app.close(); catalog.close(); rmSync(directory, { recursive: true, force: true }); });
  let clock = Date.now() - 20_000;
  const runtime = new ExternalRuntime(catalog.db, config, token, () => new Date(clock));
  let sequence = 0;
  const at = () => new Date(clock).toISOString();
  const common = (id, kind, directiveId = null) => { const selected = config.targets.find((value) => value.id === id); return { schemaVersion: 1, eventId: `fixture-${++sequence}`, backendId: config.backendId,
    applicationId: selected.applicationId, destinationId: id, instanceId: selected.instanceId, directiveId, kind, source: kind === 'receipt' ? 'Fixture operation reporter' : 'Fixture collector <unverified>', detail: 'Synthetic evidence only' }; };
  return { app, catalog, runtime, config, at, setClock: (value) => { clock = value; }, tick: (ms = 1000) => { clock += ms; },
    observe: (id, outcome = 'observed', release = artifacts[0], extra = {}) => runtime.ingest(id, { ...common(id, 'observation'), outcome, observedAt: at(), version: outcome === 'observed' ? release.version : null,
      artifactId: outcome === 'observed' ? release.artifactId : null, bootId: outcome === 'observed' ? `boot-${sequence}` : null, ...extra }),
    request: (id, actor = 'Declared Operator') => runtime.createDirective(id, { action: 'deploy', ...artifacts[1], actor, rationale: 'Synthetic request only' }),
    receipt: (id, directiveId, outcome = 'completed') => runtime.ingest(id, { ...common(id, 'receipt', directiveId), outcome, artifactId: artifacts[1].artifactId, startedAt: at(), finishedAt: at() }) };
}
function counts(db) {
  return Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(({ name }) => [name, db.prepare(`SELECT count(*) AS n FROM "${name}"`).get().n]));
}
const card = (body, id) => body.match(new RegExp(`<article class="placement" data-placement="${id}">([\\s\\S]*?)</article>`))?.[1] ?? '';
const placements = (body) => [...body.matchAll(/data-placement="([^"]+)"/g)].map((match) => match[1]);

test('navigation groups configured QA/Demo placements, counts duplicate stages once and preserves useful filters across both views', async (t) => {
  const f = fixture(t, configuration([target('qa-one'), target('qa-two'), target('beta-qa', 'beta', 'QA', 'observe-only'), target('demo-planned', 'beta', 'Demo', 'planned')]));
  const collectionAt = new Date(Date.now() - 90_000).toISOString();
  f.observe('qa-one', 'observed', artifacts[0], { observedAt: collectionAt });
  const recordedAt = f.runtime.state('qa-one').observation.recordedAt;
  const overview = await f.app.inject('/environments');
  assert.equal(overview.statusCode, 200);
  assert.notEqual(collectionAt, recordedAt);
  for (const value of [collectionAt, recordedAt]) assert.ok(card(overview.body, 'qa-one').includes(`datetime="${value}"`));
  assert.match(overview.body, /href="\/environments" aria-current="page"/);
  assert.equal((overview.body.match(/data-stage="QA"/g) ?? []).length, 1);
  assert.match(overview.body, /3 matching placements of 3 configured · 2 matching applications/);
  assert.match(overview.body, /4 matching placements of 4 configured · 4 matching applications of 4 known/);
  assert.match(overview.body, /Applications without placements/);
  assert.match(overview.body, /Unplaced app/);
  assert.match(card(overview.body, 'qa-one'), /href="\/applications\/alpha\/targets\/qa-one"/);
  assert.match(card(overview.body, 'demo-planned'), /Configured only/);
  assert.match(card(overview.body, 'demo-planned'), /\/applications\/beta\/targets\/demo-planned\/history/);
  assert.doesNotMatch(overview.body, /<script|name="csrf"|<form[^>]+method="post"|href="https?:/);
  const selected = await f.app.inject('/environments?application=beta&stage=QA&mode=observe-only&evidence=no-observation&q=Placement');
  assert.deepEqual(placements(selected.body), ['beta-qa']);
  assert.match(selected.body, /1 matching placements of 4 configured · 1 matching applications of 4 known/);
  assert.match(selected.body, /value="QA" selected/); assert.match(selected.body, /value="observe-only" selected/);
  const portfolioLink = selected.body.match(/href="(\/\?[^\"]+)"[^>]*>View matching applications/)[1].replaceAll('&amp;', '&');
  const portfolio = await f.app.inject(portfolioLink);
  assert.equal(portfolio.statusCode, 200);
  assert.match(portfolio.body, /href="\/\?[^\"]+" aria-current="page">Applications/);
  assert.deepEqual([...portfolio.body.matchAll(/data-application="([^"]+)"/g)].map((value) => value[1]), ['beta']);
  assert.match(portfolio.body, /1 matching placements of 4 configured/);
  assert.deepEqual(placements((await f.app.inject('/environments?q=Alpha')).body), ['qa-one', 'qa-two']);
  assert.deepEqual(placements((await f.app.inject('/environments?q=qa-two')).body), ['qa-two']);
  assert.match((await f.app.inject('/environments?q=not-present')).body, /No matching results/);
  assert.match((await f.app.inject('/?q=not-present')).body, /No matching results/);
  assert.deepEqual(placements((await f.app.inject('/environments?evidence=observed')).body), ['qa-one']);
  assert.deepEqual(placements((await f.app.inject('/environments?mode=planned')).body), ['demo-planned']);
});

test('GET/HEAD query validation rejects ambiguous or oversized selectors and every read leaves all database row counts unchanged', async (t) => {
  const f = fixture(t); f.observe('qa-one');
  const before = counts(f.catalog.db);
  const queries = ['unexpected=x', 'stage=QA&stage=Demo', 'q=one&q=two', 'application=alpha&application=beta', 'mode=managed&mode=planned', 'evidence=observed&evidence=stale',
    'q[]=Alpha', 'stage[0]=QA', 'stage=Production', 'stage=qa', 'application=app-alpha', 'application=missing', 'mode=administrator', 'evidence=healthy',
    'q=%00', 'q=%0A', 'q=%FF', 'q=%xx', `q=${'x'.repeat(121)}`, `stage=${'x'.repeat(161)}`, `q=${'x'.repeat(1025)}`];
  const fetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Read navigation must never collect a network observation'); };
  try {
    for (const method of ['GET', 'HEAD']) for (const path of ['/', '/environments']) {
      for (const query of queries) {
        const response = await f.app.inject({ method, url: `${path}?${query}` });
        assert.equal(response.statusCode, 400, `${method} ${path} ${query.slice(0, 100)}`);
        if (method === 'HEAD') assert.equal(response.body, '');
        else assert.match(response.body, /Invalid filters/);
      }
      for (const query of ['', '?q=&application=&stage=&evidence=&mode=', '?q=Alpha', '?stage=QA', '?mode=managed', '?evidence=unknown', '?q=nothing']) {
        const response = await f.app.inject({ method, url: `${path}${query}` });
        assert.equal(response.statusCode, 200);
        if (method === 'HEAD') assert.equal(response.body, '');
        assert.equal(response.headers['cache-control'], 'no-store');
        assert.equal(response.headers['x-content-type-options'], 'nosniff');
      }
    }
    assert.equal((await f.app.inject({ method: 'POST', url: '/environments' })).statusCode, 405);
    assert.equal((await f.app.inject({ method: 'PUT', url: '/' })).statusCode, 405);
    assert.equal((await f.app.inject({ url: '/environments', headers: { host: 'external.example' } })).statusCode, 403);
  } finally { globalThis.fetch = fetch; }
  assert.deepEqual(counts(f.catalog.db), before);
});

test('zero-target configurations and normal mode display real absence without fabricating stages, capabilities or sources', async (t) => {
  const f = fixture(t, configuration([]));
  for (const url of ['/', '/environments']) {
    const response = await f.app.inject(url);
    assert.equal(response.statusCode, 200); assert.match(response.body, /0 matching placements of 0 configured/);
    assert.deepEqual(placements(response.body), []);
  }
  assert.equal((await f.app.inject('/environments?stage=QA')).statusCode, 400);
  const directory = mkdtempSync(join(tmpdir(), 'ao-navigation-normal-'));
  const app = createApplication(join(directory, 'db'));
  t.after(async () => { await app.close(); rmSync(directory, { recursive: true, force: true }); });
  const normal = await app.inject('/environments');
  assert.match(normal.body, /0 matching placements of 0 configured · 2 matching applications of 2 known/);
  assert.doesNotMatch(normal.body, /data-placement=|data-stage=|Fixture collector/);
  assert.match(normal.body, /No concrete destinations connected/);
});

test('unknown collection timestamps survive projection; stale contradictions stay historical on overview, application and portfolio', async (t) => {
  const f = fixture(t, configuration([target('contradiction'), target('unknown')]));
  f.setClock(Date.now() - 800_000);
  const directive = f.request('contradiction'); f.tick(); f.receipt('contradiction', directive.id); f.tick();
  f.observe('contradiction'); // Wrong artifact after completed receipt, now stale.
  f.observe('unknown'); f.tick(); const unknownAt = f.at(); f.observe('unknown', 'unknown');
  f.setClock(Date.now());
  const views = externalApplicationViews(f.runtime)[0].destinations;
  const mismatch = views.find((value) => value.id === 'contradiction');
  const unknown = views.find((value) => value.id === 'unknown');
  assert.equal(mismatch.state, 'Exception'); assert.equal(mismatch.observation, null);
  assert.equal(mismatch.externalSummary.contradictory, true); assert.equal(mismatch.externalSummary.fresh, false);
  assert.equal(mismatch.lastKnown.version, '1.0.0'); assert.doesNotMatch(mismatch.explanation, /Fresh/);
  assert.equal(unknown.latestObservation.observedAt, unknownAt);
  assert.equal(unknown.latestObservation.outcome, 'unknown'); assert.equal(unknown.observation, null);
  assert.equal(unknown.externalSummary.observation.observedAt, unknownAt);
  for (const url of ['/', '/applications/alpha', '/environments']) {
    const response = await f.app.inject(url); assert.equal(response.statusCode, 200, url);
    assert.doesNotMatch(response.body, /Fresh external evidence/);
    assert.doesNotMatch(response.body, /class="version-number">1\.0\.0/);
    if (url === '/') assert.match(response.body, /0 observed versions/);
  }
  const overview = (await f.app.inject('/environments')).body;
  assert.match(card(overview, 'contradiction'), /Current version unknown/);
  assert.match(card(overview, 'contradiction'), /Historical last-known version/);
  assert.match(card(overview, 'contradiction'), /Historical successful reported \/version collection/);
  assert.doesNotMatch(card(overview, 'contradiction'), /Fresh/);
  assert.match(card(overview, 'unknown'), new RegExp(`datetime="${unknownAt}"`));
  assert.match(card(overview, 'unknown'), /No successful current version read established/);
  assert.doesNotMatch(card(overview, 'unknown'), /HTTP (?:failed|200)|0ms/);
  assert.deepEqual(placements((await f.app.inject('/environments?evidence=unknown')).body), ['unknown']);
  assert.deepEqual(placements((await f.app.inject('/environments?evidence=stale')).body), ['contradiction']);
  assert.deepEqual(placements((await f.app.inject('/environments?evidence=contradiction')).body), ['contradiction']);
});

test('receipt absence, explicit unknown, completion without read-back and failure remain distinct; matching reads and reconciliation preserve original uncertainty', async (t) => {
  const f = fixture(t, configuration(['missing', 'unknown', 'unconfirmed', 'confirmed', 'failed'].map((id) => target(id))));
  const directives = {};
  for (const id of ['missing', 'unknown', 'unconfirmed', 'confirmed', 'failed']) directives[id] = f.request(id, 'Operator <claimed>');
  f.tick();
  f.receipt('unknown', directives.unknown.id, 'unknown');
  f.receipt('unconfirmed', directives.unconfirmed.id);
  f.receipt('confirmed', directives.confirmed.id);
  f.receipt('failed', directives.failed.id, 'failed');
  f.tick();
  for (const id of ['missing', 'unknown', 'confirmed', 'failed']) f.observe(id, 'observed', artifacts[1]);
  f.tick();
  f.runtime.reconcile('unknown', { directiveId: directives.unknown.id, actor: 'Continuation reviewer', rationale: 'Accept observed version, original result remains unknown' });
  const state = f.runtime.state('unknown');
  assert.equal(state.reconciled, true); assert.equal(state.executionUnknown, true); assert.equal(state.receipt.outcome, 'unknown');
  const overview = (await f.app.inject('/environments')).body;
  assert.match(card(overview, 'missing'), /Result not received/); assert.doesNotMatch(card(overview, 'missing'), /execution started|execution failed|Receipt outcome unknown/i);
  assert.match(card(overview, 'unknown'), /Receipt outcome unknown/); assert.match(card(overview, 'unknown'), /Current witnessed acknowledgment/);
  assert.match(card(overview, 'unconfirmed'), /Completed receipt; running version unconfirmed/);
  assert.doesNotMatch(card(overview, 'unconfirmed'), /[Ee]xecution outcome unknown/);
  assert.match(card(overview, 'confirmed'), /matching fresh version read-back/);
  assert.match(card(overview, 'failed'), /Failed receipt; running version is separate/);
  assert.match(card(overview, 'unknown'), /Operator &lt;claimed&gt; \(self-declared, unauthenticated\)/);
  assert.match(card(overview, 'unknown'), /Reported source: Fixture operation reporter/);
  assert.match(card(overview, 'unknown'), /Reported collector\/source: Fixture collector &lt;unverified&gt;/);
  assert.match(card(overview, 'unknown'), new RegExp(`datetime="${directives.unknown.createdAt}"`));
  assert.match(overview, /Commit author, trigger initiator, deployer and authenticated human: unknown \/ uncollected/);
  for (const [condition, id] of [['missing-receipt', 'missing'], ['unknown-receipt', 'unknown'], ['unconfirmed', 'unconfirmed'], ['failed-receipt', 'failed']]) {
    assert.deepEqual(placements((await f.app.inject(`/environments?evidence=${condition}`)).body), [id]);
  }
  const portfolio = (await f.app.inject('/')).body;
  assert.match(portfolio, /1 completed receipt; version unconfirmed/); assert.match(portfolio, /1 result not received/); assert.match(portfolio, /1 receipt outcome unknown/);
  assert.match((await f.app.inject('/applications/alpha')).body, /Completed receipt; running version unconfirmed/);
});

test('overview separates current backend/incarnation from logical archives, including planned replacement and escaped input', async (t) => {
  const f = fixture(t); f.observe('qa-one'); f.request('qa-one');
  const original = card((await f.app.inject('/environments')).body, 'qa-one');
  assert.match(original, /backend fixture-backend · app app-alpha · target qa-one · incarnation instance-qa-one/);
  assert.match(original, /Result not received/);
  for (const replacement of [
    { ...f.config, backendId: 'replacement-backend' },
    { ...f.config, targets: f.config.targets.map((value) => value.id === 'qa-one' ? { ...value, instanceId: 'replacement-incarnation' } : value) },
    { ...f.config, targets: f.config.targets.map((value) => value.id === 'qa-one' ? { ...value, mode: 'planned', artifacts: [] } : value) },
  ]) {
    const changed = createApplication(join(f.catalog.db.name, '..'), undefined, { config: validateConfig(replacement), token });
    try {
      const body = (await changed.inject('/environments')).body;
      const current = card(body, 'qa-one'); assert.doesNotMatch(current, /Result not received|Fixture collector|1\.0\.0/);
      assert.match(current, /Current version unknown|Configured only/);
      const archive = await changed.inject('/applications/alpha/targets/qa-one/history');
      assert.equal(archive.statusCode, 200); assert.match(archive.body, /fixture-backend/); assert.match(archive.body, /instance-qa-one/);
      assert.equal((await changed.inject('/applications/beta/targets/qa-one/history')).statusCode, 404);
    } finally { await changed.close(); }
  }
  const q = '\"><script>fixture</script>&?';
  const escaped = (await f.app.inject(`/environments?q=${encodeURIComponent(q)}`)).body;
  assert.doesNotMatch(escaped, /<script>/); assert.match(escaped, /&quot;&gt;&lt;script&gt;/); assert.match(escaped, /value="[^\"]*&amp;\?"/);
  assert.match(escaped, /q=%22%3E%3Cscript%3Efixture%3C%2Fscript%3E%26%3F/);
});

test('local reference navigation keeps its own capability, evidence anchors and read-only GET behavior', async (t) => {
  const exercise = await createExercise(undefined, undefined, true);
  const app = createApplication(exercise.workspace.directory, exercise);
  t.after(async () => { await app.close(); rmSync(exercise.workspace.directory, { recursive: true, force: true }); });
  const before = counts(exercise.db);
  const overview = await app.inject('/environments');
  assert.equal(overview.statusCode, 200); assert.equal(placements(overview.body).length, 3);
  assert.match(overview.body, /href="\/applications\/hello-observatory#destination-test-reference"/);
  assert.match(card(overview.body, 'test-reference'), /local-reference · local disposable fixture/);
  assert.match(card(overview.body, 'production-reference'), /NOT REAL PRODUCTION/);
  assert.deepEqual(placements((await app.inject('/environments?mode=managed')).body), []);
  assert.equal(placements((await app.inject('/environments?mode=local-reference')).body).length, 3);
  await app.inject({ method: 'HEAD', url: '/environments?stage=Test' });
  assert.deepEqual(counts(exercise.db), before); assert.equal(exercise.latestObservation('test-reference'), null);
  await exercise.observe('test-reference');
  const request = exercise.createRequest('1.2.0', 'test-reference', 'normal');
  exercise.decide(request.id, 'authorize', 'Local fixture actor', 'Local fixture role', 'Only this fixture', true);
  const local = card((await app.inject('/environments')).body, 'test-reference');
  assert.match(local, /Fresh successful reported \/version collection/);
  assert.match(local, /Local fixture actor \(self-declared, unauthenticated\)/);
  assert.match(local, new RegExp(`datetime="${request.createdAt}"`));
  assert.match(local, /Not dispatched; no execution result expected/);
});

test('20-target overview is bounded independently of a 10000-row mixed-scope ledger', async (t) => {
  const f = fixture(t, configuration(Array.from({ length: 20 }, (_, i) => target(`target-${i}`, i % 2 ? 'beta' : 'alpha', i % 3 ? 'QA' : 'Demo', 'observe-only'))));
  for (const selected of f.config.targets) f.observe(selected.id);
  const sample = async () => {
    const durations = []; let body;
    for (let i = 0; i < 11; i++) { const start = performance.now(); const response = await f.app.inject('/environments'); durations.push(performance.now() - start); assert.equal(response.statusCode, 200); body = response.body; }
    return { coldMs: durations[0], medianMs: durations.slice(1).sort((a, b) => a - b)[4], p95Ms: durations.slice(1).sort((a, b) => a - b)[9], bytes: Buffer.byteLength(body), body };
  };
  const baseline = await sample();
  const insert = f.catalog.db.prepare(`INSERT INTO external_events (event_id,backend_id,application_id,destination_id,instance_id,directive_id,kind,source,detail,outcome,version,artifact_id,boot_id,observed_at,started_at,finished_at,recorded_at,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const historicalAt = new Date(Date.now() - 900_000).toISOString();
  f.catalog.db.transaction(() => {
    for (let i = 0; i < 10_000; i++) {
      const selected = f.config.targets[i % 20];
      const event = { schemaVersion: 1, eventId: `old-observation-${i}`, backendId: i % 7 ? f.config.backendId : 'archived-backend', applicationId: selected.applicationId,
        destinationId: selected.id, instanceId: selected.instanceId, directiveId: null, kind: 'observation', source: 'Historical fixture collector', detail: 'x'.repeat(1000), outcome: 'observed',
        version: '1.0.0', artifactId: artifacts[0].artifactId, bootId: 'old-boot', observedAt: historicalAt };
      insert.run(event.eventId, event.backendId, event.applicationId, event.destinationId, event.instanceId, null, event.kind, event.source, event.detail, event.outcome, event.version, event.artifactId, event.bootId, historicalAt, null, null, historicalAt, JSON.stringify(event));
    }
  })();
  const before = counts(f.catalog.db); const populated = await sample();
  assert.equal(placements(populated.body).length, 20); assert.ok(populated.bytes < 256 * 1024);
  assert.equal(populated.bytes, baseline.bytes, 'historical ledger growth does not add summary records or raw data');
  assert.doesNotMatch(populated.body, /old-observation-|Historical fixture collector/);
  assert.deepEqual(counts(f.catalog.db), before);
  t.diagnostic(JSON.stringify({ runtime: process.version, platform: `${process.platform}/${process.arch}`, fixture: '20 targets; 20 then 10020 mixed-scope observations; first and 10 warm renders',
    baseline: { coldMs: baseline.coldMs, medianMs: baseline.medianMs, p95Ms: baseline.p95Ms, bytes: baseline.bytes }, populated: { coldMs: populated.coldMs, medianMs: populated.medianMs, p95Ms: populated.p95Ms, bytes: populated.bytes } }));
});
