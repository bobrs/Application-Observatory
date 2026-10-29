import type { Exercise } from '../exercise/controller.js';
import { lifetime, type Observation, type Plan } from '../exercise/model.js';
import { escapeHtml as e, layout } from '../views.js';
import { referenceCandidates } from './catalog.js';
import { running } from './target.js';
const json = (value: unknown) => `<pre>${e(JSON.stringify(value, null, 2))}</pre>`;
const time = (value: string) => `<time datetime="${e(value)}">${e(value.replace('T', ' ').replace('Z', ' UTC'))}</time>`;
const token = (exercise: Exercise) => `<input type="hidden" name="csrf" value="${exercise.csrf}">`;
const post = (exercise: Exercise, path: string, label: string, disabled = false) => `<form method="post" action="${path}">${token(exercise)}<button${disabled ? ' disabled' : ''}>${e(label)}</button></form>`;
const evidence = (label: string, value: unknown) => `<details><summary>${e(label)}</summary>${json(value)}</details>`;
function version(observation: Observation | null) { return observation?.version ?? 'Unknown'; }
export function transition(plan: Plan) {
  const before = referenceCandidates.findIndex((item) => item.digest === plan.expected?.digest);
  const after = referenceCandidates.findIndex((item) => item.id === plan.candidateId);
  return before < 0 ? 'Activate' : after < before ? 'Rollback' : after > before ? 'Upgrade' : 'Restart';
}
function latest(exercise: Exercise, environmentId: string) {
  const plan = exercise.requests().find((item) => item.environmentId === environmentId);
  if (!plan) return '<p class="source-note">No operator action requested.</p>';
  const result = exercise.events(plan.id).filter((event) => event.kind === 'adapter result').at(-1);
  const decision = exercise.latestDecision(plan.id);
  return `<p class="latest-action"><a href="/reference/requests/${plan.id}">${transition(plan)} to ${e(plan.candidateId)}</a><br><small>Decision: ${e(String(decision?.data.disposition ?? 'not recorded'))} · Action: ${e(String(result?.data.outcome ?? (exercise.attempt(plan.id) ? 'awaiting receipt' : 'not dispatched')))}</small></p>`;
}
export function referencePage(exercise: Exercise) {
  const cards = exercise.environments.map((destination) => {
    const target = exercise.targets.get(destination.id)!;
    const observation = exercise.latestObservation(destination.id);
    const known = exercise.latestObservation(destination.id, true);
    const current = exercise.observationCurrent(observation, destination.id);
    return `<article class="panel reference-card" data-destination="${destination.id}"><p class="eyebrow">${e(destination.stage)}${destination.stage === 'Production' ? ' · DISPOSABLE DEMO' : ''}</p><h2>${e(destination.name)}</h2>
      ${destination.stage === 'Production' ? '<p class="demo-warning">NOT REAL PRODUCTION</p>' : ''}
      <p class="version-number">${current ? e(version(observation)) : 'Unknown'}</p><p class="source-note">${current ? 'Observed version' : observation?.outcome === 'observed' ? 'Observation stale or runtime changed — refresh required' : 'Current observation unavailable'}</p>
      ${current ? `<p class="hash">${e(observation!.digest!.slice(0, 23))}…</p><p class="source-note">${time(observation!.observedAt!)}<br>Fresh local HTTP /version</p>` : known ? `<p class="source-note">Last known: <strong>${e(version(known))}</strong><br>${time(known.observedAt!)}<br>Historical; not current state.</p>` : '<p class="source-note">No valid version observed yet.</p>'}
      ${running(target) ? `<a class="button-link" href="${e(target.address)}" target="_blank" rel="noopener noreferrer">Open app ↗</a>` : '<p class="source-note">Owned process stopped. No historical port is probed.</p>'}
      ${latest(exercise, destination.id)}
      <details><summary>Evidence</summary><p>Instance <code>${e(target.instanceId)}</code><br>Current boot <code>${e(target.bootId)}</code></p>${evidence('Latest observation', observation)}${evidence('Observation history', exercise.observations(destination.id))}${evidence('Runtime bootstrap history', exercise.events(`runtime:${destination.id}`))}</details></article>`;
  }).join('');
  return layout('Hello Observatory · Local reference', `<p class="eyebrow">Three destinations · One real reference app</p><h1>What is running?</h1><p class="intro">See the actual reported version. Change one destination. Refresh to check what happened.</p>
    <aside class="notice">Local disposable demonstration only. Version observations, action results and declared decisions are separate. <strong>Health and independent Test acceptance are not evaluated.</strong></aside>
    <div class="section-heading"><h2>Hello Observatory</h2>${post(exercise, '/reference/refresh', 'Refresh observations')}</div>
    <div class="reference-grid">${cards}</div><p class="source-note">Each refresh reads all three owned endpoints independently. Observations expire for action purposes after ${lifetime / 60000} minutes; refresh the page to see updated freshness.</p>
    <section class="panel selection"><h2>Choose the next version</h2><p>Select an accepted artifact and one destination. You will review readiness and a bounded decision before anything changes.</p>
    <form method="post" action="/reference/requests">${token(exercise)}<div class="reference-selection"><label>Version<select name="candidateId">${exercise.candidates.map((item) => `<option value="${e(item.id)}">${e(item.label)}</option>`).join('')}</select></label><label>Destination<select name="environmentId">${exercise.environments.map((item) => `<option value="${item.id}">${e(item.name)} — ${e(item.stage)}${item.stage === 'Production' ? ' · DISPOSABLE DEMO ONLY' : ''}</option>`).join('')}</select></label></div>
    <details><summary>Demonstration faults</summary><label>Injected condition<select name="fault"><option value="normal">Normal execution</option><option value="refuse">Refuse before stopping the app</option><option value="launch-failure">Fail startup after stopping the app</option><option value="lost-receipt">Withhold receipt after real launch</option></select></label></details><button>Review change</button></form></section>
    <details><summary>Request history and accepted artifact provenance</summary><p>Only the three accepted Step A packages can execute. Full-package SHA-256 is not an HTTP response hash or a Git commit. The endpoint is a same-host runtime report, not hostile-host attestation.</p>${evidence('Accepted artifact index', exercise.candidates)}<p><a href="https://github.com/bobrs/observatory-hello-reference/pull/1">Accepted reference source and contract</a> · <a href="/">Read-only Observatory self-catalog</a></p><ol>${exercise.requests().map((plan) => `<li><a href="/reference/requests/${plan.id}">${transition(plan)} ${e(exercise.environment(plan.environmentId).name)} to ${e(plan.candidateId)}</a> · ${time(plan.createdAt)}</li>`).join('')}</ol></details>`, 'reference');
}
export function referenceRequestPage(exercise: Exercise, plan: Plan) {
  const destination = exercise.environment(plan.environmentId);
  const action = transition(plan);
  const reasons = exercise.actionBlocks(plan.id);
  const attempt = exercise.attempt(plan.id);
  const result = exercise.events(plan.id).filter((event) => event.kind === 'adapter result').at(-1);
  const observation = exercise.readBack(plan.id);
  const decision = exercise.latestDecision(plan.id);
  return layout(`${action} review`, `<nav class="breadcrumbs"><a href="/reference">← Three destinations</a></nav><p class="eyebrow">Review · Decide · Apply · Observe</p><h1>${action} ${e(destination.name)} to ${e(plan.candidateId)}</h1>
    <p class="intro">${e(destination.stage)}${destination.stage === 'Production' ? ' — DISPOSABLE DEMO ONLY, NOT REAL PRODUCTION' : ' — disposable local destination'}. Earlier retained package for rollback; a new process for every activation.</p>
    <div class="exercise-grid"><section class="panel"><h2>1. Readiness and decision</h2><p>Expected observed version: <strong>${e(version(plan.expected))}</strong> → selected <strong>${e(plan.candidateId)}</strong></p><p class="source-note">Candidate, destination, boot, expected state and injected fault are bound to this exact five-minute request.</p>
    ${reasons.length ? `<ul>${reasons.map((reason) => `<li>${e(reason)}</li>`).join('')}</ul>` : '<p>Ready for this bounded local action. This does not establish health or Test acceptance.</p>'}
    <p>Latest decision: <strong>${e(String(decision?.data.disposition ?? 'not recorded'))}</strong></p>
    ${!attempt ? `${decision ? '<details><summary>Change recorded decision</summary>' : ''}<form method="post" action="/reference/requests/${plan.id}/decision">${token(exercise)}<label>Decision<select name="disposition"><option value="authorize">Authorize this bounded demo action</option><option value="recommend">Recommend only</option><option value="decline">Decline</option><option value="defer">Defer</option></select></label><label>Your name<input name="actor" required maxlength="80"></label><label>Claimed role<input name="role" required maxlength="80" value="Demo operator"></label><label>Rationale<textarea name="rationale" maxlength="500"></textarea></label><label class="checkbox"><input type="checkbox" name="scope" value="fixture-only" required>I confirm this decision concerns only this exact artifact, disposable destination and fault. An authorization is single-use. Identity is self-declared; no real Production or organizational standing is established.</label><button>Record decision</button></form>${decision ? '</details>' : ''}` : '<p>This request has dispatched and cannot be reused.</p>'}
    ${evidence('Exact request and full artifact identity', plan)}${decision ? evidence('Decision evidence', decision) : ''}</section>
    <section class="panel"><h2>2. Explicitly apply</h2><p>Recording a decision does not execute the change.</p>${post(exercise, `/reference/requests/${plan.id}/apply`, `${action} to ${plan.candidateId}`, !!attempt || reasons.length > 0)}
    <p>Action result: <strong>${e(String(result?.data.outcome ?? (attempt ? 'unknown — terminal receipt pending' : 'not dispatched')))}</strong></p><p class="source-note">${e(String(result?.data.detail ?? 'No action result recorded.'))}</p>
    <hr><h2>3. Independently observe</h2><p>A receipt never updates the observed version. Request a fresh HTTP read after applying.</p>${post(exercise, `/reference/requests/${plan.id}/observe`, 'Observe target')}
    <p>Post-action observation: <strong>${observation?.outcome === 'observed' ? e(version(observation)) : 'Unknown'}</strong></p><p class="source-note">${observation ? `Recorded ${time(observation.recordedAt)}. Historical snapshot; ${exercise.observationCurrent(observation, plan.environmentId) ? 'current incarnation at page render' : 'refresh required for current state'}.` : 'No separate post-action read is linked to this request yet.'}</p>
    <p>${attempt ? 'Next: observe the target, then return to the three destinations. Any further action requires a new request.' : reasons.length ? 'Next: resolve the listed readiness or decision requirements before applying.' : 'Next: explicitly apply this authorized change. Recording the decision did not execute it.'}</p>${result ? evidence('Execution receipt / uncertainty evidence', result) : ''}${observation ? evidence('Post-action HTTP evidence', observation) : ''}</section></div>
    <details><summary>Evidence timeline</summary><ol class="timeline">${exercise.events(plan.id).map((event) => `<li><strong>${e(event.kind)}</strong> · ${time(event.recordedAt)}<p>${e(event.source)}</p>${json(event.data)}</li>`).join('')}</ol></details>`, 'reference');
}
