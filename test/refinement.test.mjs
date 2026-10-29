import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { createExercise } from '../dist/exercise/controller.js';
import { createApplication } from '../dist/app.js';
import { referenceView, pendingChanges } from '../dist/portfolio.js';
import { destinationCard } from '../dist/portfolio-views.js';

async function fixture(action, clock) {
  const exercise = await createExercise(undefined, clock, true); const app = createApplication(exercise.workspace.directory, exercise);
  try { await action(exercise, app); } finally { await app.close(); rmSync(exercise.workspace.directory, { recursive: true, force: true }); }
}
const decide = (exercise, id, disposition = 'authorize') => exercise.decide(id, disposition, 'Alex', 'Local demo role', 'This exact disposable request only.', true);
const observe = (exercise) => Promise.all(exercise.environments.map((item) => exercise.observe(item.id)));

test('context preselection validates known destinations on canonical and legacy GET without writing release or observation state', async () => fixture(async (exercise, app) => {
  const boots = [...exercise.targets.values()].map((target) => target.bootId);
  const before = exercise.environments.map((item) => ({ observations: exercise.observations(item.id), bootstrap: exercise.events(`runtime:${item.id}`) }));
  const root = await app.inject('/');
  assert.doesNotMatch(root.body, /<(form|input|button|script)\b/); assert.match(root.body, /row-context/);
  assert.doesNotMatch(root.body, /Executive portfolio|Applications &amp; next decisions/);
  for (const route of ['/reference', '/applications/hello-observatory']) for (const item of exercise.environments) {
    const response = await app.inject(`${route}?destination=${item.id}`); assert.equal(response.statusCode, 200);
    assert.match(response.body, new RegExp(`<option value="${item.id}" selected>`));
    assert.match(response.body, /id="propose-change" tabindex="-1"/);
  }
  for (const query of ['destination=not-a-target', 'destination=%22%3E%3Cscript%3Ebad%3C%2Fscript%3E', 'destination=dev-reference&destination=test-reference', 'destination=', 'destination=https%3A%2F%2Fexternal.example']) {
    for (const route of ['/reference', '/applications/hello-observatory']) {
      const response = await app.inject(`${route}?${query}`); assert.equal(response.statusCode, 400);
      assert.doesNotMatch(response.body, /<script|<form|name="candidateId"|external.example/);
    }
  }
  assert.deepEqual(exercise.requests(), []);
  assert.deepEqual(exercise.environments.map((item) => ({ observations: exercise.observations(item.id), bootstrap: exercise.events(`runtime:${item.id}`) })), before);
  assert.deepEqual([...exercise.targets.values()].map((target) => target.bootId), boots);
  assert.equal((await app.inject({ method: 'POST', url: '/reference/requests', headers: { host: 'localhost', origin: 'http://localhost' }, payload: { csrf: exercise.csrf, candidateId: '1.2.0', environmentId: 'not-a-target' } })).statusCode, 400);
  assert.deepEqual(exercise.requests(), []);
}));

test('Change version appears only on owned active destination cards, including unobserved targets; no capability is inferred for layouts', async () => fixture(async (exercise, app) => {
  let page = await app.inject('/applications/hello-observatory'); assert.equal((page.body.match(/class="button-link change-version"/g) || []).length, 3);
  await exercise.targets.get('test-reference').stop();
  page = await app.inject('/applications/hello-observatory'); assert.equal((page.body.match(/class="button-link change-version"/g) || []).length, 2);
  const synthetic = { id: 'synthetic', name: 'Illustrative', stage: 'Test', disposable: true, state: 'Unknown', explanation: 'No target', observation: null, lastKnown: null, evidence: {}, url: 'http://127.0.0.1:12345' };
  assert.doesNotMatch(destinationCard(synthetic), /Change version/);
  const self = await app.inject('/applications/application-observatory'); assert.doesNotMatch(self.body, /Change version|name="candidateId"/);
}));

test('application-wide pending projection retains all applicable requests and excludes nonbinding, refused, expired, stale and consumed records', async () => {
  let tick = Date.now();
  await fixture(async (exercise, app) => {
    const unobserved = exercise.createRequest('1.2.0', 'dev-reference', 'normal'); assert.deepEqual(pendingChanges(exercise), []);
    await observe(exercise);
    const undecided = exercise.createRequest('1.2.0', 'test-reference', 'normal');
    const authorized = exercise.createRequest('1.0.0', 'test-reference', 'normal'); decide(exercise, authorized.id);
    const excluded = [unobserved.id];
    for (const disposition of ['recommend', 'decline', 'defer']) { const plan = exercise.createRequest('1.2.0', 'test-reference', 'normal'); decide(exercise, plan.id, disposition); excluded.push(plan.id); }
    const refused = exercise.createRequest('1.2.0', 'test-reference', 'normal'); await exercise.apply(refused.id); excluded.push(refused.id);
    assert.deepEqual(new Set(pendingChanges(exercise).map((item) => item.requestId)), new Set([undecided.id, authorized.id]));
    let page = await app.inject('/applications/hello-observatory');
    assert.equal((page.body.match(/data-pending-request=/g) || []).length, 2);
    for (const id of excluded) assert.doesNotMatch(page.body, new RegExp(`data-pending-request="${id}"`));
    assert.match(page.body, /Decision required/); assert.match(page.body, /Declared authorization/); assert.match(page.body, /This exact disposable request only/);
    assert.ok(page.body.indexOf('id="pending-changes"') < page.body.indexOf('id="propose-change"'));
    assert.ok(page.body.indexOf('id="propose-change"') < page.body.indexOf('id="recent-activity"'));
    decide(exercise, refused.id);
    assert.ok(pendingChanges(exercise).some((item) => item.requestId === refused.id)); // A later valid decision supersedes an earlier pre-dispatch refusal; controller semantics are unchanged.
    decide(exercise, refused.id, 'decline');
    await exercise.apply(authorized.id); // Also invalidates the competing request's bound boot.
    assert.deepEqual(pendingChanges(exercise), []);
    await exercise.observe('test-reference');
    const uncertain = exercise.createRequest('1.2.0', 'test-reference', 'lost-receipt'); decide(exercise, uncertain.id); await exercise.apply(uncertain.id); await exercise.observe('test-reference', uncertain.id);
    assert.deepEqual(pendingChanges(exercise), []); assert.equal(exercise.events(uncertain.id).find((event) => event.kind === 'adapter result').data.outcome, 'unknown');
    const expiring = exercise.createRequest('1.0.0', 'dev-reference', 'normal'); decide(exercise, expiring.id); assert.equal(pendingChanges(exercise).length, 1);
    tick += 300001; assert.deepEqual(pendingChanges(exercise), []);
    page = await app.inject('/applications/hello-observatory'); assert.match(page.body, /No pending changes recorded/);
    assert.match(page.body, new RegExp(`/reference/requests/${expiring.id}`)); assert.match(page.body, new RegExp(`/reference/requests/${refused.id}`));
    const model = referenceView(exercise);
    assert.ok(model.activity.length > 6); // A compact preview must not truncate the underlying summaries/history.
    const preview = page.body.match(/class="activity-list activity-preview">([\s\S]*?)<\/ol>/)[1]; assert.equal((preview.match(/<li>/g) || []).length, 3);
    assert.match(page.body, /activity-history/); assert.match(page.body, /Full activity &amp; request history/);
  }, () => new Date(tick).toISOString());
});

test('collapsed scan combines uncertainty with every pending decision type and uses pending next roles, not generic or approving roles', async () => {
  const { portfolioPage } = await import('../dist/portfolio-views.js');
  const sample = { instanceId: 'unit-instance', bootId: 'unit-boot', outcome: 'observed', digest: 'sha256:unit-fixture', version: '1.1.0', generation: null, operationId: null, observedAt: '2026-10-29T00:00:00.000Z', recordedAt: '2026-10-29T00:00:00.000Z', source: 'Synthetic unit fixture', detail: 'Not a runtime observation' };
  for (const state of ['Unknown', 'Stale', 'Exception']) {
    const entry = { ...referenceView(), nextRole: 'Generic steward', destinations: [{ id: 'unit', name: 'Unit fixture', stage: 'Development', disposable: true, state, explanation: 'Synthetic fixture', observation: sample, lastKnown: sample, uncertainRequestId: 'uncertain', evidence: {} }],
      pendingChanges: [
        { requestId: 'decision', candidate: '1.2.0', destination: 'Other target', nextRole: 'Decision reviewer', status: 'Decision required' },
        { requestId: 'declaration', candidate: '1.0.0', destination: 'Other target', nextRole: 'Release operator', status: 'Declared authorization', decision: { role: 'Approving Sponsor' } },
      ] };
    const html = portfolioPage([entry]); const scan = html.match(/class="row-attention"[^>]*>([\s\S]*?)<\/p>/)[1];
    assert.match(scan, /1 decision pending/); assert.match(scan, /1 declared authorization pending/); assert.match(scan, /1 execution outcome unknown/);
    assert.match(scan, state === 'Exception' ? /1 version discrepancy/ : new RegExp(`1 ${state.toLowerCase()} destination`));
    assert.match(scan, /Decision reviewer \/ Release operator/); assert.match(scan, /recorded request/);
    assert.doesNotMatch(scan, /Generic steward|Approving Sponsor|failed|healthy/);
  }
});

test('unrelated stale destination and unknown execution cannot hide actionable Test decisions in the real collapsed portfolio', async () => {
  let tick = Date.now() - 360000;
  await fixture(async (exercise, app) => {
    await exercise.observe('dev-reference'); // A genuine old snapshot; no stored evidence is edited.
    tick = Date.now(); await exercise.observe('test-reference'); await exercise.observe('production-reference');
    const undecided = exercise.createRequest('1.2.0', 'test-reference', 'normal');
    const authorized = exercise.createRequest('1.0.0', 'test-reference', 'normal'); decide(exercise, authorized.id);
    const row = async () => (await app.inject('/')).body.match(/data-application="hello-observatory">[\s\S]*?class="row-attention"[^>]*>([\s\S]*?)<\/p>/)[1];
    let scan = await row(); assert.match(scan, /1 stale destination/); assert.match(scan, /1 decision pending/); assert.match(scan, /1 declared authorization pending/);
    assert.match(scan, /Local demo operator \(self-declared role\)/);
    await exercise.observe('dev-reference');
    const uncertain = exercise.createRequest('1.0.0', 'dev-reference', 'lost-receipt'); decide(exercise, uncertain.id); await exercise.apply(uncertain.id); await exercise.observe('dev-reference', uncertain.id);
    scan = await row(); assert.match(scan, /1 execution outcome unknown/); assert.match(scan, /1 decision pending/); assert.match(scan, /1 declared authorization pending/);
    assert.equal(exercise.events(uncertain.id).find((event) => event.kind === 'adapter result').data.outcome, 'unknown');
    assert.deepEqual(new Set(pendingChanges(exercise).map((change) => change.requestId)), new Set([undecided.id, authorized.id]));
    assert.equal(exercise.attempt(authorized.id), undefined); assert.equal(exercise.attempt(undecided.id), undefined);
  }, () => new Date(tick).toISOString());
});
