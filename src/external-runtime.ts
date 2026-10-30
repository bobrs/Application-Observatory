import { randomUUID, timingSafeEqual } from 'node:crypto';
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import type Database from 'better-sqlite3';

export interface ExternalArtifact { version: string; artifactId: string }
export interface ExternalTarget { id: string; name: string; applicationId: string; stage: string; instanceId: string; artifacts: ExternalArtifact[] }
export interface ExternalConfig { schemaVersion: 1; backendId: string; targets: ExternalTarget[] }
export interface Directive {
  id: string; backendId: string; applicationId: string; destinationId: string; instanceId: string;
  action: 'deploy' | 'rollback'; version: string; artifactId: string; createdAt: string; expectedBootId: string | null;
}
export interface ExternalEvent {
  schemaVersion: 1; eventId: string; backendId: string; applicationId: string; destinationId: string; instanceId: string;
  directiveId: string | null; kind: 'receipt' | 'observation'; source: string; detail: string;
  outcome: 'completed' | 'failed' | 'unknown' | 'observed'; version?: string | null; artifactId?: string | null;
  bootId?: string | null; observedAt?: string; startedAt?: string; finishedAt?: string;
}
export interface ReconciliationRecord {
  schemaVersion: 1; eventId: string; backendId: string; applicationId: string; destinationId: string; instanceId: string;
  directiveId: string; kind: 'reconciliation'; source: string; detail: string; outcome: 'acknowledged';
  actor: string; rationale: string; witnessEventId: string; observedAt: string; version: string; artifactId: string; bootId: string;
  witnessReceiptEventId: string | null; witnessReceiptOutcome: 'completed' | 'failed' | 'unknown' | null; recordedAt: string;
}
export type StoredExternalEvent = (ExternalEvent & { recordedAt: string }) | (ReconciliationRecord & { recordedAt: string });
export const EXTERNAL_RECENT_EVENT_LIMIT = 20;
export const EXTERNAL_RECENT_DIRECTIVE_LIMIT = 10;
export const EXTERNAL_DIRECTIVE_EVENT_PREVIEW_LIMIT = 5;
export const EXTERNAL_HISTORY_PAGE_SIZE = 20;
export interface ExternalHistoryPage { events: StoredExternalEvent[]; pageSize: number; total: number; offset: number; through: number; nextBefore: number | null }
export interface ExternalDirectivePage { directives: Array<Record<string, unknown>>; pageSize: number; total: number; offset: number; through: number; nextBefore: number | null }
export interface ExternalTargetState {
  target: ExternalTarget; directive: (Directive & { actor: string; rationale: string }) | null;
  receipt: StoredExternalEvent | null; observation: StoredExternalEvent | null; lastObservation: StoredExternalEvent | null;
  reconciliation: ReconciliationRecord | null; reconciled: boolean; executionUnknown: boolean;
  fresh: boolean; contradictory: boolean; unresolved: boolean; history: Array<{ directive: unknown; events: StoredExternalEvent[] }>;
}

const tokenPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const digestPattern = /^sha256:[a-f0-9]{64}$/;
const versionPattern = /^[A-Za-z0-9][A-Za-z0-9.+_-]{0,63}$/;
const id = (v: unknown): v is string => typeof v === 'string' && tokenPattern.test(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
const iso = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().replace(/\.000Z$/, 'Z') === v.replace(/\.000Z$/, 'Z');
const recentOrFutureBounded = (value: string, now: number) => Date.parse(value) <= now + 30_000;
const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object'
  ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}` : JSON.stringify(value);
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

export function readExternalConfig(path = process.env.AO_EXTERNAL_CONFIG, secret = process.env.AO_EXTERNAL_TOKEN): { config: ExternalConfig; token: string } | undefined {
  if (path === undefined && secret === undefined) return undefined;
  if (!path || !secret || !isAbsolute(path) || secret.length < 24 || secret.length > 512 || /[\r\n]/.test(secret)) throw new Error('External runtime requires AO_EXTERNAL_CONFIG as an absolute private JSON file and AO_EXTERNAL_TOKEN.');
  let lexical;
  try { lexical = lstatSync(path); } catch { throw new Error('AO_EXTERNAL_CONFIG must be a readable private file.'); }
  if (lexical.isSymbolicLink()) throw new Error('AO_EXTERNAL_CONFIG must not be a symbolic link.');
  let fd: number | undefined;
  let value: unknown;
  try {
    const canonicalPath = realpathSync(path);
    fd = openSync(canonicalPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const info = fstatSync(fd);
    if (!info.isFile() || (info.mode & 0o077) !== 0 || info.size > 65_536 || info.nlink !== 1 || (process.getuid && info.uid !== process.getuid())) throw new Error('AO_EXTERNAL_CONFIG must be an owner-only regular file no larger than 64 KiB.');
    const buffer = Buffer.alloc(65_537);
    const read = readSync(fd, buffer, 0, buffer.length, 0);
    if (read > 65_536) throw new Error('AO_EXTERNAL_CONFIG must not exceed 64 KiB.');
    value = JSON.parse(buffer.toString('utf8', 0, read));
  } catch (error) {
    if (error instanceof Error && /AO_EXTERNAL_CONFIG/.test(error.message)) throw error;
    throw new Error('AO_EXTERNAL_CONFIG must be a readable private file containing valid JSON.');
  } finally {
    if (typeof fd === 'number') closeSync(fd);
  }
  const config = validateConfig(value);
  return { config, token: secret };
}

export function validateConfig(value: unknown): ExternalConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid external runtime config.');
  const v = value as Record<string, unknown>;
  if (!exactKeys(v, ['schemaVersion', 'backendId', 'targets']) || v.schemaVersion !== 1 || !id(v.backendId) || !Array.isArray(v.targets) || v.targets.length !== 1) throw new Error('External runtime config must define schemaVersion 1, one backend and one target.');
  const t = v.targets[0] as Record<string, unknown>;
  if (!t || typeof t !== 'object' || Array.isArray(t) || !exactKeys(t, ['id', 'name', 'applicationId', 'stage', 'instanceId', 'artifacts'])
    || !id(t.id) || !text(t.name, 120) || !t.name.trim() || !id(t.applicationId) || !text(t.stage, 40) || !id(t.instanceId)
    || !Array.isArray(t.artifacts) || t.artifacts.length < 1 || t.artifacts.length > 20) throw new Error('Invalid external runtime target config.');
  if (t.applicationId !== 'observatory-hello-reference' || t.stage !== 'Test') throw new Error('The alpha external runtime supports the Hello Observatory Test destination.');
  const artifacts: ExternalArtifact[] = [];
  for (const raw of t.artifacts) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid configured artifact pair.');
    const a = raw as Record<string, unknown>;
    if (!exactKeys(a, ['version', 'artifactId']) || typeof a.version !== 'string' || !versionPattern.test(a.version) || typeof a.artifactId !== 'string' || !digestPattern.test(a.artifactId)) throw new Error('Invalid configured artifact pair.');
    if (artifacts.some((old) => old.version === a.version || old.artifactId === a.artifactId)) throw new Error('Configured artifacts must be unique version/artifact pairs.');
    artifacts.push({ version: a.version, artifactId: a.artifactId });
  }
  return { schemaVersion: 1, backendId: v.backendId, targets: [{ id: t.id, name: t.name, applicationId: t.applicationId, stage: t.stage, instanceId: t.instanceId, artifacts }] };
}

export class ExternalRuntimeError extends Error { constructor(message: string, public statusCode = 400) { super(message); } }

export class ExternalRuntime {
  readonly target: ExternalTarget;
  constructor(private readonly db: Database.Database, readonly config: ExternalConfig, private readonly token: string, private readonly now = () => new Date()) { this.target = config.targets[0]!; }
  authenticate(header: unknown): boolean {
    if (typeof header !== 'string') return false;
    const match = /^Bearer ([A-Za-z0-9._~+/=-]+)$/.exec(header); if (!match) return false;
    const supplied = Buffer.from(match[1]!); const expected = Buffer.from(this.token);
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  }
  targetById(targetId: string) { if (targetId !== this.target.id) throw new ExternalRuntimeError('Unknown target.', 404); return this.target; }
  private safeEvidence(value: unknown, max: number): value is string {
    return text(value, max) && !value.includes(this.token) && !/\b(?:authorization|bearer|token|password|secret)\s*[:=]\s*\S/i.test(value);
  }
  private directives(targetId = this.target.id) {
    return this.db.prepare('SELECT * FROM external_directives WHERE destination_id=? ORDER BY created_at DESC, rowid DESC LIMIT 1').all(targetId) as Array<Record<string, unknown>>;
  }
  directive(targetId = this.target.id): Directive | null {
    this.targetById(targetId);
    const row = this.directives(targetId)[0];
    return row ? { id: String(row.id), backendId: String(row.backend_id), applicationId: String(row.application_id), destinationId: String(row.destination_id), instanceId: String(row.instance_id), action: row.action as Directive['action'], version: String(row.version), artifactId: String(row.artifact_id), createdAt: String(row.created_at), expectedBootId: row.expected_boot_id === null ? null : String(row.expected_boot_id) } : null;
  }
  createDirective(targetId: string, input: { action: unknown; version: unknown; artifactId: unknown; actor: unknown; rationale: unknown }) {
    const target = this.targetById(targetId);
    const keys = ['action', 'version', 'artifactId', 'actor', 'rationale'];
    if (!input || typeof input !== 'object' || !exactKeys(input as unknown as Record<string, unknown>, keys)) throw new ExternalRuntimeError('Unsupported directive fields.');
    if (input.action !== 'deploy' && input.action !== 'rollback') throw new ExternalRuntimeError('Select deploy or rollback.');
    if (typeof input.version !== 'string' || typeof input.artifactId !== 'string' || !target.artifacts.some((a) => a.version === input.version && a.artifactId === input.artifactId)) throw new ExternalRuntimeError('Select a configured version and artifact pair.');
    if (!text(input.actor, 120) || !input.actor.trim() || !text(input.rationale, 1000) || !input.rationale.trim()) throw new ExternalRuntimeError('Enter an actor and rationale.');
    const state = this.state();
    if (state.unresolved) throw new ExternalRuntimeError('An unresolved directive blocks another change. Refresh external evidence first.', 409);
    if (state.directive && !state.fresh) throw new ExternalRuntimeError('A fresh observation is required before another change.', 409);
    if (state.directive && state.receipt?.outcome === 'failed' && (!state.observation || Date.parse(state.observation.observedAt ?? '') <= Date.parse(state.receipt.recordedAt))) throw new ExternalRuntimeError('A new observation collected after the failed receipt is required before another change.', 409);
    if (input.action === 'rollback') {
      if (!state.fresh || !state.observation || state.observation.outcome !== 'observed') throw new ExternalRuntimeError('Rollback requires a fresh current observation.');
      if (input.artifactId === state.observation.artifactId) throw new ExternalRuntimeError('Rollback must select an earlier artifact than the current observed artifact.');
      const retainedEarlier = this.db.prepare("SELECT 1 FROM external_events WHERE destination_id=? AND kind='observation' AND outcome='observed' AND artifact_id=? AND julianday(observed_at) < julianday(?) LIMIT 1")
        .get(target.id, input.artifactId, state.observation.observedAt);
      if (!retainedEarlier) throw new ExternalRuntimeError('Rollback must select a configured artifact observed earlier on this target.');
    }
    const createdAt = this.now().toISOString();
    const expectedBootId = state.fresh ? String(state.observation!.bootId) : null;
    const id = randomUUID();
    this.db.prepare(`INSERT INTO external_directives (id,backend_id,application_id,destination_id,instance_id,action,version,artifact_id,created_at,expected_boot_id,actor,rationale) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, this.config.backendId, target.applicationId, target.id, target.instanceId, input.action, input.version, input.artifactId, createdAt, expectedBootId, input.actor.trim(), input.rationale.trim());
    return this.directive(target.id)!;
  }
  ingest(targetId: string, value: unknown): { schemaVersion: 1; accepted: true; duplicate: boolean } {
    const target = this.targetById(targetId); const now = this.now().getTime();
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ExternalRuntimeError('Event must be an object.');
    const event = value as Record<string, unknown>;
    const common = ['schemaVersion','eventId','backendId','applicationId','destinationId','instanceId','directiveId','kind','source','detail'];
    const receipt = [...common, 'outcome','artifactId','startedAt','finishedAt'];
    const observation = [...common, 'outcome','observedAt','version','artifactId','bootId'];
    if (event.kind !== 'receipt' && event.kind !== 'observation') throw new ExternalRuntimeError('Unsupported event kind.');
    if (!exactKeys(event, event.kind === 'receipt' ? receipt : observation)) throw new ExternalRuntimeError('Unsupported or missing event fields.');
    if (event.schemaVersion !== 1 || !id(event.eventId) || event.backendId !== this.config.backendId || event.applicationId !== target.applicationId || event.destinationId !== target.id || event.instanceId !== target.instanceId) throw new ExternalRuntimeError('Event identity does not match the configured backend, target and instance.');
    if (!(event.directiveId === null || id(event.directiveId)) || !this.safeEvidence(event.source, 120) || !event.source.trim() || !this.safeEvidence(event.detail, 1000)) throw new ExternalRuntimeError('Invalid event correlation or source/detail.');
    let artifactId: string | null = null; let version: string | null = null; let bootId: string | null = null; let observedAt: string | null = null; let startedAt: string | null = null; let finishedAt: string | null = null;
    if (event.kind === 'receipt') {
      if (!['completed','failed','unknown'].includes(String(event.outcome)) || !id(event.directiveId) || typeof event.artifactId !== 'string' || !digestPattern.test(event.artifactId) || !iso(event.startedAt) || !iso(event.finishedAt) || Date.parse(event.startedAt) > Date.parse(event.finishedAt)) throw new ExternalRuntimeError('Invalid receipt outcome, directive, artifact or timestamps.');
      for (const time of [event.startedAt, event.finishedAt]) if (!recentOrFutureBounded(time as string, now)) throw new ExternalRuntimeError('Receipt timestamp is unreasonably far in the future.');
      const d = this.db.prepare('SELECT * FROM external_directives WHERE id=? AND destination_id=?').get(event.directiveId, target.id) as Record<string, unknown> | undefined;
      if (!d || d.backend_id !== this.config.backendId || d.application_id !== target.applicationId || d.instance_id !== target.instanceId || d.artifact_id !== event.artifactId) throw new ExternalRuntimeError('Receipt does not match an existing directive and configured artifact.', 409);
      artifactId = event.artifactId as string; startedAt = event.startedAt as string; finishedAt = event.finishedAt as string;
      const prior = this.db.prepare("SELECT payload_json FROM external_events WHERE directive_id=? AND kind='receipt' ORDER BY seq DESC LIMIT 1").get(event.directiveId) as { payload_json: string } | undefined;
      if (prior) {
        const old = JSON.parse(prior.payload_json) as ExternalEvent;
        if (old.outcome !== event.outcome) throw new ExternalRuntimeError('Conflicting receipt is preserved as a conflict; existing receipt was not overwritten.', 409);
      }
    } else {
      if (!['observed','unknown'].includes(String(event.outcome)) || !iso(event.observedAt) || !recentOrFutureBounded(event.observedAt as string, now)) throw new ExternalRuntimeError('Invalid observation outcome or timestamp.');
      observedAt = event.observedAt as string;
      if (event.outcome === 'observed') {
        if (typeof event.version !== 'string' || typeof event.artifactId !== 'string' || typeof event.bootId !== 'string' || !id(event.bootId)) throw new ExternalRuntimeError('Observed evidence requires a configured version/artifact pair and boot identity.');
        if (!target.artifacts.some((a) => a.version === event.version && a.artifactId === event.artifactId)) throw new ExternalRuntimeError('Observation version and artifact are not a configured pair.', 409);
        version = event.version; artifactId = event.artifactId; bootId = event.bootId;
      } else if (event.version !== null || event.artifactId !== null || event.bootId !== null) throw new ExternalRuntimeError('Unknown observations must use null version, artifact and boot identifiers.');
      if (event.directiveId !== null) {
        const d = this.db.prepare('SELECT id FROM external_directives WHERE id=? AND destination_id=?').get(event.directiveId, target.id);
        if (!d) throw new ExternalRuntimeError('Observation references an unrelated directive.', 409);
      }
    }
    const normalized = { ...event } as unknown as ExternalEvent;
    const prior = this.db.prepare('SELECT payload_json FROM external_events WHERE event_id=?').get(event.eventId) as { payload_json: string } | undefined;
    if (prior) {
      if (canonical(JSON.parse(prior.payload_json)) === canonical(normalized)) return { schemaVersion: 1, accepted: true, duplicate: true };
      throw new ExternalRuntimeError('Event ID already exists with different content.', 409);
    }
    const recordedAt = this.now().toISOString();
    this.db.prepare(`INSERT INTO external_events (event_id,backend_id,application_id,destination_id,instance_id,directive_id,kind,source,detail,outcome,version,artifact_id,boot_id,observed_at,started_at,finished_at,recorded_at,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(event.eventId, event.backendId, event.applicationId, event.destinationId, event.instanceId, event.directiveId, event.kind, event.source, event.detail, event.outcome, version, artifactId, bootId, observedAt, startedAt, finishedAt, recordedAt, canonical(normalized));
    return { schemaVersion: 1, accepted: true, duplicate: false };
  }
  reconcile(targetId: string, input: { directiveId: unknown; actor: unknown; rationale: unknown }): ReconciliationRecord {
    const target = this.targetById(targetId);
    if (!input || typeof input !== 'object' || !exactKeys(input as unknown as Record<string, unknown>, ['directiveId','actor','rationale'])) throw new ExternalRuntimeError('Unsupported reconciliation fields.');
    const state = this.state(targetId);
    if (!state.directive || input.directiveId !== state.directive.id) throw new ExternalRuntimeError('Reconciliation must name the latest directive exactly.', 409);
    if (!state.unresolved) throw new ExternalRuntimeError('This directive does not need reconciliation.', 409);
    if (state.reconciled) throw new ExternalRuntimeError('This exact observation has already been reconciled.', 409);
    const witness = state.observation;
    if (!state.fresh || !witness || witness.kind !== 'observation' || witness.outcome !== 'observed') throw new ExternalRuntimeError('Reconciliation requires a fresh observed version readback.');
    if (Date.parse(witness.observedAt ?? '') <= Date.parse(state.directive.createdAt)) throw new ExternalRuntimeError('The witness must be collected after the directive was created.');
    if (state.receipt?.kind === 'receipt' && Date.parse(witness.observedAt ?? '') <= Date.parse(state.receipt.finishedAt ?? '')) throw new ExternalRuntimeError('The witness must be collected after the latest receipt finished.');
    if (!text(input.actor, 120) || !input.actor.trim() || !text(input.rationale, 1000) || !input.rationale.trim()) throw new ExternalRuntimeError('Enter an actor and rationale for reconciliation.');
    const recordedAt = this.now().toISOString(); const eventId = randomUUID();
    const record: ReconciliationRecord = {
      schemaVersion: 1, eventId, backendId: this.config.backendId, applicationId: target.applicationId, destinationId: target.id,
      instanceId: target.instanceId, directiveId: state.directive.id, kind: 'reconciliation', source: 'Local operator reconciliation',
      detail: input.rationale.trim(), outcome: 'acknowledged', actor: input.actor.trim(), rationale: input.rationale.trim(),
      witnessEventId: witness.eventId, observedAt: witness.observedAt!, version: witness.version!, artifactId: witness.artifactId!, bootId: witness.bootId!, recordedAt,
      witnessReceiptEventId: state.receipt?.kind === 'receipt' ? state.receipt.eventId : null,
      witnessReceiptOutcome: state.receipt?.kind === 'receipt' ? state.receipt.outcome as 'completed' | 'failed' | 'unknown' : null,
    };
    const { recordedAt: _recordedAt, ...payload } = record;
    this.db.prepare(`INSERT INTO external_events (event_id,backend_id,application_id,destination_id,instance_id,directive_id,kind,source,detail,outcome,version,artifact_id,boot_id,observed_at,started_at,finished_at,recorded_at,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(eventId, this.config.backendId, target.applicationId, target.id, target.instanceId, state.directive.id, 'reconciliation', record.source, record.detail, 'acknowledged', record.version, record.artifactId, record.bootId, record.observedAt, null, null, recordedAt, canonical(payload));
    return record;
  }
  state(targetId = this.target.id): ExternalTargetState {
    const target = this.targetById(targetId); const rawDirective = this.directives(targetId)[0];
    const directive = rawDirective ? { id: String(rawDirective.id), backendId: String(rawDirective.backend_id), applicationId: String(rawDirective.application_id), destinationId: String(rawDirective.destination_id), instanceId: String(rawDirective.instance_id), action: rawDirective.action as Directive['action'], version: String(rawDirective.version), artifactId: String(rawDirective.artifact_id), createdAt: String(rawDirective.created_at), expectedBootId: rawDirective.expected_boot_id === null ? null : String(rawDirective.expected_boot_id), actor: String(rawDirective.actor), rationale: String(rawDirective.rationale) } : null;
    const receiptRow = directive ? this.db.prepare("SELECT payload_json,recorded_at FROM external_events WHERE destination_id=? AND directive_id=? AND kind='receipt' ORDER BY seq DESC LIMIT 1").get(targetId, directive.id) as {payload_json:string;recorded_at:string} | undefined : undefined;
    const receipt = receiptRow ? { ...JSON.parse(receiptRow.payload_json), recordedAt: receiptRow.recorded_at } as StoredExternalEvent : null;
    const latestObservationRow = this.db.prepare("SELECT payload_json,recorded_at FROM external_events WHERE destination_id=? AND kind='observation' ORDER BY julianday(observed_at) DESC,seq DESC LIMIT 1").get(targetId) as {payload_json:string;recorded_at:string} | undefined;
    const latestKnownRow = this.db.prepare("SELECT payload_json,recorded_at FROM external_events WHERE destination_id=? AND kind='observation' AND outcome='observed' ORDER BY julianday(observed_at) DESC,seq DESC LIMIT 1").get(targetId) as {payload_json:string;recorded_at:string} | undefined;
    const observation = latestObservationRow ? { ...JSON.parse(latestObservationRow.payload_json), recordedAt: latestObservationRow.recorded_at } as StoredExternalEvent : null;
    const known = latestKnownRow ? { ...JSON.parse(latestKnownRow.payload_json), recordedAt: latestKnownRow.recorded_at } as StoredExternalEvent : null;
    const now = this.now().getTime();
    const fresh = !!observation && observation.outcome === 'observed' && now - Date.parse(observation.observedAt!) <= 300_000 && now - Date.parse(observation.recordedAt) <= 300_000;
    const completed = receipt?.directiveId === directive?.id && receipt?.outcome === 'completed';
    const postDirective = !!known && !!directive && Date.parse(known.observedAt ?? '') >= Date.parse(directive.createdAt);
    const postReceipt = !!known && receipt?.kind === 'receipt' && Date.parse(known.observedAt ?? '') >= Date.parse(receipt.finishedAt ?? '');
    const newBoot = !!known && (!directive?.expectedBootId || known.bootId !== directive.expectedBootId);
    const contradictory = !!(completed && postDirective && postReceipt && known && (known.artifactId !== directive?.artifactId || known.version !== directive?.version || !newBoot));
    const resolved = !!(completed && observation?.outcome === 'observed' && postDirective && postReceipt && newBoot && fresh && !contradictory && known?.artifactId === directive?.artifactId && known?.version === directive?.version);
    const reconciliationRow = directive ? this.db.prepare("SELECT payload_json,recorded_at FROM external_events WHERE destination_id=? AND directive_id=? AND kind='reconciliation' ORDER BY seq DESC LIMIT 1").get(targetId,directive.id) as {payload_json:string;recorded_at:string} | undefined : undefined;
    const reconciliation = reconciliationRow ? { ...JSON.parse(reconciliationRow.payload_json), recordedAt: reconciliationRow.recorded_at } as ReconciliationRecord : null;
    const reconciled = !!(reconciliation && observation?.kind === 'observation' && observation.outcome === 'observed' && fresh
      && observation.instanceId === reconciliation.instanceId && observation.bootId === reconciliation.bootId && observation.artifactId === reconciliation.artifactId && observation.version === reconciliation.version
      && (receipt?.kind === 'receipt' ? receipt.directiveId === reconciliation.directiveId && receipt.eventId === reconciliation.witnessReceiptEventId && receipt.outcome === reconciliation.witnessReceiptOutcome : reconciliation.witnessReceiptEventId === null && reconciliation.witnessReceiptOutcome === null)
      && Date.parse(observation.observedAt ?? '') > Date.parse(directive?.createdAt ?? '')
      && (receipt?.kind !== 'receipt' || Date.parse(observation.observedAt ?? '') > Date.parse(receipt.finishedAt ?? '')));
    const executionUnknown = !!directive && (!receipt || receipt.outcome === 'unknown');
    const baseUnresolved = !!directive && (executionUnknown || (receipt?.outcome === 'completed' && !resolved));
    const unresolved = baseUnresolved && !reconciled;
    const directives = this.db.prepare('SELECT * FROM external_directives WHERE destination_id=? ORDER BY created_at DESC,rowid DESC LIMIT ?').all(targetId, EXTERNAL_RECENT_DIRECTIVE_LIMIT) as Array<Record<string, unknown>>;
    const history = directives.map((d) => ({ directive: d, events: (this.db.prepare('SELECT payload_json,recorded_at FROM external_events WHERE directive_id=? ORDER BY seq DESC LIMIT ?').all(d.id, EXTERNAL_DIRECTIVE_EVENT_PREVIEW_LIMIT) as Array<{payload_json:string;recorded_at:string}>).map((row) => ({ ...JSON.parse(row.payload_json), recordedAt: row.recorded_at }) as StoredExternalEvent) }));
    return { target, directive, receipt, observation, lastObservation: known, reconciliation, reconciled, executionUnknown, fresh, contradictory, unresolved, history };
  }
  events(targetId = this.target.id) { this.targetById(targetId); return (this.db.prepare('SELECT payload_json,recorded_at FROM external_events WHERE destination_id=? ORDER BY seq DESC LIMIT ?').all(targetId, EXTERNAL_RECENT_EVENT_LIMIT) as Array<{payload_json:string;recorded_at:string}>).map((row) => ({ ...JSON.parse(row.payload_json), recordedAt: row.recorded_at }) as StoredExternalEvent); }
  hasEarlierObservedArtifact(targetId: string, artifactId: string, beforeObservedAt: string): boolean {
    this.targetById(targetId);
    return !!this.db.prepare("SELECT 1 FROM external_events WHERE destination_id=? AND kind='observation' AND outcome='observed' AND artifact_id=? AND julianday(observed_at) < julianday(?) LIMIT 1")
      .get(targetId, artifactId, beforeObservedAt);
  }
  historyPage(targetId: string, through?: number, before?: number): ExternalHistoryPage {
    this.targetById(targetId);
    const max = Number((this.db.prepare('SELECT COALESCE(MAX(seq),0) AS n FROM external_events WHERE destination_id=?').get(targetId) as {n:number}).n);
    const snapshot = through ?? max;
    const cursor = before ?? (snapshot + 1);
    if (!Number.isSafeInteger(snapshot) || snapshot < 0 || snapshot > max || !Number.isSafeInteger(cursor) || cursor < 1 || cursor > snapshot + 1) throw new ExternalRuntimeError('Invalid event-history snapshot or cursor.');
    const total = Number((this.db.prepare('SELECT COUNT(*) AS count FROM external_events WHERE destination_id=? AND seq<=?').get(targetId, snapshot) as {count:number}).count);
    const offset = Number((this.db.prepare('SELECT COUNT(*) AS count FROM external_events WHERE destination_id=? AND seq<=? AND seq>=?').get(targetId, snapshot, cursor) as {count:number}).count);
    const rows = this.db.prepare('SELECT seq,payload_json,recorded_at FROM external_events WHERE destination_id=? AND seq<=? AND seq<? ORDER BY seq DESC LIMIT ?')
      .all(targetId, snapshot, cursor, EXTERNAL_HISTORY_PAGE_SIZE + 1) as Array<{seq:number;payload_json:string;recorded_at:string}>;
    const nextBefore = rows.length > EXTERNAL_HISTORY_PAGE_SIZE ? rows[EXTERNAL_HISTORY_PAGE_SIZE - 1]!.seq : null;
    const selected = rows.slice(0, EXTERNAL_HISTORY_PAGE_SIZE);
    return { events: selected.map((row) => ({ ...JSON.parse(row.payload_json), recordedAt: row.recorded_at }) as StoredExternalEvent), pageSize: EXTERNAL_HISTORY_PAGE_SIZE, total, offset, through: snapshot, nextBefore };
  }
  directivePage(targetId: string, through?: number, before?: number): ExternalDirectivePage {
    this.targetById(targetId);
    const max = Number((this.db.prepare('SELECT COALESCE(MAX(rowid),0) AS n FROM external_directives WHERE destination_id=?').get(targetId) as {n:number}).n);
    const snapshot = through ?? max;
    const cursor = before ?? (snapshot + 1);
    if (!Number.isSafeInteger(snapshot) || snapshot < 0 || snapshot > max || !Number.isSafeInteger(cursor) || cursor < 1 || cursor > snapshot + 1) throw new ExternalRuntimeError('Invalid directive-history snapshot or cursor.');
    const total = Number((this.db.prepare('SELECT COUNT(*) AS count FROM external_directives WHERE destination_id=? AND rowid<=?').get(targetId, snapshot) as {count:number}).count);
    const offset = Number((this.db.prepare('SELECT COUNT(*) AS count FROM external_directives WHERE destination_id=? AND rowid<=? AND rowid>=?').get(targetId, snapshot, cursor) as {count:number}).count);
    const rows = this.db.prepare('SELECT rowid AS ledger_seq,* FROM external_directives WHERE destination_id=? AND rowid<=? AND rowid<? ORDER BY rowid DESC LIMIT ?')
      .all(targetId, snapshot, cursor, EXTERNAL_HISTORY_PAGE_SIZE + 1) as Array<Record<string, unknown>>;
    const nextBefore = rows.length > EXTERNAL_HISTORY_PAGE_SIZE ? Number(rows[EXTERNAL_HISTORY_PAGE_SIZE - 1]!.ledger_seq) : null;
    return { directives: rows.slice(0, EXTERNAL_HISTORY_PAGE_SIZE), pageSize: EXTERNAL_HISTORY_PAGE_SIZE, total, offset, through: snapshot, nextBefore };
  }
}
