import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import Database from 'better-sqlite3';
import { createExercise } from '../dist/exercise/controller.js';
import { createApplication } from '../dist/app.js';
import { bundledRoot, verifyReference, referenceCandidates } from '../dist/reference/catalog.js';
import { readReference, validateVersion } from '../dist/reference/target.js';
import { startLocalServer } from '../scripts/local-server.mjs';

const approve = (exercise, id, disposition = 'authorize') => exercise.decide(id, disposition, 'Alex', 'Demo operator', 'Bounded local reference test', true);
async function withReference(action) {
  const exercise = await createExercise(undefined, undefined, true);
  try { await action(exercise); } finally { await exercise.close(); rmSync(exercise.workspace.directory, { recursive: true, force: true }); }
}
const observeAll = (exercise) => Promise.all(exercise.environments.map((item) => exercise.observe(item.id)));
async function change(exercise, version, fault = 'normal', destination = 'test-reference') {
  const plan = exercise.createRequest(version, destination, fault);
  approve(exercise, plan.id); await exercise.apply(plan.id); return plan;
}

test('accepted external package identities: exact bytes, mapping, membership and links checked without importing candidate code', () => {
  const root = mkdtempSync(join(tmpdir(), 'ao-reference-check-'));
  try {
    for (const candidate of referenceCandidates) assert.equal(verifyReference(join(bundledRoot, candidate.id), candidate.id).digest, candidate.digest);
    const copy = join(root, 'copy'); cpSync(join(bundledRoot, '1.1.0'), copy, { recursive: true });
    assert.throws(() => verifyReference(copy, '1.0.0'), /external digest/);
    writeFileSync(join(copy, 'extra.mjs'), 'throw new Error("must never execute")');
    assert.throws(() => verifyReference(copy, '1.1.0'), /membership/); rmSync(join(copy, 'extra.mjs'));
    writeFileSync(join(copy, 'server.mjs'), 'process.exit(99)');
    assert.throws(() => verifyReference(copy, '1.1.0'), /external digest/);
    rmSync(copy, { recursive: true }); cpSync(join(bundledRoot, '1.1.0'), copy, { recursive: true });
    rmSync(join(copy, 'style.css')); symlinkSync(join(bundledRoot, '1.1.0', 'style.css'), join(copy, 'style.css'));
    assert.throws(() => verifyReference(copy, '1.1.0'), /unlinked/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('three real isolated apps: independent HTTP snapshots, genuine upgrade and retained-package rollback, receipt never substitutes observation', async () => withReference(async (exercise) => {
  assert.deepEqual(exercise.environments.map((item) => exercise.latestObservation(item.id)), [null, null, null]);
  const initial = await observeAll(exercise);
  assert.deepEqual(initial.map((item) => item.version), ['1.2.0', '1.1.0', '1.0.0']);
  assert.equal(new Set([...exercise.targets.values()].map((target) => target.child.pid)).size, 3);
  assert.equal(new Set([...exercise.targets.values()].map((target) => target.address)).size, 3);
  const target = exercise.targets.get('test-reference');
  const oldBoot = target.bootId, oldPid = target.child.pid;
  const retained = readFileSync(join(exercise.workspace.directory, 'packages', '1.1.0', 'artifact.json'), 'utf8');
  const upgrade = exercise.createRequest('1.2.0', 'test-reference', 'normal');
  approve(exercise, upgrade.id); await Promise.all([exercise.apply(upgrade.id), exercise.apply(upgrade.id)]);
  assert.equal(exercise.events(upgrade.id).at(-1).data.outcome, 'completed');
  assert.equal(exercise.readBack(upgrade.id), null);
  assert.equal(exercise.latestObservation('test-reference').version, '1.1.0');
  assert.equal(exercise.observationCurrent(exercise.latestObservation('test-reference'), 'test-reference'), false);
  assert.notEqual(target.child.pid, oldPid); assert.notEqual(target.bootId, oldBoot);
  assert.match(await (await fetch(target.address)).text(), /1\.2\.0/);
  assert.equal((await exercise.observe('test-reference', upgrade.id)).version, '1.2.0');
  await exercise.apply(upgrade.id);
  assert.equal(exercise.events(upgrade.id).filter((item) => item.kind === 'dispatched').length, 1);
  const rollback = await change(exercise, '1.1.0');
  const observed = await exercise.observe('test-reference', rollback.id);
  assert.equal(observed.digest, initial[1].digest); assert.equal(observed.version, '1.1.0'); assert.notEqual(observed.bootId, oldBoot);
  assert.equal(readFileSync(join(exercise.workspace.directory, 'packages', '1.1.0', 'artifact.json'), 'utf8'), retained);
  assert.notEqual(observed.responseHash, observed.digest.replace('sha256:', ''));
  const after = await observeAll(exercise);
  for (const i of [0, 2]) { assert.equal(after[i].bootId, initial[i].bootId); assert.equal(after[i].digest, initial[i].digest); }
  const productionPage = await (await fetch(exercise.targets.get('production-reference').address)).text();
  assert.match(productionPage, /DISPOSABLE DEMO/); assert.match(productionPage, /NOT REAL PRODUCTION/);
}));

test('recommendations/declines, expiry, competing requests and changed boot cannot authorize stale dispatch', async () => {
  let date = Date.now(); const exercise = await createExercise(undefined, () => new Date(date).toISOString(), true);
  try {
    await observeAll(exercise);
    for (const disposition of ['recommend', 'decline', 'defer']) {
      const plan = exercise.createRequest('1.2.0', 'test-reference', 'normal'); approve(exercise, plan.id, disposition); await exercise.apply(plan.id);
      assert.equal(exercise.attempt(plan.id), undefined);
    }
    const stale = exercise.createRequest('1.0.0', 'test-reference', 'normal'); approve(exercise, stale.id);
    const newer = await change(exercise, '1.2.0'); assert.ok(exercise.attempt(newer.id));
    await exercise.apply(stale.id); assert.equal(exercise.attempt(stale.id), undefined);
    await exercise.observe('test-reference');
    const expired = exercise.createRequest('1.0.0', 'test-reference', 'normal'); approve(exercise, expired.id);
    date += 300001; await exercise.apply(expired.id); assert.equal(exercise.attempt(expired.id), undefined);
    assert.equal(exercise.observationCurrent(exercise.latestObservation('test-reference'), 'test-reference'), false);
    assert.throws(() => exercise.createRequest('arbitrary-code', 'test-reference', 'normal'));
    assert.throws(() => exercise.createRequest('1.2.0', 'real-production', 'normal'));
  } finally { await exercise.close(); rmSync(exercise.workspace.directory, { recursive: true, force: true }); }
});

test('refusal and lost receipt preserve actual state and uncertainty; stopping one child preserves other fresh observations', async () => withReference(async (exercise) => {
  await observeAll(exercise);
  const refused = await change(exercise, '1.2.0', 'refuse');
  assert.equal(exercise.events(refused.id).at(-1).data.outcome, 'failed');
  assert.equal((await exercise.observe('test-reference', refused.id)).version, '1.1.0');
  const uncertain = await change(exercise, '1.2.0', 'lost-receipt');
  assert.equal(exercise.events(uncertain.id).at(-1).data.outcome, 'unknown'); assert.equal(exercise.readBack(uncertain.id), null);
  assert.equal((await exercise.observe('test-reference', uncertain.id)).version, '1.2.0');
  assert.equal(exercise.events(uncertain.id).find((item) => item.kind === 'adapter result').data.outcome, 'unknown');
  await exercise.targets.get('test-reference').stop();
  const snapshots = await observeAll(exercise);
  assert.deepEqual(snapshots.map((item) => item.outcome), ['observed', 'unknown', 'observed']);
  assert.equal(exercise.latestObservation('test-reference', true).version, '1.2.0');
}));

test('tampered retained artifact refuses execution; injected startup failure leaves no invented running version and resumes explicitly', async () => {
  const exercise = await createExercise(undefined, undefined, true); const directory = exercise.workspace.directory;
  try {
    await observeAll(exercise);
    const file = join(directory, 'packages', '1.0.0', 'server.mjs');
    chmodSync(file, 0o600); const original = readFileSync(file); writeFileSync(file, 'throw new Error("unapproved bytes")');
    const before = exercise.targets.get('test-reference').bootId;
    const tampered = await change(exercise, '1.0.0');
    assert.equal(exercise.events(tampered.id).at(-1).data.outcome, 'failed');
    assert.equal(exercise.targets.get('test-reference').bootId, before);
    writeFileSync(file, original);
    const failed = await change(exercise, '1.2.0', 'launch-failure');
    assert.equal(exercise.events(failed.id).at(-1).data.outcome, 'failed');
    assert.equal((await exercise.observe('test-reference', failed.id)).outcome, 'unknown');
    await exercise.close();
    const resumed = await createExercise(directory, undefined, true);
    try {
      assert.equal((await resumed.observe('test-reference')).version, '1.1.0');
      assert.notEqual(resumed.targets.get('test-reference').bootId, before);
      assert.equal(resumed.events(failed.id).filter((item) => item.kind === 'dispatched').length, 1);
    } finally { await resumed.close(); }
  } finally { await exercise.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('version witness rejects malformed, wrong app/context/boot, unknown artifact and oversized or timed-out HTTP; dead port is never probed', async () => withReference(async (exercise) => {
  const target = exercise.targets.get('test-reference');
  const value = await (await fetch(`${target.address}/version`)).json();
  assert.equal(validateVersion(value, target, 'test-reference').version, '1.1.0');
  for (const patch of [{ schemaVersion: 2 }, { applicationId: 'other' }, { version: '9.9.9' }, { artifactId: referenceCandidates[0].digest }, { bootId: 'wrong' }, { context: { ...value.context, destinationId: 'other' } }, { context: { ...value.context, instanceId: 'other' } }, { context: { ...value.context, stage: 'Production' } }, { context: { ...value.context, disposableDemo: false } }]) assert.throws(() => validateVersion({ ...value, ...patch }, target, 'test-reference'));
  let mode = 'malformed', calls = 0;
  const server = createServer((_request, reply) => { calls++; reply.setHeader('content-type', 'application/json'); if (mode === 'timeout') return; reply.end(mode === 'oversized' ? 'x'.repeat(5000) : 'not-json'); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const fake = { instanceId: target.instanceId, bootId: target.bootId, address: `http://127.0.0.1:${server.address().port}`, child: { exitCode: null, signalCode: null, connected: true } };
    for (mode of ['malformed', 'oversized', 'timeout']) assert.equal((await readReference(fake, 'test-reference', () => new Date().toISOString())).outcome, 'unknown');
    fake.child.connected = false;
    const before = calls; assert.equal((await readReference(fake, 'test-reference', () => new Date().toISOString())).outcome, 'unknown'); assert.equal(calls, before);
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
}));

test('reference UI is opt-in, scoped/CSRF protected, keeps real self unknown, and preserves explicit historical observations', async () => withReference(async (exercise) => {
  const app = createApplication(exercise.workspace.directory, exercise);
  try {
    let page = await app.inject('/reference'); assert.equal(page.statusCode, 200); assert.match(page.body, /Current observation unavailable/);
    assert.match(page.body, /NOT REAL PRODUCTION/); assert.doesNotMatch(page.body, /latest\/package|command=/);
    const base = { method: 'POST', url: '/reference/refresh', headers: { host: 'localhost', origin: 'http://localhost', 'content-type': 'application/x-www-form-urlencoded' } };
    assert.equal((await app.inject({ ...base, body: 'csrf=wrong' })).statusCode, 403);
    assert.equal((await app.inject({ ...base, headers: { ...base.headers, origin: 'http://other' }, body: `csrf=${exercise.csrf}` })).statusCode, 403);
    assert.equal((await app.inject({ ...base, body: `csrf=${exercise.csrf}&url=http://other` })).statusCode, 403);
    assert.equal((await app.inject({ ...base, body: `csrf=${exercise.csrf}` })).statusCode, 303);
    page = await app.inject('/reference'); assert.match(page.body, /1\.2\.0/); assert.match(page.body, /1\.1\.0/); assert.match(page.body, /1\.0\.0/);
    const self = await app.inject('/applications/application-observatory'); assert.match(self.body, /No running versions have been established/);
    await exercise.targets.get('test-reference').stop(); await exercise.observe('test-reference');
    page = await app.inject('/reference'); assert.match(page.body, /Last known/); assert.match(page.body, /Historical; not current state/);
    assert.equal((await app.inject('/exercise')).statusCode, 404);
  } finally { await app.close(); }
}));

test('reference resume refuses linked retained packages and target selection without touching disposable sentinels', async () => {
  const exercise = await createExercise(undefined, undefined, true); const directory = exercise.workspace.directory;
  const outside = mkdtempSync(join(tmpdir(), 'ao-reference-sentinel-'));
  await exercise.close();
  try {
    const selection = join(directory, 'test-reference', 'retained-selection.json');
    const original = readFileSync(selection); const sentinel = join(outside, 'selection.json'); writeFileSync(sentinel, original);
    rmSync(selection); symlinkSync(sentinel, selection);
    await assert.rejects(() => createExercise(directory, undefined, true), /regular files/);
    assert.deepEqual(readFileSync(sentinel), original);
    rmSync(selection); writeFileSync(selection, original);
    const retained = join(directory, 'packages', '1.1.0'); cpSync(retained, join(outside, 'package'), { recursive: true });
    const before = readFileSync(join(outside, 'package', 'server.mjs'));
    rmSync(retained, { recursive: true }); symlinkSync(join(outside, 'package'), retained);
    await assert.rejects(() => createExercise(directory, undefined, true), /must not be a link/);
    assert.deepEqual(readFileSync(join(outside, 'package', 'server.mjs')), before);
  } finally { rmSync(directory, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); }
});

test('actual controller crash after real reference launch recovers missing receipt as unknown without dispatch replay', async () => {
  let server = await startLocalServer(undefined, { reference: true }); const workspace = server.workspace;
  try {
    const page = await (await fetch(`${server.address}/reference`)).text(); const csrf = page.match(/name="csrf" value="([a-f0-9]+)"/)[1];
    const form = (path, values = {}) => fetch(`${server.address}${path}`, { method: 'POST', redirect: 'manual', headers: { origin: server.address, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrf, ...values }) });
    await form('/reference/refresh');
    const created = await form('/reference/requests', { candidateId: '1.2.0', environmentId: 'test-reference', fault: 'lost-receipt' });
    const location = created.headers.get('location'); const id = location.split('/').at(-1);
    await form(`${location}/decision`, { disposition: 'authorize', actor: 'Alex', role: 'Demo operator', rationale: 'Crash evidence', scope: 'fixture-only' });
    const applying = form(`${location}/apply`).catch(() => null);
    let changed = false;
    for (let i = 0; i < 200; i++) {
      const selected = JSON.parse(readFileSync(join(workspace, 'test-reference', 'retained-selection.json'), 'utf8'));
      if (selected.version === '1.2.0') { changed = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.equal(changed, true, 'actual new reference process reached ready and retained its selected package');
    await server.crash(); await applying;
    server = await startLocalServer(undefined, { reference: true, resume: workspace });
    const after = await (await fetch(`${server.address}${location}`)).text(); assert.match(after, /Controller restarted without a terminal receipt/);
    const check = new Database(join(workspace, 'catalog.sqlite'));
    const events = check.prepare('SELECT kind, data FROM exercise_events WHERE request_id = ?').all(id); check.close();
    assert.equal(events.filter((item) => item.kind === 'dispatched').length, 1);
    assert.equal(JSON.parse(events.find((item) => item.kind === 'adapter result').data).outcome, 'unknown');
  } finally { await server.stop(); rmSync(workspace, { recursive: true, force: true }); }
});
