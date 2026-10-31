import type { FastifyInstance } from 'fastify';
import { EvidenceReader, evidenceQuery, snapshotQuery } from './evidence.js';
import { comparisonPage } from './comparison-views.js';
import { ExternalRuntimeError } from './external-runtime.js';
import { escapeHtml as e, layout } from './views.js';

// A trusted protocol field can accidentally repeat the actual configured credential.
// Fail closed rather than alter a native identity or let JSON/URL escaping hide it.
function credentialGuard(credential: string) {
  const encoded = encodeURIComponent(credential);
  const normalizeEscapes = (value: string) => value.replace(/%[a-fA-F0-9]{2}/g, (part) => part.toUpperCase());
  const inspect = (value: unknown): void => {
    if (typeof value === 'string' && (value.includes(credential) || normalizeEscapes(value).includes(encoded))) throw new ExternalRuntimeError('Evidence unavailable: protected credential detected.', 409);
    if (Array.isArray(value)) { for (const item of value) inspect(item); }
    else if (value && typeof value === 'object') { for (const item of Object.values(value)) inspect(item); }
  };
  return inspect;
}

function focusedPage(reader: EvidenceReader, slug: string, targetId: string, rawUrl: string, assertSafe: (value: unknown) => void) {
  const query = evidenceQuery(rawUrl); const packet = reader.packet(slug, targetId, query.snapshot);
  assertSafe(packet);
  const { application, target, base } = reader.context(slug, targetId);
  const facts = packet.facts;
  const observation = packet.records.find((record) => record.recordRef === facts?.observation) ?? facts?.observationSummary ?? undefined;
  const known = packet.records.find((record) => record.recordRef === facts?.lastKnown) ?? facts?.lastKnownSummary ?? undefined;
  const currentVersion = facts?.freshAtEvaluation && observation?.kind === 'observation' && observation.outcome === 'observed';
  const recordSummary = (record: typeof packet.records[number]) => `<a href="${e(record.recordRef)}">Safe packet record · ${e(String(record.kind))}${'outcome' in record ? ` · ${e(String(record.outcome))}` : ''}</a><p class="source-note">${e(String(record.id))}${'recordedAt' in record ? ` · recorded ${e(String(record.recordedAt))}` : ''}</p>`;
  const fact = (label: string, ref: string | null | undefined, absent: string) => `<dt>${label}</dt><dd>${ref ? `<a href="${e(ref)}">Safe packet record</a>` : absent}</dd>`;
  const state = !facts ? 'Planned configuration' : facts.executionUnknown ? 'Version evidence and unknown execution outcome' : facts.contradictory ? 'Contradictory evidence' : facts.freshAtEvaluation ? 'Fresh version report' : observation?.kind === 'observation' && observation.outcome === 'unknown' ? 'Latest read unknown' : known ? 'Historical version only' : 'No observation received';
  const snapshotHtml = `${base}?${snapshotQuery(packet.snapshot)}`;
  const details = (record: typeof observation) => record ? `<details><summary>Full observed identity and times</summary><dl>${['version', 'artifactId', 'bootId', 'observedAt', 'recordedAt'].map((key) => `<dt>${e(key)}</dt><dd>${e(String((record as Record<string, unknown>)[key] ?? 'Unknown / null'))}</dd>`).join('')}</dl><a href="${e(record.recordRef)}">Safe packet record</a></details>` : '';
  return layout(`${application.name} · ${target.name}`, `<nav class="breadcrumbs"><a href="/environments?application=${encodeURIComponent(slug)}">Environments</a> / <a href="/applications/${encodeURIComponent(slug)}">${e(application.name)}</a> / ${e(target.stage)} / ${e(target.name)}</nav>
    <p class="eyebrow">Read-only target evidence · ${e(target.mode)}</p><h1>${e(application.name)} · ${e(target.name)}</h1><p class="intro">${e(state)}</p>
    <section class="panel target-focus"><h2>${currentVersion && observation && 'version' in observation ? `Reported version ${e(String(observation.version))}` : target.mode === 'planned' ? 'Configured only' : 'Current version unknown'}</h2>
    <p>${e(target.limitations)}</p><p class="source-note">${query.snapshot ? 'Pinned' : 'Current'} evaluation ${e(packet.snapshot.evaluatedAt)}. Evaluation is a read time, not new collection. Stage and capability are configuration declarations.</p>
    ${observation && 'observedAt' in observation ? `<p>Latest ${e(String(observation.outcome))} · collected ${e(String(observation.observedAt))} · recorded ${e(String(observation.recordedAt))}. ${facts?.freshAtEvaluation ? 'Fresh at this evaluation.' : 'No fresh current successful version established.'}</p>` : facts ? '<p>No observation received in this exact current scope.</p>' : '<p>No active runtime facts are presented for planned configuration.</p>'}
    ${known && !currentVersion && 'version' in known ? `<p>Historical last-known version ${e(String(known.version))} · collected ${e(String(known.observedAt))}. This is not a current version.</p>${details(known)}` : details(observation)}
    ${facts ? `<p>Response: ${currentVersion ? 'A successful reported version read supports responsiveness at collection only.' : 'No successful current read established.'} HTTP status and latency: uncollected. Health and independent Test: not evaluated.</p>` : ''}
    <dl><dt>Exact current scope</dt><dd>backend ${e(packet.scope.backendId)} · application ${e(packet.scope.applicationId)} · target ${e(packet.scope.destinationId)} · incarnation ${e(packet.scope.instanceId)}</dd></dl></section>
    <section class="panel evidence-handoff"><h2>Evidence handoff</h2><div class="placement-links"><a href="${e(packet.links.current)}">Open current evidence JSON</a><a href="${e(packet.links.snapshot)}" download="observatory-${e(target.id)}-snapshot.json">Download snapshot JSON</a><a href="${e(snapshotHtml)}">Open pinned target page</a><a href="${e(packet.links.compare)}">Compare this snapshot with current evidence</a></div>
    <label>Copyable snapshot link (same server; access required)<input class="snapshot-link" readonly value="${e(packet.links.snapshot)}" aria-label="Copyable snapshot link"></label>
    <p class="source-note">Pinned selection freezes both ledgers and evaluation time. A changed configuration or missing retained evidence makes the link unavailable. Save downloaded JSON for an enduring copy. Safe exports withhold unrestricted source/detail/actor/rationale. Collector identity, deployment actor, trigger initiator and commit author remain unknown / uncollected.</p></section>
    ${facts ? `<section class="panel"><h2>Intent, result and read-back</h2><dl>${fact('Desired directive', facts.directive, 'None recorded.')}${fact('Separate receipt', facts.receipt, facts.directive ? 'Result not received; execution is not established.' : 'No directive.')}${fact('Latest observation', facts.observation, 'None collected.')}${fact('Historical last-known observation', facts.lastKnown, 'None collected.')}${fact('Continuation decision', facts.reconciliation, 'None recorded.')}${fact('Original continuation witness', facts.witness, 'None recorded.')}</dl><p>Receipt condition: ${e(facts.receiptCondition)}. Execution unknown: ${facts.executionUnknown ? 'yes' : 'no'}. Contradictory: ${facts.contradictory ? 'yes' : 'no'}; freshness is separate. ${facts.reconciled ? 'Witnessed continuation is current at evaluation; the original receipt outcome remains unchanged.' : ''}</p><p>A matching read-back does not turn a missing or unknown receipt into success. These are read projections, not authorization or independent acceptance.</p></section>
    <section class="panel"><h2>Recent consequential evidence</h2><ul class="activity-list">${[...packet.directives, ...packet.records.filter((record) => record.kind !== 'observation')].sort((a, b) => String('createdAt' in b ? b.createdAt : 'recordedAt' in b ? b.recordedAt : '').localeCompare(String('createdAt' in a ? a.createdAt : 'recordedAt' in a ? a.recordedAt : ''))).slice(0, 3).map((record) => `<li>${recordSummary(record)}</li>`).join('') || (packet.completeness.boundedManifest ? '<li>Inline consequential records omitted by the packet budget; follow safe directive and event pages.</li>' : '<li>No consequential records in the bounded preview.</li>')}</ul><p class="source-note">At most three preview records. Sole unknown, contradiction and continuation witnesses remain referenced above and in the packet, including when outside the preview.</p><p>${packet.preview.events ? `<a href="${e(packet.preview.events.first)}">Safe event pages (${packet.preview.events.total} retained in current scope)</a>` : ''} · ${packet.preview.directives ? `<a href="${e(packet.preview.directives.first)}">Safe directive pages (${packet.preview.directives.total} retained in current scope)</a>` : ''}</p>${packet.completeness.boundedManifest ? '<p class="notice">Packet size budget exceeded: bounded manifest links identify every required fact. Follow safe record and page links.</p>' : ''}</section>` : ''}
    <section class="panel"><h2>Original local archives</h2><p>These separately accessible local archives retain unrestricted text. They widen scope to this logical application/target across earlier backends and incarnations; historical evidence is not current state. The initial page freezes its own ledger only. Following legacy cross-ledger links leaves the pinned snapshot; use safe record and page links above for pinned investigation.</p><p><a href="${e(packet.links.originalLocalArchives.events)}">Original local event archive</a> · <a href="${e(packet.links.originalLocalArchives.directives)}">Original local directive archive</a></p>${target.mode === 'managed' ? `<p><a href="/applications/${encodeURIComponent(slug)}#target-${encodeURIComponent(target.id)}">Existing managed controls →</a></p>` : `<p>${e(target.mode)} capability: no operational controls.</p>`}</section>
    <p><a href="${e(base)}">Refresh current target evidence</a> · <a href="/applications/${encodeURIComponent(slug)}#destination-${encodeURIComponent(target.id)}">Return to application target</a> · <a href="/environments?application=${encodeURIComponent(slug)}">Back to application environments</a></p>`, false, { active: 'environments' });
}
export function evidenceRoutes(app: FastifyInstance, reader: EvidenceReader, credential: string) {
  const assertSafe = credentialGuard(credential);
  type Params = { slug: string; targetId: string; recordId: string };
  const base = '/applications/:slug/targets/:targetId';
  app.get<{ Params: Params }>(base, async (request, reply) => {
    try {
      const html = focusedPage(reader, request.params.slug, request.params.targetId, request.raw.url ?? '', assertSafe);
      assertSafe(html);
      if (Buffer.byteLength(html) > 256 * 1024) throw new ExternalRuntimeError('Focused page exceeds the response budget; use the bounded evidence JSON.', 413);
      return reply.type('text/html').send(html);
    } catch (error) {
      return reply.code(error instanceof ExternalRuntimeError ? error.statusCode : 500).type('text/html').send(layout('Pinned snapshot unavailable', `<h1>Pinned snapshot unavailable</h1><p>${e(error instanceof ExternalRuntimeError ? error.message : 'Evidence unavailable.')}</p><a href="/environments">Return to environments</a>`));
    }
  });
  for (const format of ['compare', 'comparison.json'] as const) {
    app.get<{ Params: Params }>(`${base}/${format}`, async (request, reply) => {
      try {
        const query = evidenceQuery(request.raw.url ?? '');
        if (!query.snapshot) throw new ExternalRuntimeError('Evidence comparison requires a complete baseline snapshot descriptor.');
        const value = reader.compare(request.params.slug, request.params.targetId, query.snapshot);
        assertSafe(value);
        if (format === 'comparison.json') return reply.type('application/json').header('Referrer-Policy', 'no-referrer').header('Content-Disposition', `inline; filename="observatory-${request.params.targetId}-comparison.json"`).send(value);
        const html = comparisonPage(value); assertSafe(html);
        if (Buffer.byteLength(html) > 256 * 1024) throw new ExternalRuntimeError('Evidence comparison unavailable: HTML exceeds its bounded budget; use comparison JSON.', 413);
        return reply.type('text/html').send(html);
      } catch (error) {
        const status = error instanceof ExternalRuntimeError ? error.statusCode : 500;
        const message = error instanceof ExternalRuntimeError ? error.message : 'Evidence unavailable.';
        return format === 'comparison.json' ? reply.code(status).type('application/json').send({ error: 'Evidence comparison unavailable', message })
          : reply.code(status).type('text/html').send(layout('Evidence comparison unavailable', `<h1>Evidence comparison unavailable</h1><p>${e(message)}</p><a href="/environments">Return to environments</a>`));
      }
    });
  }
  for (const [path, kind, single] of [['/evidence.json', null, false], ['/records/events', 'events', false], ['/records/directives', 'directives', false], ['/records/events/:recordId', 'events', true], ['/records/directives/:recordId', 'directives', true]] as const) {
    app.get<{ Params: Params }>(`${base}${path}`, async (request, reply) => {
      try {
        const { slug, targetId, recordId } = request.params; const query = evidenceQuery(request.raw.url ?? '', !!kind && !single);
        const value = !kind ? reader.packet(slug, targetId, query.snapshot) : single ? reader.readRecord(slug, targetId, kind, recordId, query.snapshot) : reader.readPage(slug, targetId, kind, query);
        assertSafe(value);
        // Validated product token; never a supplied filename, path, or Content-Disposition value.
        return reply.type('application/json').header('Content-Disposition', `inline; filename="observatory-${targetId}-${kind ?? 'evidence'}.json"`).header('Referrer-Policy', 'no-referrer').send(value);
      } catch (error) {
        return reply.code(error instanceof ExternalRuntimeError ? error.statusCode : 500).type('application/json').send({ error: 'Pinned snapshot unavailable', message: error instanceof ExternalRuntimeError ? error.message : 'Evidence unavailable.' });
      }
    });
  }
}
