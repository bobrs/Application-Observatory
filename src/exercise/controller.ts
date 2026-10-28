import Database from 'better-sqlite3';
import { randomBytes, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { openCatalog } from '../catalog.js';
import { startTarget, readTarget, type Target } from './adapter.js';
import { openWorkspace, regularFile } from './workspace.js';
import { candidates, candidateById, digest, environmentById, environments, faults, lifetime, type Decision, type Event, type Fault, type Observation, type Plan, type Receipt } from './model.js';

interface ObservationRow { data: string; after_operation_id: string | null }
interface Attempt { request_id: string; operation_id: string; decision_seq: number; dispatched_at: string }

export class Exercise {
  readonly csrf = randomBytes(32).toString('hex');
  private closed = false;
  constructor(
    readonly workspace: ReturnType<typeof openWorkspace>,
    private readonly db: Database.Database,
    readonly targets: Map<string, Target>,
    private readonly clock: () => string,
  ) {}
  private event(id: string, kind: string, source: string, data: object) {
    this.db.prepare('INSERT INTO exercise_events (request_id, kind, recorded_at, source, data) VALUES (?, ?, ?, ?, ?)')
      .run(id, kind, this.clock(), source, JSON.stringify(data));
  }
  events(id: string): Event[] {
    return (this.db.prepare('SELECT * FROM exercise_events WHERE request_id = ? ORDER BY seq').all(id) as Array<{
      seq: number; kind: string; recorded_at: string; source: string; data: string;
    }>).map((row) => ({ seq: row.seq, kind: row.kind, recordedAt: row.recorded_at, source: row.source, data: JSON.parse(row.data) }));
  }
  requests(): Plan[] {
    return (this.db.prepare('SELECT plan FROM exercise_requests ORDER BY rowid DESC').all() as { plan: string }[]).map((row) => JSON.parse(row.plan) as Plan);
  }
  plan(id: string): Plan {
    const row = this.db.prepare('SELECT plan FROM exercise_requests WHERE id = ?').get(id) as { plan: string } | undefined;
    if (!row) throw new Error('Release request not found.');
    const plan = JSON.parse(row.plan) as Plan;
    const { hash, ...content } = plan;
    if (digest(JSON.stringify(content)) !== hash) throw new Error('Stored request identity is inconsistent. Create a new disposable workspace.');
    return plan;
  }
  attempt(id: string) { return this.db.prepare('SELECT * FROM exercise_attempts WHERE request_id = ?').get(id) as Attempt | undefined; }
  latestDecision(id: string) { return this.events(id).filter((event) => event.kind === 'decision').at(-1); }
  latestObservation(environmentId: string, knownOnly = false): Observation | null {
    const rows = this.db.prepare('SELECT data FROM exercise_observations WHERE environment_id = ? ORDER BY seq DESC').all(environmentId) as ObservationRow[];
    return rows.map((row) => JSON.parse(row.data) as Observation).find((item) => !knownOnly || item.outcome === 'observed') ?? null;
  }
  readBack(id: string): Observation | null {
    const attempt = this.attempt(id);
    if (!attempt) return null;
    const row = this.db.prepare('SELECT data FROM exercise_observations WHERE request_id = ? AND after_operation_id = ? ORDER BY seq DESC LIMIT 1')
      .get(id, attempt.operation_id) as ObservationRow | undefined;
    return row ? JSON.parse(row.data) as Observation : null;
  }
  async observe(environmentId: string, requestId?: string, preflight = false): Promise<Observation> {
    environmentById(environmentId);
    if (requestId && this.plan(requestId).environmentId !== environmentId) throw new Error('Observation destination does not match this request.');
    const observation = await readTarget(this.targets.get(environmentId)!, this.clock);
    const afterOperation = requestId && !preflight ? this.attempt(requestId)?.operation_id ?? null : null;
    this.db.prepare('INSERT INTO exercise_observations (environment_id, request_id, after_operation_id, recorded_at, data) VALUES (?, ?, ?, ?, ?)')
      .run(environmentId, requestId ?? null, afterOperation, observation.recordedAt, JSON.stringify(observation));
    if (requestId) this.event(requestId, preflight ? 'preflight observation' : 'target observation', observation.source, { ...observation });
    return observation;
  }
  createRequest(candidateId: string, environmentId: string, fault: string): Plan {
    const candidate = candidateById(candidateId);
    environmentById(environmentId);
    if (!faults.includes(fault as Fault)) throw new Error('Unsupported fixture demonstration condition.');
    const target = this.targets.get(environmentId)!;
    const content = {
      action: 'activate-bundled-sample' as const, criteriaVersion: 'local-fixture-v1' as const,
      id: randomUUID(), createdAt: this.clock(), candidateId, candidateDigest: candidate.digest,
      environmentId, instanceId: target.instanceId, bootId: target.bootId,
      expected: this.latestObservation(environmentId), fault: fault as Fault,
    };
    const plan = { ...content, hash: digest(JSON.stringify(content)) };
    this.db.transaction(() => {
      this.db.prepare('INSERT INTO exercise_requests (id, created_at, plan) VALUES (?, ?, ?)').run(plan.id, plan.createdAt, JSON.stringify(plan));
      this.event(plan.id, 'requested', 'Local exercise controller', { planHash: plan.hash });
    })();
    return plan;
  }
  readiness(plan: Plan): string[] {
    const reasons: string[] = [];
    const expected = plan.expected;
    const target = this.targets.get(plan.environmentId)!;
    const age = Date.parse(this.clock()) - Date.parse(plan.createdAt);
    if (plan.action !== 'activate-bundled-sample' || plan.criteriaVersion !== 'local-fixture-v1') reasons.push('Action or readiness criteria do not match this fixed fixture.');
    if (age < 0 || age > lifetime) reasons.push('Request is expired or has an invalid time. Observe and create a new request.');
    if (candidateById(plan.candidateId).digest !== plan.candidateDigest) reasons.push('Bundled payload digest no longer matches.');
    if (!expected || expected.outcome !== 'observed') reasons.push('No usable observation was bound to this request. Observe the destination and create a new request.');
    else {
      const observationAge = Date.parse(this.clock()) - Date.parse(expected.recordedAt);
      if (observationAge < 0 || observationAge > lifetime) reasons.push('Bound observation is older than five minutes or has an invalid time.');
      if (!candidates.some((candidate) => candidate.digest === expected.digest)) reasons.push('Observed bytes do not match a bundled sample.');
      if (expected.instanceId !== plan.instanceId || expected.bootId !== plan.bootId) reasons.push('Bound observation belongs to a different target incarnation.');
    }
    if (target.instanceId !== plan.instanceId || target.bootId !== plan.bootId) reasons.push('Target restarted or changed instance. Old authorizations cannot be reused.');
    const latest = this.latestObservation(plan.environmentId);
    if (expected?.outcome === 'observed' && latest && (latest.outcome !== 'observed' || latest.digest !== expected.digest
      || latest.generation !== expected.generation || latest.bootId !== expected.bootId || latest.instanceId !== expected.instanceId)) {
      reasons.push('A newer observation is unknown or contradicts the bound expected state. Observe and create a new request.');
    }
    return reasons;
  }
  decide(id: string, disposition: string, actor: string, role: string, rationale: string, confirmed: boolean) {
    const plan = this.plan(id);
    if (!['recommend', 'authorize', 'decline', 'defer'].includes(disposition)) throw new Error('Select a supported demo decision.');
    if (!actor.trim() || actor.length > 80 || !role.trim() || role.length > 80 || rationale.length > 500) throw new Error('Provide an actor and claimed role (up to 80 characters) and a rationale up to 500 characters.');
    if (this.attempt(id)) throw new Error('This request already dispatched. Create a new request for any further action.');
    if (disposition === 'authorize' && !confirmed) throw new Error('Confirm the single-use fixture-only scope.');
    const decision: Decision = {
      disposition: disposition as Decision['disposition'], actor: actor.trim(), role: role.trim(), rationale,
      planHash: plan.hash, expiresAt: new Date(Math.min(Date.parse(plan.createdAt) + lifetime, Date.parse(this.clock()) + lifetime)).toISOString(),
      identity: 'Self-declared; not authenticated organizational standing',
    };
    this.event(id, 'decision', 'Operator statement — self-declared identity', decision);
  }
  private authority(id: string, plan: Plan): string[] {
    const decision = this.latestDecision(id)?.data as unknown as Decision | undefined;
    if (!decision || decision.disposition !== 'authorize') return ['A bounded demo authorization is missing, declined, deferred or only recommended.'];
    if (decision.planHash !== plan.hash || Date.parse(decision.expiresAt) < Date.parse(this.clock())) return ['Demo authorization is expired or does not match this exact request.'];
    return [];
  }
  actionBlocks(id: string) { const plan = this.plan(id); return [...this.readiness(plan), ...this.authority(id, plan)]; }
  async apply(id: string): Promise<void> {
    const plan = this.plan(id);
    if (this.attempt(id)) return; // Durable request-level deduplication; never redispatch uncertain attempts.
    let reasons = [...this.readiness(plan), ...this.authority(id, plan)];
    if (reasons.length) { this.event(id, 'refused before dispatch', 'Controller validation', { reasons }); return; }
    const actual = await this.observe(plan.environmentId, id, true);
    if (actual.outcome !== 'observed' || actual.digest !== plan.expected?.digest || actual.generation !== plan.expected?.generation
      || actual.bootId !== plan.bootId || actual.instanceId !== plan.instanceId) reasons.push('Fresh pre-dispatch read differs from the bound expected state or is unknown. Observe and create a new request.');
    const operationId = randomUUID();
    const dispatch = this.db.transaction(() => {
      if (this.attempt(id)) return false;
      reasons = [...reasons, ...this.readiness(plan), ...this.authority(id, plan)];
      if (reasons.length) { this.event(id, 'refused before dispatch', 'Controller validation', { reasons }); return false; }
      this.db.prepare('INSERT INTO exercise_attempts (request_id, operation_id, decision_seq, dispatched_at) VALUES (?, ?, ?, ?)')
        .run(id, operationId, this.latestDecision(id)!.seq, this.clock());
      this.event(id, 'dispatched', 'Controller dispatch intent — persisted before sending', { operationId, planHash: plan.hash, action: plan.action });
      return true;
    })();
    if (!dispatch) return;
    const receipt = await this.targets.get(plan.environmentId)!.activate(plan, operationId);
    this.event(id, 'adapter result', receipt.source ?? 'Local execution evidence (not an observation)', { ...receipt, operationId });
  }
  recoverUncertainAttempts() {
    const rows = this.db.prepare('SELECT * FROM exercise_attempts').all() as Attempt[];
    for (const row of rows) {
      if (!this.events(row.request_id).some((event) => event.kind === 'adapter result')) {
        const result: Receipt = { outcome: 'unknown', detail: 'Controller restarted without a terminal receipt. No automatic redispatch; observe the target.' };
        this.event(row.request_id, 'adapter result', 'Controller recovery — missing receipt', { ...result, operationId: row.operation_id });
      }
    }
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    try { await Promise.all([...this.targets.values()].map((target) => target.stop())); }
    finally { this.db.close(); this.workspace.unlock(); }
  }
}

export async function createExercise(resume?: string, clock = () => new Date().toISOString()): Promise<Exercise> {
  const workspace = openWorkspace(resume);
  const targets = new Map<string, Target>();
  let db: Database.Database | undefined;
  try {
    for (const name of ['catalog.sqlite', 'catalog.sqlite-journal', 'catalog.sqlite-wal', 'catalog.sqlite-shm']) regularFile(join(workspace.directory, name));
    const catalog = openCatalog(workspace.directory);
    catalog.close();
    db = new Database(join(workspace.directory, 'catalog.sqlite'));
    for (const environment of environments) targets.set(environment.id, await startTarget(workspace.directory, environment.id));
    const exercise = new Exercise(workspace, db, targets, clock);
    exercise.recoverUncertainAttempts();
    return exercise;
  } catch (error) {
    await Promise.all([...targets.values()].map((target) => target.stop()));
    db?.close(); workspace.unlock();
    if (!resume) rmSync(workspace.directory, { recursive: true, force: true });
    throw error;
  }
}
