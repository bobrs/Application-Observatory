import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import type Database from 'better-sqlite3';
import { ExternalRuntimeError, type ExternalConfig, type ExternalTarget } from './external-runtime.js';

export const PROJECTION = 'observatory-projection-v1';
export const PACKET_SCHEMA = 'observatory-evidence-v1';
export const PACKET_BUDGET = 128 * 1024;
const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object'
  ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}` : JSON.stringify(value);
const token = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const fields = ['backend', 'instance', 'eventsThrough', 'directivesThrough', 'evaluatedAt', 'config', 'projection'];
type Row = Record<string, unknown>;
interface SafeRecord extends Row { id: string; kind: string; recordRef: string }
export interface Snapshot { backend: string; instance: string; eventsThrough: number; directivesThrough: number; evaluatedAt: string; config: string; projection: string }
export interface EvidenceQuery { snapshot?: Snapshot; before?: number }
const fail = (message: string, status = 400): never => { throw new ExternalRuntimeError(message, status); };
export function evidenceQuery(rawUrl: string, paging = false): EvidenceQuery {
  const raw = rawUrl.includes('?') ? rawUrl.slice(rawUrl.indexOf('?') + 1) : '';
  if (raw.length > 2048 || /%(?![a-fA-F0-9]{2})/.test(raw)) return fail('Invalid or oversized evidence query.');
  const entries = [...new URLSearchParams(raw).entries()];
  if (entries.some(([key, value]) => ![...fields, ...(paging ? ['before'] : [])].includes(key) || /[\u0000-\u001f\u007f\ufffd]/u.test(value)) || new Set(entries.map(([key]) => key)).size !== entries.length) return fail('Unsupported or repeated evidence query fields.');
  const params = Object.fromEntries(entries);
  const number = (value: string | undefined) => {
    if (!value || !/^(?:0|[1-9][0-9]{0,15})$/.test(value) || !Number.isSafeInteger(Number(value))) return fail('Invalid snapshot cutoff or cursor.');
    return Number(value);
  };
  if (!entries.length) return {};
  if (!fields.every((field) => Object.hasOwn(params, field))) return fail('A complete pinned snapshot descriptor is required.');
  if (!token.test(params.backend!) || !token.test(params.instance!) || !/^[a-f0-9]{64}$/.test(params.config!)) return fail('Invalid snapshot context.');
  const at = params.evaluatedAt!;
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(at) || !Number.isFinite(Date.parse(at)) || new Date(at).toISOString() !== at) return fail('Invalid snapshot evaluation time.');
  if (params.projection !== PROJECTION) return fail('Pinned snapshot unavailable: unsupported projection.', 409);
  return { snapshot: { backend: params.backend!, instance: params.instance!, eventsThrough: number(params.eventsThrough), directivesThrough: number(params.directivesThrough), evaluatedAt: at, config: params.config!, projection: params.projection! }, ...(params.before === undefined ? {} : { before: number(params.before) }) };
}
export const snapshotQuery = (snapshot: Snapshot) => new URLSearchParams(Object.entries(snapshot).map(([key, value]) => [key, String(value)])).toString();
function sourceIdentity() {
  try {
    const options = { cwd: new URL('../', import.meta.url), encoding: 'utf8' as const, stdio: ['ignore', 'pipe', 'ignore'] as ['ignore', 'pipe', 'ignore'], timeout: 1000 };
    const revision = execFileSync('git', ['rev-parse', 'HEAD'], options).trim();
    const dirty = !!execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], options).trim();
    if (/^[a-f0-9]{40}$/.test(revision)) return { revision, dirty, availability: 'available', meaning: 'Current renderer checkout, not frozen workload or original snapshot producer identity' };
  } catch { /* Packaged source without Git is explicitly unavailable. */ }
  return { revision: null, dirty: null, availability: 'unavailable' };
}
const projectionSource = sourceIdentity();
const uncollected = () => ({ value: null, availability: 'uncollected', provenance: 'unknown', recordRef: null });
const withheld = (recordRef: string, provenance: string) => ({ value: null, availability: 'withheld', provenance, recordRef });

// This reader has no runtime/client reference and performs SELECTs only. In particular it
// must never call the current operational state() and attach historical cursors afterward.
export class EvidenceReader {
  constructor(private readonly db: Database.Database, readonly config: ExternalConfig, private readonly now = () => new Date()) {}
  context(slug: string, targetId: string) {
    if (slug.length > 160) return fail('Pinned snapshot unavailable: application slug exceeds the bounded read-link limit.', 413);
    const application = this.config.applications.find((item) => item.slug === slug);
    const target = this.config.targets.find((item) => item.id === targetId && item.applicationId === application?.id);
    if (!application || !target) return fail('Pinned snapshot unavailable: application or target configuration is missing.', 404);
    return { application, target, base: `/applications/${encodeURIComponent(application.slug)}/targets/${encodeURIComponent(target.id)}` };
  }
  private declarations(slug: string, targetId: string) {
    const { application: a, target: t } = this.context(slug, targetId);
    return { application: { id: a.id, slug: a.slug, name: a.name, purpose: a.purpose }, target: { id: t.id, name: t.name, applicationId: t.applicationId, stage: t.stage, instanceId: t.instanceId, mode: t.mode, limitations: t.limitations, artifacts: t.artifacts.map((artifact) => ({ version: artifact.version, artifactId: artifact.artifactId })).sort((a, b) => a.version.localeCompare(b.version)) } };
  }
  private fingerprint(slug: string, targetId: string) {
    const { application, target } = this.declarations(slug, targetId);
    // All normalized product declarations for this application and selected target. Artifact
    // ordering is not meaningful; secret and filesystem configuration are not inputs.
    return createHash('sha256').update(canonical({ schemaVersion: this.config.schemaVersion, backendId: this.config.backendId, application, target })).digest('hex');
  }
  private max(table: 'external_events' | 'external_directives', column: 'seq' | 'rowid', target: ExternalTarget) {
    return Number((this.db.prepare(`SELECT COALESCE(MAX(${column}),0) AS n FROM ${table} WHERE application_id=? AND destination_id=?`).get(target.applicationId, target.id) as { n: number }).n);
  }
  private descriptor(slug: string, targetId: string, pinned?: Snapshot): Snapshot {
    const { target } = this.context(slug, targetId);
    const config = this.fingerprint(slug, targetId);
    const eventsThrough = this.max('external_events', 'seq', target);
    const directivesThrough = this.max('external_directives', 'rowid', target);
    if (!pinned) return { backend: this.config.backendId, instance: target.instanceId, eventsThrough, directivesThrough, evaluatedAt: this.now().toISOString(), config, projection: PROJECTION };
    if (pinned.config !== config || pinned.backend !== this.config.backendId || pinned.instance !== target.instanceId || pinned.projection !== PROJECTION) return fail('Pinned snapshot unavailable: product configuration or scope changed.', 409);
    for (const [table, column, through, max] of [['external_events', 'seq', pinned.eventsThrough, eventsThrough], ['external_directives', 'rowid', pinned.directivesThrough, directivesThrough]] as const) {
      if (!Number.isSafeInteger(through) || through < 0 || through > max || (through > 0 && !this.db.prepare(`SELECT 1 FROM ${table} WHERE application_id=? AND destination_id=? AND ${column}=?`).get(target.applicationId, target.id, through))) return fail('Pinned snapshot unavailable: retained ledger cutoff is missing or invalid.', 409);
    }
    return pinned;
  }
  private scope(target: ExternalTarget, snapshot: Snapshot) { return [snapshot.backend, target.applicationId, target.id, snapshot.instance]; }
  private eventRows(target: ExternalTarget, snapshot: Snapshot, clause = '', args: unknown[] = [], limit = 1, order = 'seq DESC') {
    return this.db.prepare(`SELECT * FROM external_events WHERE backend_id=? AND application_id=? AND destination_id=? AND instance_id=? AND seq<=? ${clause} ORDER BY ${order} LIMIT ?`).all(...this.scope(target, snapshot), snapshot.eventsThrough, ...args, limit) as Row[];
  }
  private directiveRows(target: ExternalTarget, snapshot: Snapshot, clause = '', args: unknown[] = [], limit = 1) {
    return this.db.prepare(`SELECT rowid AS ledger_seq,* FROM external_directives WHERE backend_id=? AND application_id=? AND destination_id=? AND instance_id=? AND rowid<=? ${clause} ORDER BY created_at DESC,rowid DESC LIMIT ?`).all(...this.scope(target, snapshot), snapshot.directivesThrough, ...args, limit) as Row[];
  }
  private recordLink(base: string, kind: 'events' | 'directives', id: string, snapshot?: Snapshot) {
    return `${base}/records/${kind}/${encodeURIComponent(id)}${snapshot ? `?${snapshotQuery(snapshot)}` : ''}`;
  }
  private relatedRef(row: Row, kind: 'events' | 'directives', id: unknown, base: string, snapshot?: Snapshot) {
    if (id === null || id === undefined) return { value: null, availability: 'uncollected' };
    if (typeof id !== 'string' || !token.test(id)) return { value: null, availability: 'missing-or-outside-snapshot' };
    const event = kind === 'events';
    const found = this.db.prepare(`SELECT 1 FROM ${event ? 'external_events' : 'external_directives'} WHERE backend_id=? AND application_id=? AND destination_id=? AND instance_id=? AND ${event ? 'event_id' : 'id'}=? ${snapshot ? `AND ${event ? 'seq' : 'rowid'}<=?` : ''}`).get(row.backend_id, row.application_id, row.destination_id, row.instance_id, id, ...(snapshot ? [event ? snapshot.eventsThrough : snapshot.directivesThrough] : []));
    return { value: found ? this.recordLink(base, kind, id, snapshot) : null, availability: found ? 'available' : 'missing-or-outside-snapshot' };
  }
  private safeRecord(row: Row, kind: 'events' | 'directives', base: string, snapshot?: Snapshot): SafeRecord {
    const id = String(kind === 'events' ? row.event_id : row.id);
    const recordRef = this.recordLink(base, kind, id, snapshot);
    const scope = { backendId: row.backend_id, applicationId: row.application_id, destinationId: row.destination_id, instanceId: row.instance_id };
    if (kind === 'directives') return { id, kind: 'directive', scope, action: row.action, version: row.version, artifactId: row.artifact_id, expectedBootId: row.expected_boot_id, createdAt: row.created_at,
      declaredOperator: withheld(recordRef, 'self-declared, unauthenticated'), rationale: withheld(recordRef, 'operator-supplied explanation'), recordRef };
    const common = { id, kind: String(row.kind), scope, directiveId: row.directive_id, directiveRef: this.relatedRef(row, 'directives', row.directive_id, base, snapshot), outcome: row.outcome,
      version: row.version, artifactId: row.artifact_id, bootId: row.boot_id, observedAt: row.observed_at, startedAt: row.started_at, finishedAt: row.finished_at, recordedAt: row.recorded_at,
      collectorSource: withheld(recordRef, 'producer-supplied declaration'), verifiedCollector: uncollected(), detail: withheld(recordRef, 'producer-supplied declaration'), recordRef };
    if (row.kind !== 'reconciliation') return common;
    const payload = JSON.parse(String(row.payload_json)) as Row;
    // Reconciliation witnesses are structured protocol fields; no raw payload text is returned.
    return { ...common, witnessEventId: payload.witnessEventId, witnessReceiptEventId: payload.witnessReceiptEventId, witnessReceiptOutcome: payload.witnessReceiptOutcome, witnessRef: this.relatedRef(row, 'events', payload.witnessEventId, base, snapshot), witnessReceiptRef: this.relatedRef(row, 'events', payload.witnessReceiptEventId, base, snapshot),
      declaredOperator: withheld(recordRef, 'self-declared, unauthenticated'), rationale: withheld(recordRef, 'operator-supplied explanation') };
  }
  private page(target: ExternalTarget, snapshot: Snapshot, base: string, kind: 'events' | 'directives', before?: number) {
    const event = kind === 'events'; const column = event ? 'seq' : 'rowid'; const table = event ? 'external_events' : 'external_directives';
    const through = event ? snapshot.eventsThrough : snapshot.directivesThrough; const cursor = before ?? through + 1; const limit = event ? 20 : 10;
    if (!Number.isSafeInteger(cursor) || cursor < 1 || cursor > through + 1) return fail('Invalid evidence page cursor.');
    const rows = this.db.prepare(`SELECT ${column} AS ledger_seq,* FROM ${table} WHERE backend_id=? AND application_id=? AND destination_id=? AND instance_id=? AND ${column}<=? AND ${column}<? ORDER BY ${column} DESC LIMIT ?`).all(...this.scope(target, snapshot), through, cursor, limit + 1) as Row[];
    const total = Number((this.db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE backend_id=? AND application_id=? AND destination_id=? AND instance_id=? AND ${column}<=?`).get(...this.scope(target, snapshot), through) as { n: number }).n);
    const selected = rows.slice(0, limit); const nextBefore = rows.length > limit ? Number(selected.at(-1)!.ledger_seq) : null;
    return { records: selected.map((row) => this.safeRecord(row, kind, base, snapshot)), total, pageSize: limit, previewTruncated: total > selected.length,
      next: nextBefore === null ? null : `${base}/records/${kind}?${snapshotQuery(snapshot)}&before=${nextBefore}`, first: `${base}/records/${kind}?${snapshotQuery(snapshot)}` };
  }
  packet(slug: string, targetId: string, pinned?: Snapshot) {
    return this.db.transaction(() => {
      const { application, target, base } = this.context(slug, targetId); const snapshot = this.descriptor(slug, targetId, pinned);
      const planned = target.mode === 'planned';
      const directive = planned ? undefined : this.directiveRows(target, snapshot)[0];
      const observation = planned ? undefined : this.eventRows(target, snapshot, "AND kind='observation'", [], 1, 'julianday(observed_at) DESC,seq DESC')[0];
      const known = planned ? undefined : this.eventRows(target, snapshot, "AND kind='observation' AND outcome='observed'", [], 1, 'julianday(observed_at) DESC,seq DESC')[0];
      const receipt = directive && this.eventRows(target, snapshot, "AND kind='receipt' AND directive_id=?", [directive.id])[0];
      const reconciliation = directive && this.eventRows(target, snapshot, "AND kind='reconciliation' AND directive_id=?", [directive.id])[0];
      const witnessPayload = reconciliation ? JSON.parse(String(reconciliation.payload_json)) as Row : undefined;
      const witness = witnessPayload && this.eventRows(target, snapshot, 'AND event_id=?', [witnessPayload.witnessEventId])[0];
      const witnessReceipt = witnessPayload?.witnessReceiptEventId ? this.eventRows(target, snapshot, 'AND event_id=?', [witnessPayload.witnessReceiptEventId])[0] : undefined;
      if (witnessPayload && (!witness || (witnessPayload.witnessReceiptEventId && !witnessReceipt))) return fail('Pinned snapshot unavailable: a retained reconciliation witness is missing.', 409);
      const at = Date.parse(snapshot.evaluatedAt);
      const fresh = !!observation && observation.outcome === 'observed' && at - Date.parse(String(observation.observed_at)) <= 300_000 && at - Date.parse(String(observation.recorded_at)) <= 300_000;
      const completed = !!directive && receipt?.outcome === 'completed';
      const postDirective = !!known && !!directive && Date.parse(String(known.observed_at)) >= Date.parse(String(directive.created_at));
      const postReceipt = !!known && !!receipt && Date.parse(String(known.observed_at)) >= Date.parse(String(receipt.finished_at));
      const newBoot = !!known && (!directive?.expected_boot_id || known.boot_id !== directive.expected_boot_id);
      const contradictory = !!(completed && postDirective && postReceipt && known && (known.artifact_id !== directive?.artifact_id || known.version !== directive?.version || !newBoot));
      const resolved = !!(completed && observation?.outcome === 'observed' && postDirective && postReceipt && newBoot && fresh && !contradictory && known?.artifact_id === directive?.artifact_id && known?.version === directive?.version);
      const reconciled = !!(witnessPayload && observation?.outcome === 'observed' && fresh && observation.instance_id === reconciliation?.instance_id && observation.boot_id === reconciliation?.boot_id && observation.artifact_id === reconciliation?.artifact_id && observation.version === reconciliation?.version
        && (receipt ? receipt.event_id === witnessPayload.witnessReceiptEventId && receipt.outcome === witnessPayload.witnessReceiptOutcome : witnessPayload.witnessReceiptEventId === null && witnessPayload.witnessReceiptOutcome === null)
        && Date.parse(String(observation.observed_at)) > Date.parse(String(directive?.created_at)) && (!receipt || Date.parse(String(observation.observed_at)) > Date.parse(String(receipt.finished_at))));
      const executionUnknown = !!directive && (!receipt || receipt.outcome === 'unknown');
      const unresolved = !!directive && (executionUnknown || (receipt?.outcome === 'completed' && !resolved)) && !reconciled;
      const ref = (row: Row | undefined, kind: 'events' | 'directives' = 'events') => row ? this.recordLink(base, kind, String(kind === 'events' ? row.event_id : row.id), snapshot) : null;
      const records = new Map<string, ReturnType<EvidenceReader['safeRecord']>>();
      for (const row of [observation, known, receipt, reconciliation, witness, witnessReceipt]) if (row) records.set(String(row.event_id), this.safeRecord(row, 'events', base, snapshot));
      const events = planned ? null : this.page(target, snapshot, base, 'events'); const directives = planned ? null : this.page(target, snapshot, base, 'directives');
      for (const record of events?.records ?? []) records.set(record.id, record);
      const directiveRecords = new Map<string, ReturnType<EvidenceReader['safeRecord']>>();
      if (directive) directiveRecords.set(String(directive.id), this.safeRecord(directive, 'directives', base, snapshot));
      for (const record of directives?.records ?? []) directiveRecords.set(record.id, record);
      const packet = { packetSchema: PACKET_SCHEMA, projectionSource, scope: { kind: 'current', backendId: snapshot.backend, applicationId: application.id, destinationId: target.id, instanceId: snapshot.instance },
        configuration: this.declarations(slug, targetId), snapshot, requestedHistoricalView: 'Client-selected cutoffs/time are a historical view, not an authenticated capture attestation.',
        facts: planned ? null : { observation: ref(observation), lastKnown: ref(known), directive: ref(directive, 'directives'), receipt: ref(receipt), reconciliation: ref(reconciliation), witness: ref(witness), witnessReceipt: ref(witnessReceipt),
          freshAtEvaluation: fresh, contradictory, executionUnknown, unresolved, reconciled, receiptCondition: !directive ? 'none' : !receipt ? 'missing' : receipt.outcome === 'unknown' ? 'unknown' : receipt.outcome === 'failed' ? 'failed' : resolved ? 'completed' : 'completed-unconfirmed',
          httpStatus: { value: null, availability: 'uncollected' }, durationMs: { value: null, availability: 'uncollected' }, health: 'not-evaluated', independentTest: 'not-evaluated' },
        attribution: { commitAuthor: uncollected(), triggerInitiator: uncollected(), deploymentActor: uncollected(), authenticatedHuman: uncollected() },
        records: [...records.values()], directives: [...directiveRecords.values()],
        preview: { events: events && { ...events, records: events.records.map((record) => record.recordRef) }, directives: directives && { ...directives, records: directives.records.map((record) => record.recordRef) } },
        links: { current: `${base}/evidence.json`, snapshot: `${base}/evidence.json?${snapshotQuery(snapshot)}`, focused: base,
          originalLocalArchives: { scope: 'logical application/destination across retained backends and incarnations; private unrestricted text, separately accessible; initial pages freeze one ledger only, legacy cross-ledger navigation leaves the pinned snapshot; use safe record/page links for pinned investigation', events: `${base}/history?through=${snapshot.eventsThrough}&before=${snapshot.eventsThrough + 1}`, directives: `${base}/directives?through=${snapshot.directivesThrough}&before=${snapshot.directivesThrough + 1}` } },
        gaps: ['Unrestricted source/detail/actor/rationale text withheld; attribution is not authenticated.', 'A receipt is separate from runtime read-back; a matching version never resolves an unknown receipt.', 'Health, independent Test, HTTP status, latency and deployment attribution are uncollected or not evaluated.', ...(planned ? ['Planned configuration only; no active runtime facts or runtime preview.'] : [])],
        completeness: { boundedManifest: false, budgetBytes: PACKET_BUDGET } };
      if (Buffer.byteLength(JSON.stringify(packet)) <= PACKET_BUDGET) return packet;
      return { ...packet, records: [], directives: [], completeness: { boundedManifest: true, budgetBytes: PACKET_BUDGET }, gaps: [...packet.gaps, 'Packet budget exceeded; use the safe single-record references and bounded pages for every selected fact.'] };
    }).deferred();
  }
  readRecord(slug: string, targetId: string, kind: 'events' | 'directives', recordId: string, pinned?: Snapshot) {
    if (!token.test(recordId)) return fail('Invalid record identifier.');
    return this.db.transaction(() => {
      const { target, base } = this.context(slug, targetId);
      const snapshot = pinned ? this.descriptor(slug, targetId, pinned) : undefined;
      const event = kind === 'events'; const column = event ? 'event_id' : 'id'; const table = event ? 'external_events' : 'external_directives';
      const row = this.db.prepare(`SELECT * FROM ${table} WHERE application_id=? AND destination_id=? AND ${column}=? ${snapshot ? `AND backend_id=? AND instance_id=? AND ${event ? 'seq' : 'rowid'}<=?` : ''}`).get(target.applicationId, target.id, recordId, ...(snapshot ? [snapshot.backend, snapshot.instance, event ? snapshot.eventsThrough : snapshot.directivesThrough] : [])) as Row | undefined;
      if (!row) return fail('Pinned snapshot unavailable: record missing or outside the requested scope/cutoff.', 404);
      return { packetSchema: PACKET_SCHEMA, snapshot: snapshot ?? null, readScope: snapshot ? 'exact pinned current backend/application/destination/incarnation' : 'logical archive across retained backends/incarnations; historical record, not current state', record: this.safeRecord(row, kind, base, snapshot) };
    }).deferred();
  }
  readPage(slug: string, targetId: string, kind: 'events' | 'directives', query: EvidenceQuery) {
    return this.db.transaction(() => {
      const { target, base } = this.context(slug, targetId); const snapshot = this.descriptor(slug, targetId, query.snapshot);
      if (target.mode === 'planned') return fail('Planned configuration has no active runtime preview; use original local archives.', 404);
      return { packetSchema: PACKET_SCHEMA, scope: 'exact current backend/application/destination/incarnation', snapshot, ...this.page(target, snapshot, base, kind, query.before) };
    }).deferred();
  }
}
