import type { Exercise } from '../exercise/controller.js';
import { lifetime, type Observation, type Plan } from '../exercise/model.js';
import { escapeHtml as e, layout } from '../views.js';
import { applicationOverview } from '../portfolio-views.js';
import { referenceView } from '../portfolio.js';
import { referenceCandidates } from './catalog.js';
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
export function selectedDestination(exercise: Exercise, value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !exercise.environments.some((destination) => destination.id === value)) throw new Error('Choose a known local destination.');
  return value;
}
export function selectionError() {
  return layout('Unknown destination', '<h1>Choose a known local destination</h1><p>No request or decision was created.</p><a href="/applications/hello-observatory">Return to application detail</a>');
}
export function referencePage(exercise: Exercise, value?: unknown) {
  const selected = selectedDestination(exercise, value);
  const controls = `<section class="panel selection" id="propose-change" tabindex="-1"><h2>Propose a version change</h2>${selected ? `<p class="context-selection">Destination preselected: <strong>${e(exercise.environment(selected).name)}</strong>. Review the version and decision before explicitly applying.</p>` : ''}<p>Select an accepted artifact and a specific disposable destination. Review readiness and a bounded decision before anything changes.</p>
    <form method="post" action="/reference/requests">${token(exercise)}<div class="reference-selection"><label>Version<select name="candidateId">${exercise.candidates.map((item) => `<option value="${e(item.id)}">${e(item.label)}</option>`).join('')}</select></label><label>Destination<select name="environmentId">${exercise.environments.map((item) => `<option value="${item.id}"${item.id === selected ? ' selected' : ''}>${e(item.name)} — ${e(item.stage)}${item.stage === 'Production' ? ' · DISPOSABLE DEMO ONLY' : ''}</option>`).join('')}</select></label></div>
    <details><summary>Demonstration faults</summary><p>Diagnostic options, not everyday release conditions. The selected condition is bound to the exact request and decision.</p><label>Injected condition<select name="fault"><option value="normal">Normal execution</option><option value="refuse">Refuse before stopping the app</option><option value="launch-failure">Fail startup after stopping the app</option><option value="lost-receipt">Withhold receipt after real launch</option></select></label></details><button>Review change</button></form></section>
    <p class="source-note">Observations expire for action purposes after ${lifetime / 60000} minutes. Refresh reads each owned endpoint independently; freshness updates at page render, not by polling.</p>
    `;
  const history = `    <details><summary>Request history and accepted artifact provenance</summary><p>Only the three accepted Step A packages can execute. Whole-package identity is distinct from source revision and HTTP response hash; runtime self-report is not hostile-host attestation.</p>${evidence('Accepted artifact index', exercise.candidates)}<p><a href="https://github.com/bobrs/observatory-hello-reference/pull/1">Accepted reference source and contract</a></p><ol>${exercise.requests().map((plan) => `<li><a href="/reference/requests/${plan.id}">${transition(plan)} ${e(exercise.environment(plan.environmentId).name)} to ${e(plan.candidateId)}</a> · ${time(plan.createdAt)}</li>`).join('')}</ol></details>`;
  return applicationOverview(referenceView(exercise), { reference: true, controls, history, refresh: post(exercise, '/reference/refresh', 'Refresh observations') });
}
export function referenceRequestPage(exercise: Exercise, plan: Plan) {
  const destination = exercise.environment(plan.environmentId);
  const action = transition(plan);
  const reasons = exercise.actionBlocks(plan.id);
  const attempt = exercise.attempt(plan.id);
  const result = exercise.events(plan.id).filter((event) => event.kind === 'adapter result').at(-1);
  const observation = exercise.readBack(plan.id);
  const decision = exercise.latestDecision(plan.id);
  return layout(`${action} review`, `<nav class="breadcrumbs"><a href="/applications/hello-observatory">← Application detail</a></nav><p class="eyebrow">Review · Decide · Apply · Observe</p><h1>${action} ${e(destination.name)} to ${e(plan.candidateId)}</h1>
    <p class="intro">${e(destination.stage)}${destination.stage === 'Production' ? ' — DISPOSABLE DEMO ONLY, NOT REAL PRODUCTION' : ' — disposable local destination'}. Earlier retained package for rollback; a new process for every activation.</p>
    <div class="exercise-grid"><section class="panel"><h2>1. Readiness and decision</h2><p>Expected observed version: <strong>${e(version(plan.expected))}</strong> → selected <strong>${e(plan.candidateId)}</strong></p><p class="source-note">Candidate, destination, boot, expected state and injected fault are bound to this exact five-minute request.</p>
    ${attempt ? `<p class="notice"><strong>Request consumed; a new decision is required for any further change.</strong> The action result and separate observation are shown alongside. Reuse checks are not retrospective execution errors.</p>${evidence('Original criteria and current reuse checks', { criteria: plan.criteriaVersion, originalExpected: plan.expected, currentReuseBlocks: reasons })}` : reasons.length ? `<ul>${reasons.map((reason) => `<li>${e(reason)}</li>`).join('')}</ul>` : '<p>Ready for this bounded local action. This does not establish health or Test acceptance.</p>'}
    <p>Latest decision: <strong>${e(String(decision?.data.disposition ?? 'not recorded'))}</strong></p>${decision ? `<p class="source-note">${e(String(decision.data.actor))} · claimed role ${e(String(decision.data.role))}. ${e(String(decision.data.rationale || 'No rationale recorded.'))}<br>Scope: this exact request only; expires ${time(String(decision.data.expiresAt))}. Self-declared standing; not execution credentials.</p>` : ''}
    ${!attempt ? `${decision ? '<details><summary>Change recorded decision</summary>' : ''}<form method="post" action="/reference/requests/${plan.id}/decision">${token(exercise)}<label>Decision<select name="disposition"><option value="authorize">Authorize this bounded demo action</option><option value="recommend">Recommend only</option><option value="decline">Decline</option><option value="defer">Defer</option></select></label><label>Your name<input name="actor" required maxlength="80"></label><label>Claimed role<input name="role" required maxlength="80" value="Demo operator"></label><label>Rationale<textarea name="rationale" maxlength="500"></textarea></label><label class="checkbox"><input type="checkbox" name="scope" value="fixture-only" required>I confirm this decision concerns only this exact artifact, disposable destination and fault. An authorization is single-use. Identity is self-declared; no real Production or organizational standing is established.</label><button>Record decision</button></form>${decision ? '</details>' : ''}` : '<p>This request has dispatched and cannot be reused.</p>'}
    ${evidence('Exact request and full artifact identity', plan)}${decision ? evidence('Decision evidence', decision) : ''}</section>
    <section class="panel"><h2>2. Explicitly apply</h2><p>Recording a decision does not execute the change.</p>${post(exercise, `/reference/requests/${plan.id}/apply`, `${action} to ${plan.candidateId}`, !!attempt || reasons.length > 0)}
    <p>Action result: <strong>${e(String(result?.data.outcome ?? (attempt ? 'unknown — terminal receipt pending' : 'not dispatched')))}</strong></p><p class="source-note">${e(String(result?.data.detail ?? 'No action result recorded.'))}</p>
    <hr><h2>3. Independently observe</h2><p>A receipt never updates the observed version. Request a fresh HTTP read after applying.</p>${post(exercise, `/reference/requests/${plan.id}/observe`, 'Observe target')}
    <p>Post-action observation: <strong>${observation?.outcome === 'observed' ? e(version(observation)) : 'Unknown'}</strong></p><p class="source-note">${observation ? `Recorded ${time(observation.recordedAt)}. Historical snapshot; ${exercise.observationCurrent(observation, plan.environmentId) ? 'current incarnation at page render' : 'refresh required for current state'}.` : 'No separate post-action read is linked to this request yet.'}</p>
    <p>${attempt ? 'Next: observe the target, then return to application detail. Any further action requires a new request.' : reasons.length ? 'Next: resolve the listed readiness or decision requirements before applying.' : 'Next: explicitly apply this authorized change. Recording the decision did not execute it.'}</p>${result ? evidence('Execution receipt / uncertainty evidence', result) : ''}${observation ? evidence('Post-action HTTP evidence', observation) : ''}</section></div>
    <details><summary>Evidence timeline</summary><ol class="timeline">${exercise.events(plan.id).map((event) => `<li><strong>${e(event.kind)}</strong> · ${time(event.recordedAt)}<p>${e(event.source)}</p>${json(event.data)}</li>`).join('')}</ol></details>`, 'reference');
}
