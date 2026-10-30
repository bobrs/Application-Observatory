import assert from 'node:assert/strict';
import { test } from 'node:test';
import { linkSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { createExercise } from '../dist/exercise/controller.js';
import { createApplication } from '../dist/app.js';
import { candidates } from '../dist/exercise/model.js';
import { openWorkspace } from '../dist/exercise/workspace.js';
import { schema } from '../dist/migrations/001-self-catalog.js';
import { openCatalog } from '../dist/catalog.js';
import { startLocalServer } from '../scripts/local-server.mjs';
import { setTimeout as delay } from 'node:timers/promises';

async function fixture(t, clock) {
  const exercise = await createExercise(undefined, clock);
  t.after(async () => { await exercise.close(); rmSync(exercise.workspace.directory, { recursive: true, force: true }); });
  return exercise;
}
function authorize(exercise, plan) { exercise.decide(plan.id, 'authorize', 'Casey', 'Demo operator', 'One fixture action', true); }
function receipt(exercise, id) { return exercise.events(id).filter((event) => event.kind === 'adapter result').at(-1)?.data; }

test('two distinct-stage instances: activation receipt is not observation, and other target is unchanged', async (t) => {
  const exercise = await fixture(t);
  assert.notEqual(exercise.targets.get('dev-sandbox').instanceId, exercise.targets.get('test-sandbox').instanceId);
  await exercise.observe('dev-sandbox');
  await exercise.observe('test-sandbox');
  const plan = exercise.createRequest('sample-v2', 'test-sandbox', 'normal');
  authorize(exercise, plan);
  assert.equal(exercise.attempt(plan.id), undefined);
  assert.equal(exercise.latestObservation('test-sandbox').digest, candidates[0].digest);
  await Promise.all([exercise.apply(plan.id), exercise.apply(plan.id)]);
  assert.equal(receipt(exercise, plan.id).outcome, 'completed');
  assert.equal(exercise.readBack(plan.id), null);
  assert.equal(exercise.latestObservation('test-sandbox').digest, candidates[0].digest);
  const after = await exercise.observe('test-sandbox', plan.id);
  assert.equal(after.digest, candidates[1].digest);
  assert.equal(after.generation, 1);
  assert.equal((await exercise.observe('dev-sandbox')).generation, 0);
  await exercise.apply(plan.id);
  assert.equal((await exercise.observe('test-sandbox')).generation, 1);
  assert.equal(exercise.events(plan.id).filter((event) => event.kind === 'dispatched').length, 1);
});

test('missing, recommended, declined and expired decisions cannot dispatch; stale observations cannot be refreshed silently', async (t) => {
  let now = Date.now();
  const exercise = await fixture(t, () => new Date(now).toISOString());
  const missing = exercise.createRequest('sample-v2', 'dev-sandbox', 'normal');
  authorize(exercise, missing);
  await exercise.apply(missing.id);
  assert.equal(exercise.attempt(missing.id), undefined);
  await exercise.observe('dev-sandbox');
  const plan = exercise.createRequest('sample-v2', 'dev-sandbox', 'normal');
  for (const disposition of ['recommend', 'decline', 'defer']) {
    exercise.decide(plan.id, disposition, 'Pat', 'Claimed reviewer', 'Not permission', false);
    await exercise.apply(plan.id);
    assert.equal(exercise.attempt(plan.id), undefined);
  }
  authorize(exercise, plan);
  now += 300001;
  await exercise.apply(plan.id);
  assert.equal(exercise.attempt(plan.id), undefined);
  assert.throws(() => exercise.createRequest('arbitrary', 'dev-sandbox', 'normal'));
  assert.throws(() => exercise.createRequest('sample-v1', 'production', 'normal'));
  assert.throws(() => exercise.createRequest('sample-v1', 'dev-sandbox', 'shell'));
});

test('another request changes target generation: stale request is refused and retains its original decision', async (t) => {
  const exercise = await fixture(t);
  await exercise.observe('dev-sandbox');
  const stale = exercise.createRequest('sample-v2', 'dev-sandbox', 'normal');
  const other = exercise.createRequest('sample-v1', 'dev-sandbox', 'normal');
  authorize(exercise, stale); authorize(exercise, other);
  await exercise.apply(other.id);
  await exercise.apply(stale.id);
  assert.equal(exercise.attempt(stale.id), undefined);
  assert.equal(exercise.latestDecision(stale.id).data.disposition, 'authorize');
  assert.ok(exercise.events(stale.id).some((event) => event.kind === 'refused before dispatch'));
  assert.equal((await exercise.observe('dev-sandbox')).digest, candidates[0].digest);
});

test('injected failure and missing receipt preserve results; unavailable read-back preserves last known state', async (t) => {
  const exercise = await fixture(t);
  await exercise.observe('test-sandbox');
  const failed = exercise.createRequest('sample-v2', 'test-sandbox', 'refuse');
  authorize(exercise, failed); await exercise.apply(failed.id);
  assert.equal(receipt(exercise, failed.id).outcome, 'failed');
  assert.equal(exercise.readBack(failed.id), null);
  assert.equal((await exercise.observe('test-sandbox', failed.id)).generation, 0);
  const uncertain = exercise.createRequest('sample-v2', 'test-sandbox', 'lost-receipt');
  authorize(exercise, uncertain); await exercise.apply(uncertain.id);
  assert.equal(receipt(exercise, uncertain.id).outcome, 'unknown');
  assert.equal((await exercise.observe('test-sandbox', uncertain.id)).digest, candidates[1].digest);
  await exercise.apply(uncertain.id);
  assert.equal((await exercise.observe('test-sandbox')).generation, 1);
  await exercise.targets.get('test-sandbox').stop();
  assert.equal((await exercise.observe('test-sandbox', uncertain.id)).outcome, 'unknown');
  assert.equal(exercise.latestObservation('test-sandbox', true).digest, candidates[1].digest);
});

test('target itself refuses generation mismatch; read-back conflict does not rewrite completed receipt', async (t) => {
  const exercise = await fixture(t);
  await exercise.observe('dev-sandbox');
  const plan = exercise.createRequest('sample-v2', 'dev-sandbox', 'normal');
  authorize(exercise, plan); await exercise.apply(plan.id);
  const target = exercise.targets.get('dev-sandbox');
  assert.equal((await target.activate(plan, '11111111-1111-4111-8111-111111111111')).outcome, 'refused');
  await exercise.observe('dev-sandbox');
  const back = exercise.createRequest('sample-v1', 'dev-sandbox', 'normal');
  authorize(exercise, back); await exercise.apply(back.id);
  assert.equal((await exercise.observe('dev-sandbox', plan.id)).digest, candidates[0].digest);
  assert.equal(receipt(exercise, plan.id).outcome, 'completed');
});

test('POST controls require origin, CSRF, allowlisted fields; default catalog stays read-only', async (t) => {
  const exercise = await fixture(t);
  const app = createApplication(exercise.workspace.directory, exercise);
  t.after(() => app.close());
  const post = (payload, headers = {}) => app.inject({ method: 'POST', url: '/exercise/requests', headers: { origin: 'http://localhost:80', ...headers }, payload });
  assert.equal((await post({ candidateId: 'sample-v1' })).statusCode, 403);
  assert.equal((await post({ csrf: exercise.csrf, candidateId: 'sample-v1', environmentId: 'dev-sandbox', path: '/tmp/anything' })).statusCode, 403);
  assert.equal((await post({ csrf: exercise.csrf }, { origin: 'https://external.example' })).statusCode, 403);
  assert.equal((await post({ csrf: exercise.csrf }, { origin: 'null' })).statusCode, 403);
  const response = await post({ csrf: exercise.csrf, candidateId: 'sample-v1', environmentId: 'dev-sandbox' });
  assert.equal(response.statusCode, 303);
  const queried = await app.inject('/exercise?view=local');
  assert.match(queried.headers['content-security-policy'], /form-action 'self'/);
  assert.equal(queried.headers['referrer-policy'], 'same-origin');
  const page = await app.inject(response.headers.location);
  assert.match(page.body, /No usable observation/);
  assert.match(page.body, /Pending — no post-action observation/);
  assert.match(page.body, /claimed role/);
  const recorded = await app.inject({ method: 'POST', url: `${response.headers.location}/decision`, headers: { origin: 'http://localhost:80' },
    payload: { csrf: exercise.csrf, disposition: 'authorize', actor: '<img src=x onerror=alert(1)>', role: 'Demo', rationale: '<script>fixture</script>', scope: 'fixture-only' } });
  assert.equal(recorded.statusCode, 303);
  const escaped = await app.inject(response.headers.location);
  assert.match(escaped.body, /&lt;img/);
  assert.doesNotMatch(escaped.body, /<img src=x|<script>/);
  const catalog = await app.inject('/applications/application-observatory');
  assert.match(catalog.body, /Actual operational state is <strong>Unknown/);
  assert.match(catalog.body, /No concrete destinations connected/);
  assert.doesNotMatch(catalog.body, /<form/);
  assert.equal((await app.inject({ method: 'POST', url: '/', payload: {} })).statusCode, 405);
});

test('workspace locks, unmarked resume and symlink escape are rejected', async (t) => {
  const exercise = await fixture(t);
  assert.throws(() => openWorkspace(exercise.workspace.directory), /live controller/);
  const outside = mkdtempSync(join(tmpdir(), 'ao-unmarked-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  assert.throws(() => openWorkspace(outside));
  const alias = join(outside, 'alias');
  symlinkSync(exercise.workspace.directory, alias);
  assert.throws(() => openWorkspace(alias), /symbolic link/);
  const state = JSON.parse(readFileSync(join(exercise.workspace.directory, 'dev-sandbox', 'state.json'), 'utf8'));
  assert.equal(state.generation, 0);
});

test('schema 1 migration preserves original self-entry metadata and adds exercise tables', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'ao-migration-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const db = new Database(join(directory, 'catalog.sqlite'));
  db.exec(schema);
  db.prepare('INSERT INTO applications VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('application-observatory', 'Original', 'Old purpose', 'Known role', 'https://example.invalid', 'old-source', '2020-01-01T00:00:00Z', 'Old snapshot', 'old-issue');
  db.close();
  const catalog = openCatalog(directory);
  assert.equal(catalog.list().length, 1);
  assert.equal(catalog.list()[0].recorded_at, '2020-01-01T00:00:00Z');
  assert.equal(catalog.list()[0].purpose, 'Old purpose');
  catalog.close();
  const checked = new Database(join(directory, 'catalog.sqlite'));
  assert.equal(checked.pragma('user_version', { simple: true }), 4);
  assert.equal(checked.prepare('SELECT count(*) AS n FROM exercise_requests').get().n, 0);
  checked.close();
});

test('fixture resume refuses a linked target state without modifying its external sentinel', async (t) => {
  const exercise = await createExercise();
  const directory = exercise.workspace.directory;
  const unrelated = mkdtempSync(join(tmpdir(), 'ao-sentinel-'));
  t.after(() => { rmSync(directory, { recursive: true, force: true }); rmSync(unrelated, { recursive: true, force: true }); });
  await exercise.close();
  const targetFile = join(directory, 'dev-sandbox', 'state.json');
  const sentinel = join(unrelated, 'unchanged.txt');
  writeFileSync(sentinel, 'unrelated disposable sentinel');
  unlinkSync(targetFile);
  symlinkSync(sentinel, targetFile);
  await assert.rejects(() => createExercise(directory), /exited before ready/);
  assert.equal(readFileSync(sentinel, 'utf8'), 'unrelated disposable sentinel');
});

test('actual controller crash after target change preserves unknown result, consumes request and invalidates old approvals', async () => {
  let server;
  let directory;
  try {
    server = await startLocalServer(undefined, { exercise: true });
    directory = server.workspace;
    assert.ok(directory);
    async function session() {
      const html = await (await fetch(`${server.address}/exercise`)).text();
      const token = html.match(/name="csrf" value="([a-f0-9]+)"/)[1];
      return async (path, data = {}) => fetch(`${server.address}${path}`, {
        method: 'POST', redirect: 'manual', headers: { origin: server.address, 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ csrf: token, ...data }),
      });
    }
    let post = await session();
    assert.equal((await post('/exercise/observe/test-sandbox')).status, 303);
    async function request(fault) {
      const response = await post('/exercise/requests', { candidateId: 'sample-v2', environmentId: 'test-sandbox', fault });
      const path = response.headers.get('location');
      assert.equal(response.status, 303);
      assert.equal((await post(`${path}/decision`, { disposition: 'authorize', actor: 'Crash fixture', role: 'Demo operator', rationale: '', scope: 'fixture-only' })).status, 303);
      return path;
    }
    const unused = await request('normal');
    const uncertain = await request('lost-receipt');
    const pending = post(`${uncertain}/apply`).catch(() => null);
    const stateFile = join(directory, 'test-sandbox', 'state.json');
    const deadline = Date.now() + 5000;
    while (JSON.parse(readFileSync(stateFile, 'utf8')).generation !== 1) {
      if (Date.now() > deadline) throw new Error('Fixture did not activate before crash.');
      await delay(10);
    }
    await server.crash();
    await pending;
    server = await startLocalServer(undefined, { exercise: true, resume: directory });
    post = await session();
    const recovered = await (await fetch(`${server.address}${uncertain}`)).text();
    assert.match(recovered, /Controller restarted without a terminal receipt/);
    assert.match(recovered, /unknown — adapter result only/);
    assert.equal((await post(`${uncertain}/apply`)).status, 303);
    assert.equal(JSON.parse(readFileSync(stateFile, 'utf8')).generation, 1);
    const oldApproval = await (await fetch(`${server.address}${unused}`)).text();
    assert.match(oldApproval, /Target restarted or changed instance/);
    assert.equal((await post(`${unused}/apply`)).status, 303);
    assert.equal(JSON.parse(readFileSync(stateFile, 'utf8')).generation, 1);
    assert.equal((await post(`${uncertain}/observe`)).status, 303);
    const observed = await (await fetch(`${server.address}${uncertain}`)).text();
    assert.match(observed, /Observed bytes match/);
    assert.match(observed, /original execution outcome is still unknown/);
  } finally {
    if (server) await server.stop();
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
});

test('resumed ledger cannot be a hard link into unrelated data', async (t) => {
  const exercise = await createExercise();
  const directory = exercise.workspace.directory;
  const unrelated = mkdtempSync(join(tmpdir(), 'ao-ledger-sentinel-'));
  t.after(() => { rmSync(directory, { recursive: true, force: true }); rmSync(unrelated, { recursive: true, force: true }); });
  await exercise.close();
  const sentinel = join(unrelated, 'unchanged.txt');
  writeFileSync(sentinel, 'unrelated disposable ledger sentinel');
  unlinkSync(join(directory, 'catalog.sqlite'));
  linkSync(sentinel, join(directory, 'catalog.sqlite'));
  await assert.rejects(() => createExercise(directory), /regular files/);
  assert.equal(readFileSync(sentinel, 'utf8'), 'unrelated disposable ledger sentinel');
});
