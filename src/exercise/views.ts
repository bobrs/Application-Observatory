import { escapeHtml as e, layout } from '../views.js';
import type { Exercise } from './controller.js';
import { candidates, candidateById, environmentById, environments, type Decision, type Observation, type Plan } from './model.js';

const csrf = (exercise: Exercise) => `<input type="hidden" name="csrf" value="${exercise.csrf}">`;
const time = (value: string) => `<time datetime="${e(value)}">${e(value.replace('T', ' ').replace('Z', ' UTC'))}</time>`;
const form = (exercise: Exercise, action: string, label: string) => `<form method="post" action="${action}">${csrf(exercise)}<button>${e(label)}</button></form>`;
const notice = `<aside class="notice"><strong>Disposable local exercise.</strong> Two bundled data samples and two owned loopback targets. A claimed role is not authenticated authority. Activation receipts, target observations and health are different facts. No Production target exists.</aside>`;
export const faultLabels: Record<string, string> = { normal: 'Normal local activation', refuse: 'Injected failure before activation', 'lost-receipt': 'Injected missing receipt after activation' };

function observation(value: Observation | null): string {
  if (!value) return '<p><strong>Unknown — not observed.</strong></p>';
  const candidate = candidates.find((item) => item.digest === value.digest);
  return `<p><strong>${value.outcome === 'unknown' ? 'Unknown — read-back unavailable' : candidate ? e(candidate.label) : 'Conflict — unrecognized bytes'}</strong>${value.generation === null ? '' : ` · generation ${value.generation}`}</p>
  <p class="source-note">${e(value.source)}<br>Observed: ${value.observedAt ? time(value.observedAt) : 'not established'}<br>Recorded: ${time(value.recordedAt)}</p>
  <details><summary>Observation scope and identity</summary><p>${e(value.detail)}</p><p class="hash">Digest: ${e(value.digest ?? 'unknown')}<br>Instance: ${e(value.instanceId)}<br>Boot: ${e(value.bootId)}</p></details>`;
}
function preamble(title: string) { return `<nav class="breadcrumbs"><a href="/">Self-catalog</a> / <a href="/exercise">Local release exercise</a></nav><p class="eyebrow">Choose. Review. Apply. Observe.</p><h1>${e(title)}</h1>${notice}`; }

export function exercisePage(exercise: Exercise): string {
  return layout('Local release exercise', `${preamble('A version. A destination.')}
  <p class="intro">Choose exactly which sample to activate, see who must decide, and read the target separately to learn what actually changed.</p>
  <div class="exercise-grid">${environments.map((env) => {
    const latest = exercise.latestObservation(env.id);
    const lastKnown = exercise.latestObservation(env.id, true);
    return `<section class="panel"><p class="eyebrow">${env.stage} stage</p><h2>${env.name}</h2><p class="source-note">Concrete disposable instance · ${e(exercise.targets.get(env.id)!.instanceId)}</p>${observation(latest)}
    ${latest?.outcome === 'unknown' && lastKnown ? `<details><summary>Earlier last-known state (historical)</summary>${observation(lastKnown)}</details>` : ''}
    <p class="fine-print">Past read-back, not live status. Health: not evaluated.</p>${form(exercise, `/exercise/observe/${env.id}`, `Observe ${env.name}`)}</section>`;
  }).join('')}</div>
  <section class="panel selection"><h2>1. Select a sample version and destination</h2><p class="source-note">The samples are data, not Observatory builds. Choosing a stage does not mean Test has passed.</p>
  <form method="post" action="/exercise/requests">${csrf(exercise)}<div class="exercise-grid"><label>Sample version<select name="candidateId">${candidates.map((candidate) => `<option value="${candidate.id}">${candidate.label} · ${candidate.digest.slice(0, 12)}</option>`).join('')}</select></label>
  <label>Concrete destination<select name="environmentId">${environments.map((env) => `<option value="${env.id}">${env.name} — ${env.stage}</option>`).join('')}<option disabled>Production — unavailable</option></select></label></div>
  <details><summary>Demonstration faults (optional, explicitly injected)</summary><label>Fixture condition<select name="fault">${Object.entries(faultLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label><p>No arbitrary failure commands or endpoints are accepted.</p></details>
  <button>Review release request</button></form></section>
  <details class="panel selection"><summary>Bundled candidate provenance</summary>${candidates.map((candidate) => `<h3>${candidate.label}</h3><p class="hash">SHA-256: ${candidate.digest}</p><p class="source-note">Source: checked-in src/exercise/model.ts data literal, hashed locally. Not Test evidence or a code commit.</p>`).join('')}</details>
  <section class="selection"><h2>Recent requests</h2>${exercise.requests().length ? `<ul>${exercise.requests().map((plan) => `<li><a href="/exercise/requests/${plan.id}">${e(candidateById(plan.candidateId).label)} → ${environmentById(plan.environmentId).name}</a> · ${time(plan.createdAt)}</li>`).join('')}</ul>` : '<p>No requests recorded. Observe a destination before reviewing a transition.</p>'}</section>`, true);
}

export function requestPage(exercise: Exercise, plan: Plan): string {
  const events = exercise.events(plan.id);
  const decision = exercise.latestDecision(plan.id)?.data as unknown as Decision | undefined;
  const attempt = exercise.attempt(plan.id);
  const receipt = events.filter((event) => event.kind === 'adapter result').at(-1);
  const readBack = exercise.readBack(plan.id);
  const blocks = exercise.actionBlocks(plan.id);
  const readiness = attempt ? [] : exercise.readiness(plan);
  const environment = environmentById(plan.environmentId);
  const matching = readBack?.outcome === 'observed' && readBack.digest === plan.candidateDigest;
  let next = 'Demo operator: record a bounded decision for this exact request.';
  if (readiness.length) next = 'Demo operator: observe the destination and create a new request; this snapshot cannot be silently refreshed.';
  else if (!blocks.length && !attempt) next = 'Demo operator: explicitly apply this exact sample to this exact destination.';
  if (attempt) next = !readBack ? 'Demo operator: observe target. A receipt does not supply target state.'
    : !matching ? 'Demo operator: investigate unavailable or conflicting read-back; do not automatically repeat the action.'
      : receipt?.data.outcome === 'unknown' ? 'Reviewer: target bytes match, but the original execution outcome is still unknown. No automatic retry.'
        : 'Reviewer: inspect the separate receipt and observation. Health and independent Test acceptance are not established.';
  return layout('Review release request', `${preamble('Review the exact transition')}
  <p class="intro">${e(candidateById(plan.candidateId).label)} → ${environment.name} <span class="tag">${environment.stage}</span></p>
  ${plan.fault !== 'normal' ? `<aside class="notice"><strong>Injected demonstration condition:</strong> ${e(faultLabels[plan.fault]!)}</aside>` : ''}
  <section class="panel"><h2>2. Readiness and bounded intent</h2><dl class="facts"><dt>Selected sample SHA-256</dt><dd class="hash">${plan.candidateDigest}</dd><dt>Concrete target instance / boot</dt><dd class="hash">${e(plan.instanceId)} / ${e(plan.bootId)}</dd><dt>Request source / time</dt><dd>Operator selection of bundled fixture data · ${time(plan.createdAt)}</dd></dl>
  <h3 class="selection">Expected state, bound at review</h3>${observation(plan.expected)}
  <h3 class="selection">Readiness</h3>${attempt ? '<p>Dispatch conditions were checked before this attempt. This request is consumed; inspect receipt and read-back below.</p>' : readiness.length ? `<ul>${readiness.map((reason) => `<li>${e(reason)}</li>`).join('')}</ul>` : '<p>Local snapshot prerequisites met. Execution still requires a fresh pre-dispatch read and target-side generation check.</p>'}
  <p class="source-note">Fixed conditions: exact payload digest; destination instance and boot; expected current digest/generation; observation and request under five minutes; single use. No free-text condition is interpreted as satisfied.</p></section>
  <div class="exercise-grid selection"><section class="panel"><h2>3. Recorded decision</h2>${decision ? `<p><strong>${e(decision.disposition)}</strong> · ${e(decision.actor)} (${e(decision.role)})</p><p>${e(decision.rationale || 'No rationale recorded.')}</p><p class="source-note">${e(decision.identity)}. Bound to this plan; expires ${time(decision.expiresAt)}.</p>` : '<p>No decision recorded. A recommendation alone cannot authorize an action.</p>'}
  ${!attempt ? `<form method="post" action="/exercise/requests/${plan.id}/decision">${csrf(exercise)}<label>Actor (self-declared)<input name="actor" required maxlength="80"></label><label>Claimed role<input name="role" value="Demo operator" required maxlength="80"></label><label>Decision<select name="disposition"><option value="recommend">Recommend only</option><option value="authorize">Authorize this local demo action</option><option value="decline">Decline</option><option value="defer">Defer</option></select></label><label>Rationale (not an executable condition)<textarea name="rationale" maxlength="500" rows="2"></textarea></label><label class="checkbox"><input type="checkbox" name="scope" value="fixture-only"> I understand this is one fixed local fixture action, not organizational or Production authority.</label><button>Record demo decision</button></form>` : '<p class="source-note">Decision scope consumed at dispatch. Any further action needs a new request.</p>'}</section>
  <section class="panel"><h2>4. Action result</h2><p><strong>${attempt ? receipt ? e(String(receipt.data.outcome)) + ' — adapter result only' : 'Dispatched — result pending or unknown' : 'Not dispatched'}</strong></p>${receipt ? `<p>${e(String(receipt.data.detail))}</p><p class="source-note">${e(receipt.source)} · ${time(receipt.recordedAt)}</p>` : ''}
  ${!attempt ? `<ul>${blocks.map((reason) => `<li>${e(reason)}</li>`).join('')}</ul><form method="post" action="/exercise/requests/${plan.id}/apply">${csrf(exercise)}<button ${blocks.length ? 'disabled' : ''}>Apply ${e(candidateById(plan.candidateId).label)} to ${environment.name}</button></form>` : '<p class="source-note">This request cannot dispatch again, including after a timeout or restart.</p>'}
  <h2 class="selection">5. Separate target read-back</h2>${readBack ? observation(readBack) : '<p><strong>Pending — no post-action observation.</strong></p>'}${readBack?.outcome === 'observed' ? `<p>${matching ? 'Observed bytes match the requested sample in this local fixture.' : 'Conflict: observed bytes differ from the requested sample. Both facts remain recorded.'}</p>` : ''}
  ${form(exercise, `/exercise/requests/${plan.id}/observe`, 'Observe target separately')}<p class="fine-print">Read-back hashes served bytes through a separate HTTP path on the same host. Health: not evaluated. Not independent organizational Test acceptance.</p></section></div>
  <aside class="notice selection"><strong>Next responsible action</strong><br>${e(next)}</aside>
  <section class="panel"><h2>Request evidence timeline</h2><p class="source-note hash">Request ${plan.id}<br>Immutable plan ${plan.hash}</p><ol class="timeline">${events.map((event) => `<li><strong>${e(event.kind)}</strong> · ${time(event.recordedAt)}<p class="source-note">${e(event.source)}</p><details><summary>Evidence and limitations</summary><pre>${e(JSON.stringify(event.data, null, 2))}</pre></details></li>`).join('')}</ol></section>`, true);
}

export function exerciseError(message: string): string {
  return layout('Exercise request refused', `${preamble('Request could not complete')}<section class="panel"><p>${e(message)}</p><p>This form did not establish a completed action. Inspect the request timeline; do not assume the target is unchanged.</p><a href="/exercise">Return to the local exercise</a></section>`, true);
}
