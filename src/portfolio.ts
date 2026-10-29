import type { Application } from './catalog.js';
import type { Exercise } from './exercise/controller.js';
import { lifetime, type Observation, type Plan } from './exercise/model.js';
import { running } from './reference/target.js';

export interface Activity { at: string; text: string; source: string; requestId?: string }
export interface Directive {
  disposition: string; actor: string; role: string; rationale: string; expiresAt: string;
  identity: string; requestId?: string; scope: string; conditions: string; candidate: string; destination: string; consumed: boolean;
}
export interface DestinationView {
  id: string; name: string; stage: string; disposable: boolean;
  state: 'Unknown' | 'Stale' | 'Observed' | 'Exception'; explanation: string;
  observation: Observation | null; lastKnown: Observation | null; url?: string;
  uncertainRequestId?: string;
  recentChange?: { text: string; result: string; decision: string; requestId: string };
  evidence: unknown;
}
export interface ApplicationView {
  id: string; name: string; purpose: string; stewardship: string; kind: string;
  recognition: string; destinations: DestinationView[]; nextRole: string; nextAction: string;
  activity: Activity[]; directives: Directive[]; metadata: unknown;
}
export function groupDestinations(destinations: readonly DestinationView[]) {
  const groups = new Map<string, DestinationView[]>();
  for (const destination of destinations) {
    const group = groups.get(destination.stage) ?? [];
    group.push(destination); groups.set(destination.stage, group);
  }
  return [...groups].map(([stage, instances]) => ({ stage, instances }));
}
function changeName(plan: Plan) {
  const before = plan.expected?.version;
  if (!before) return 'Activate';
  return plan.candidateId < before ? 'Rollback' : plan.candidateId > before ? 'Upgrade' : 'Restart';
}
export function referenceView(exercise?: Exercise): ApplicationView {
  const requests = exercise?.reference ? exercise.requests() : [];
  const activity: Activity[] = [];
  const directives: Directive[] = [];
  const destinations: DestinationView[] = !exercise?.reference ? [] : exercise.environments.map((destination) => {
    const target = exercise.targets.get(destination.id)!;
    const observation = exercise.latestObservation(destination.id);
    const current = exercise.observationCurrent(observation, destination.id);
    const known = exercise.latestObservation(destination.id, true);
    const plan = requests.find((request) => request.environmentId === destination.id);
    const events = plan ? exercise.events(plan.id) : [];
    const attempt = plan ? exercise.attempt(plan.id) : undefined;
    const receipt = events.filter((event) => event.kind === 'adapter result').at(-1);
    const dispatched = requests.find((request) => request.environmentId === destination.id && exercise.attempt(request.id));
    const terminal = dispatched ? exercise.events(dispatched.id).filter((event) => event.kind === 'adapter result').at(-1) : undefined;
    const uncertainRequestId = dispatched && (!terminal || terminal.data.outcome === 'unknown') ? dispatched.id : undefined;
    const decision = plan ? exercise.latestDecision(plan.id) : undefined;
    const discrepancy = !!(plan && attempt && current && observation!.observedAt! >= attempt.dispatched_at && observation!.digest !== plan.candidateDigest);
    if (observation) activity.push({ at: observation.recordedAt,
      text: observation.outcome === 'observed' ? `${destination.name}: HTTP observed version ${observation.version}; ${current ? 'current snapshot at render' : 'historical snapshot — refresh required'}.` : `${destination.name}: current observation unavailable.`, source: observation.source });
    if (plan && decision) {
      const value = decision.data;
      directives.push({ disposition: String(value.disposition), actor: String(value.actor), role: String(value.role), rationale: String(value.rationale),
        expiresAt: String(value.expiresAt), identity: String(value.identity), requestId: plan.id, candidate: plan.candidateId,
        destination: destination.name, scope: `Reference artifact ${plan.candidateId}, ${destination.name}, original expected incarnation; injected condition ${plan.fault}.`, conditions: 'Five-minute request, observation and decision window; fresh pre-dispatch read; one use only.', consumed: !!attempt });
    }
    return { id: destination.id, name: destination.name, stage: destination.stage, disposable: true,
      state: discrepancy ? 'Exception' : current ? 'Observed' : observation?.outcome === 'observed' && running(target) ? 'Stale' : 'Unknown',
      explanation: discrepancy ? 'Observed version differs from the latest dispatched candidate; inspect the separate receipt and observation.' : current ? 'Fresh runtime-reported version, checked against the accepted artifact and owned context.' : 'Current state is unobserved, unavailable or out of date. Earlier evidence is historical.',
      ...(uncertainRequestId ? { uncertainRequestId } : {}),
      observation, lastKnown: known, ...(running(target) ? { url: target.address } : {}),
      ...(plan ? { recentChange: { text: `${changeName(plan)} to ${plan.candidateId}`, result: String(receipt?.data.outcome ?? (attempt ? 'unknown — receipt pending' : 'not dispatched')), decision: String(decision?.data.disposition ?? 'not recorded'), requestId: plan.id } } : {}),
      evidence: { instanceId: target.instanceId, currentBootId: target.bootId, latestObservation: observation,
        observationHistory: exercise.observations(destination.id), bootstrapHistory: exercise.events(`runtime:${destination.id}`) },
    };
  });
  if (exercise?.reference) for (const plan of requests.slice(0, 8)) {
    for (const event of exercise.events(plan.id).filter((item) => ['decision', 'dispatched', 'adapter result', 'refused before dispatch'].includes(item.kind))) {
      const destination = exercise.environment(plan.environmentId).name;
      const text = event.kind === 'decision' ? `${destination}: ${String(event.data.actor)} recorded ${String(event.data.disposition)} for ${plan.candidateId} (self-declared ${String(event.data.role)}).`
        : event.kind === 'adapter result' ? `${destination}: launcher reported ${String(event.data.outcome)} for ${plan.candidateId}; separate observation required.`
        : event.kind === 'dispatched' ? `${destination}: change to ${plan.candidateId} dispatched; this is not a running-version observation.`
        : `${destination}: request refused before dispatch; no operation was sent.`;
      activity.push({ at: event.recordedAt, text, source: event.source, requestId: plan.id });
    }
  }
  const now = Date.now();
  const pending = requests.find((plan) => !exercise!.attempt(plan.id) && Date.parse(plan.createdAt) <= now
    && Date.parse(plan.createdAt) + lifetime >= now && exercise!.latestDecision(plan.id)?.data.disposition !== 'decline');
  const needsObservation = destinations.some((destination) => destination.state !== 'Observed');
  const nextAction = !exercise?.reference ? 'Start a disposable reference session to connect local destinations; no runtime is observed here.'
    : needsObservation ? 'Refresh observations and inspect any unavailable, stale or conflicting destination before proposing another change.'
    : destinations.some((destination) => destination.uncertainRequestId) ? 'Inspect the unknown execution outcome and separate observed state. Do not replay the consumed request; any further change needs a new decision.'
    : pending ? exercise.actionBlocks(pending.id).length ? 'Review the proposed change and its decision/readiness conditions; no action is implied by a proposal.' : 'Explicitly apply the bounded authorized request, or revise the decision. Recording it did not execute anything.'
    : 'Select an exact accepted version and destination if a change is needed; otherwise no release decision is pending.';
  return { id: 'hello-observatory', name: 'Hello Observatory', purpose: 'Make actual software versions visible across disposable local destinations.',
    stewardship: 'Repository owner / demo operator (roles; no separately authenticated individual)', kind: 'Disposable reference application',
    recognition: 'Known from the bundled, accepted reference definition; catalog recognition is not operational approval or health.',
    destinations, nextRole: 'Local demo operator', nextAction, activity: activity.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6), directives,
    metadata: { sourceType: 'Bundled reference definition — not a database seed, runtime observation or registration timestamp',
      repository: 'https://github.com/bobrs/observatory-hello-reference', acceptedSource: 'da5731368d49c0426fd57a52588ff3db3e4a69e2',
      source: 'https://github.com/bobrs/observatory-hello-reference/blob/da5731368d49c0426fd57a52588ff3db3e4a69e2/PROJECT.md',
      scope: 'Only the three accepted artifacts and three existing owned local destinations may execute. Presentation supports other counts without creating runtime targets.' },
  };
}
export function portfolioViews(applications: Application[], exercise?: Exercise): ApplicationView[] {
  return [...applications.map((application): ApplicationView => ({ id: application.id, name: application.name, purpose: application.purpose,
    stewardship: application.stewardship, kind: application.id === 'application-observatory' ? 'Self-entry' : 'Registered record',
    recognition: 'Seeded project metadata; not an operational observation or independent verification.', destinations: [],
    nextRole: 'Product Sponsor / steward', nextAction: 'Decide whether scoped operational observations are needed. No current release decision is recorded.',
    activity: [], directives: [], metadata: application,
  })), referenceView(exercise)];
}
