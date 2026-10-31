import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { createExercise } from '../dist/exercise/controller.js';
import { createApplication } from '../dist/app.js';
import { groupDestinations, referenceView } from '../dist/portfolio.js';
import { applicationOverview, portfolioPage } from '../dist/portfolio-views.js';

const destination = (id, stage) => ({ id, name: `Illustrative ${id}`, stage, disposable: true, state: 'Unknown', explanation: 'Illustrative only; no runtime observed.', observation: null, lastKnown: null, evidence: { source: 'Illustrative layout fixture, not a runtime' } });

test('presentation accepts zero, one, three and many instances including multiple instances in a stage without manufacturing targets', () => {
  const cases = [[], [destination('dev-a', 'Development')], [destination('dev-a', 'Development'), destination('test-a', 'Test'), destination('demo-a', 'Production')],
    [destination('dev-a', 'Development'), destination('dev-b', 'Development'), destination('test-a', 'Test'), destination('test-b', 'Test'), destination('demo-a', 'Production'), destination('lab-a', 'Local review')]];
  for (const destinations of cases) {
    const groups = groupDestinations(destinations);
    assert.equal(groups.flatMap((group) => group.instances).length, destinations.length);
    assert.equal(new Set(groups.map((group) => group.stage)).size, groups.length);
    const html = applicationOverview({ ...referenceView(), destinations });
    assert.equal((html.match(/data-destination=/g) || []).length, destinations.length);
    assert.equal((html.match(/class="version-number">Unknown/g) || []).length, destinations.length);
    assert.doesNotMatch(html, /<(form|input|button|script)\b|href="http:\/\/127/);
    if (!destinations.length) assert.match(html, /No concrete destinations connected/);
    if (destinations.length > 3) assert.equal(groups.find((group) => group.stage === 'Development').instances.length, 2);
  }
});

test('portfolio scales as a compact application collection and hides raw hashes, historical seeded decisions and operational forms', () => {
  const entries = Array.from({ length: 30 }, (_, i) => ({ ...referenceView(), id: `example-${i}`, name: `Illustrative application ${i}`, metadata: { next_decision: 'HISTORICAL-ONLY', artifactId: 'RAW-HASH-ONLY' } }));
  const html = portfolioPage(entries);
  assert.equal((html.match(/data-application=/g) || []).length, 30);
  assert.match(html, /30 known applications/); assert.doesNotMatch(html, /<(form|input|button|script)\b/);
  for (const row of html.matchAll(/<div class="row-overview">([\s\S]*?)<\/div>/g)) assert.doesNotMatch(row[1], /HISTORICAL-ONLY|RAW-HASH-ONLY/);
  assert.match(html, /Unknown/); assert.match(html, /Unknown is not healthy, failed or approved/);
});

test('presentation text is escaped and does not turn arbitrary destinations into executable/external links', () => {
  const unsafe = '<script>unsafe</script>';
  const entry = { ...referenceView(), name: unsafe, purpose: unsafe, stewardship: unsafe, destinations: [{ ...destination('example', unsafe), name: unsafe, url: 'javascript:alert(1)', explanation: unsafe }],
    directives: [{ actor: unsafe, role: unsafe, rationale: unsafe, disposition: 'recommend', expiresAt: '2026-10-29T00:00:00.000Z', scope: 'Illustrative recommendation only', conditions: 'No executable operation', candidate: unsafe, destination: unsafe, consumed: false, identity: 'Illustrative only' }] };
  assert.match(applicationOverview(entry), /Recorded directive only — no executable request linked/);
  assert.doesNotMatch(applicationOverview(entry), /<(form|input|button)\b/);
  for (const html of [portfolioPage([entry]), applicationOverview(entry)]) {
    assert.doesNotMatch(html, /<script|href="javascript:|onerror=/); assert.match(html, /&lt;script&gt;/);
  }
});

test('executive-to-application flow preserves provenance, decision authority, uncertainty and consumed-request semantics', async () => {
  const exercise = await createExercise(undefined, undefined, true);
  const app = createApplication(exercise.workspace.directory, exercise);
  try {
    let root = await app.inject('/');
    assert.doesNotMatch(root.body, /<script|<form[^>]+method="post"|name="csrf"|name="candidateId"/);
    assert.equal(exercise.latestObservation('test-reference'), null); // Portfolio GET does not manufacture a witness.
    const canonical = await app.inject('/applications/hello-observatory');
    assert.match(canonical.headers['content-security-policy'], /form-action 'self'/);
    assert.match(canonical.body, /name="candidateId"/); assert.match(canonical.body, /Recent consequential activity/);
    assert.match(canonical.body, /Governance standing does not supply execution credentials or capability/);
    await Promise.all(exercise.environments.map((item) => exercise.observe(item.id)));
    const pending = exercise.createRequest('1.2.0', 'test-reference', 'lost-receipt');
    exercise.decide(pending.id, 'authorize', 'Alex', 'Sponsor — self-declared', 'Only this exact local candidate and target.', true);
    let detail = await app.inject('/applications/hello-observatory');
    assert.match(detail.body, /Recorded decisions and scope/); assert.match(detail.body, /Only this exact local candidate and target/);
    assert.match(detail.body, /not authenticated organizational authority or execution credentials/);
    await exercise.apply(pending.id);
    const observation = await exercise.observe('test-reference', pending.id);
    assert.equal(observation.version, '1.2.0');
    root = await app.inject('/');
    assert.match(root.body, /execution outcome unknown/); assert.match(root.body, /1\.2\.0/);
    const model = referenceView(exercise);
    assert.equal(model.destinations.find((item) => item.id === 'test-reference').state, 'Observed');
    assert.equal(model.destinations.find((item) => item.id === 'test-reference').uncertainRequestId, pending.id);
    assert.equal(model.directives.find((item) => item.requestId === pending.id).consumed, true);
    assert.ok(model.activity.some((item) => /launcher reported unknown/.test(item.text)));
    assert.ok(model.activity.some((item) => /HTTP observed version 1.2.0/.test(item.text)));
    const request = await app.inject(`/reference/requests/${pending.id}`);
    assert.match(request.body, /Request consumed; a new decision is required for any further change/);
    assert.match(request.body, /Original criteria and current reuse checks/);
    assert.match(request.body, /Reuse checks are not retrospective execution errors/);
    await exercise.targets.get('test-reference').stop(); await exercise.observe('test-reference');
    detail = await app.inject('/applications/hello-observatory');
    assert.match(detail.body, /Last known/); assert.match(detail.body, /Historical; not current state/);
    const self = await app.inject('/applications/application-observatory');
    assert.match(self.body, /Actual operational state is <strong>Unknown/);
    assert.doesNotMatch(self.body, /class="version-number"|name="candidateId"/);
  } finally { await app.close(); rmSync(exercise.workspace.directory, { recursive: true, force: true }); }
});
