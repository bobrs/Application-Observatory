import type { FastifyInstance } from 'fastify';
import type { ExternalRuntime } from './external-runtime.js';
import { escapeHtml, layout } from './views.js';

function errorPage(message: string) { return layout('External runtime update', `<h1>External runtime update rejected</h1><p class="notice">${escapeHtml(message)}</p><a href="/applications/hello-observatory">Return to Hello Observatory</a>`); }
function form(csrf: string, targetId: string, action: 'deploy' | 'rollback', title: string, options: Array<{version:string;artifactId:string}>) {
  return `<form method="post" action="/external/targets/${encodeURIComponent(targetId)}/directives" class="external-control"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}"><input type="hidden" name="action" value="${action}"><h3>${title}</h3><label>Configured release<select required name="release">${options.map((option) => `<option value="${escapeHtml(option.version)}|${escapeHtml(option.artifactId)}">${escapeHtml(option.version)} · ${escapeHtml(option.artifactId.slice(0, 20))}…</option>`).join('')}</select></label><label>Actor <input required maxlength="120" name="actor" autocomplete="name"></label><label>Rationale <textarea required maxlength="1000" name="rationale" rows="3"></textarea></label><button type="submit">Create ${action} directive</button></form>`;
}
export function externalControls(runtime: ExternalRuntime, csrf: string): string {
  const state = runtime.state(); const { target } = state;
  const stateLabel = state.executionUnknown ? `Execution outcome unknown${state.reconciled ? ' · operator continuation recorded' : state.unresolved ? ' · reconciliation required' : ''}` : state.contradictory ? 'Contradictory evidence' : state.unresolved ? 'Reconciliation required' : state.fresh ? 'Fresh observation' : state.observation?.outcome === 'unknown' ? 'Unknown' : state.lastObservation ? 'Stale' : 'No observation yet';
  const failedReceiptNeedsRead = state.receipt?.outcome === 'failed' && (!state.observation || Date.parse(state.observation.observedAt ?? '') <= Date.parse(state.receipt.recordedAt));
  const canChange = !state.unresolved && (!state.directive || (state.fresh && !failedReceiptNeedsRead));
  const reconciliationNeedsRead = !!state.directive && state.unresolved && state.observation?.kind === 'observation' && state.observation.outcome === 'observed'
    && (!state.fresh || Date.parse(state.observation.observedAt ?? '') <= Date.parse(state.directive.createdAt)
      || (state.receipt?.kind === 'receipt' && Date.parse(state.observation.observedAt ?? '') <= Date.parse(state.receipt.finishedAt ?? '')));
  const canReconcile = !!state.directive && state.unresolved && state.fresh && state.observation?.kind === 'observation'
    && state.observation.outcome === 'observed' && !reconciliationNeedsRead && !state.reconciled;
  const rollbackOptions = state.fresh && state.observation?.outcome === 'observed' ? target.artifacts.filter((artifact) => artifact.artifactId !== state.observation!.artifactId && runtime.hasEarlierObservedArtifact(target.id, artifact.artifactId, state.observation!.observedAt!)) : [];
  const h = (value: unknown) => escapeHtml(String(value ?? 'Unknown'));
  const history = state.history.map(({ directive, events }) => `<details><summary>Directive ${h((directive as Record<string,unknown>).id)} · ${h((directive as Record<string,unknown>).action)} ${h((directive as Record<string,unknown>).version)}</summary><pre>${h(JSON.stringify({directive,events},null,2))}</pre></details>`).join('');
  return `<section class="panel external-runtime" id="external-runtime"><h2>External runtime · ${h(target.name)}</h2><p><strong>${stateLabel}</strong> · ${h(target.stage)} · externally managed process; health is not evaluated.</p><p>This page reads persisted evidence only. The external client separately polls directives and submits receipt or version observations; opening this page never probes or executes the target.</p>
    <dl><dt>Configured identity</dt><dd>${h(target.applicationId)} · destination ${h(target.id)} · instance ${h(target.instanceId)}</dd>
    <dt>Desired directive</dt><dd>${state.directive ? `${h(state.directive.action)} ${h(state.directive.version)} · ${h(state.directive.artifactId)} · ${h(state.directive.id)} · ${h(state.directive.createdAt)}` : 'None'}</dd>
    <dt>Declared operator and rationale</dt><dd>${state.directive ? `${h(state.directive.actor)} · ${h(state.directive.rationale)}` : 'No directive recorded.'}</dd>
    <dt>Separate receipt</dt><dd>${state.receipt ? `${h(state.receipt.outcome)} · ${h(state.receipt.recordedAt)} · ${h(state.receipt.source)} · ${h(state.receipt.detail)}` : 'No receipt received.'}</dd>
    <dt>Latest observation</dt><dd>${state.observation ? `${h(state.observation.outcome)}${state.observation.version ? ` · ${h(state.observation.version)} · ${h(state.observation.artifactId)}` : ''}${state.observation.bootId ? ` · boot ${h(state.observation.bootId)}` : ''} · observed ${h(state.observation.observedAt ?? 'Unknown')} · recorded ${h(state.observation.recordedAt)} · ${h(state.observation.source)} · ${h(state.observation.detail)}` : state.lastObservation ? `No current observation. Last observed ${h(state.lastObservation.version)} at ${h(state.lastObservation.observedAt)}; historical.` : 'No observation received.'}</dd></dl>
    ${state.reconciliation ? `<h3>Operator continuation decision</h3><p><strong>${state.reconciled ? 'Current witnessed reconciliation' : 'Historical reconciliation; current state needs a new operator acknowledgment'}</strong> · ${h(state.reconciliation.actor)} · ${h(state.reconciliation.rationale)}</p><p class="source-note">Witness event ${h(state.reconciliation.witnessEventId)} · ${h(state.reconciliation.version)} · ${h(state.reconciliation.artifactId)} · boot ${h(state.reconciliation.bootId)} · observed ${h(state.reconciliation.observedAt)} · receipt ${h(state.reconciliation.witnessReceiptOutcome ?? 'none')} / ${h(state.reconciliation.witnessReceiptEventId ?? 'none')} · recorded ${h(state.reconciliation.recordedAt)}. This does not change or resolve the receipt outcome.</p>` : ''}
    ${state.unresolved ? '<p class="notice">This directive blocks another change until an operator records a continuation decision against a fresh observed version readback. No receipt or execution success is inferred.</p>' : ''}${state.executionUnknown ? '<p class="notice">Execution outcome remains unknown. Reconciliation records an explicit operator decision against a readback; it does not retry or rewrite the directive or receipt.</p>' : ''}${state.contradictory ? '<p class="notice">The latest valid runtime version observation contradicts the completed directive. The discrepancy is preserved for review.</p>' : ''}${reconciliationNeedsRead ? '<p class="notice">Collect a fresh observed version after this directive and its receipt before recording continuation.</p>' : ''}${failedReceiptNeedsRead ? '<p class="notice">The failed operation needs a separate fresh observation collected after its receipt before another directive.</p>' : ''}
    ${canReconcile ? `<form method="post" action="/external/targets/${encodeURIComponent(target.id)}/reconcile" class="external-control reconciliation-control"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}"><input type="hidden" name="directiveId" value="${escapeHtml(state.directive!.id)}"><h3>Record continuation against this readback</h3><label>Actor <input required maxlength="120" name="actor" autocomplete="name"></label><label>Rationale <textarea required maxlength="1000" name="rationale" rows="3"></textarea></label><button type="submit">Record operator reconciliation</button></form>` : ''}
    ${canChange ? `<div class="external-forms">${form(csrf,target.id,'deploy','Deploy / change version',target.artifacts)}${rollbackOptions.length ? form(csrf,target.id,'rollback','Rollback to retained release',rollbackOptions) : ''}</div>` : ''}
    <p class="source-note">Artifact identities are private-config allowlisted pairs. Actor and rationale are local declarations, not authenticated organizational standing. Only one unresolved directive is allowed; unknown outcomes are never replayed automatically.</p><h3>Recent directive and event preview</h3>${history || '<p>No external directives or events recorded.</p>'}<p class="source-note">This preview includes at most 10 recent directives and five events per directive.</p><p><a href="/applications/hello-observatory/directives">Open complete directive ledger →</a> · <a href="/applications/hello-observatory/history">Open complete external event history →</a></p></section>`;
}

function readCursor(request: { raw: { url?: string } }, allowed: string[]) {
  const url = new URL(request.raw.url ?? '/', 'http://localhost');
  const entries = [...url.searchParams.entries()];
  if (entries.some(([key]) => !allowed.includes(key)) || new Set(entries.map(([key]) => key)).size !== entries.length) throw new Error('Unsupported or repeated history query fields.');
  const read = (key: string): number | undefined => {
    const raw = url.searchParams.get(key);
    if (raw === null) return undefined;
    if (!/^(?:0|[1-9][0-9]{0,15})$/.test(raw)) throw new Error(`Invalid ${key} cursor.`);
    const value = Number(raw);
    if (!Number.isSafeInteger(value)) throw new Error(`Invalid ${key} cursor.`);
    return value;
  };
  const through = read('through'); const before = read('before');
  if ((through === undefined) !== (before === undefined)) throw new Error('Both snapshot and cursor are required together.');
  return { through, before };
}
function cursorLinks(path: string, through: number, nextBefore: number | null, label: string) {
  return `<a href="${path}">Refresh latest snapshot</a>${nextBefore === null ? ` · Oldest ${label}` : ` · <a rel="next" href="${path}?through=${through}&amp;before=${nextBefore}">Older ${label} →</a>`}`;
}
function historyPage(runtime: ExternalRuntime, through?: number, before?: number) {
  const ledger = runtime.historyPage(runtime.target.id, through, before);
  const first = ledger.total === 0 ? 0 : ledger.offset + 1;
  const last = ledger.offset + ledger.events.length;
  const rows = ledger.events.map((event) => `<li><h2>${escapeHtml(event.kind)} · ${escapeHtml(event.outcome)}</h2><p>${escapeHtml(event.eventId)} · ${escapeHtml(event.recordedAt)}</p>${event.directiveId ? `<p><a href="/applications/hello-observatory/directives#directive-${encodeURIComponent(event.directiveId)}">Inspect associated directive</a></p>` : ''}<pre>${escapeHtml(JSON.stringify(event, null, 2))}</pre></li>`).join('');
  const navigation = `Records ${first}–${last} of ${ledger.total} in snapshot ${ledger.through} · ${ledger.pageSize} per page · ${cursorLinks('/applications/hello-observatory/history', ledger.through, ledger.nextBefore, 'events')}`;
  const scopeLabel = ledger.total > ledger.pageSize ? `This page is partial; all ${ledger.total} retained events are counted across the ledger.` : `This page contains the full retained event ledger (${ledger.total} event${ledger.total === 1 ? '' : 's'}).`;
  return layout('External event history', `<nav class="breadcrumbs"><a href="/applications/hello-observatory">Hello Observatory</a> / External event history</nav><h1>External event history</h1><p>This read-only page shows a stable snapshot of the retained event ledger in fixed pages of ${ledger.pageSize}. New events are excluded from this traversal. Opening it does not observe a target, create a record or dispatch a directive. ${scopeLabel}</p><p>${navigation}</p><ol class="activity-list">${rows || '<li>No external events recorded.</li>'}</ol><p>${navigation}</p><a href="/applications/hello-observatory/directives">Open complete directive ledger →</a> · <a href="/applications/hello-observatory#external-runtime">Return to Hello Observatory →</a>`);
}
function directivePage(runtime: ExternalRuntime, through?: number, before?: number) {
  const ledger = runtime.directivePage(runtime.target.id, through, before);
  const first = ledger.total === 0 ? 0 : ledger.offset + 1;
  const last = ledger.offset + ledger.directives.length;
  const rows = ledger.directives.map((row) => `<li id="directive-${escapeHtml(String(row.id))}"><h2>${escapeHtml(String(row.action))} ${escapeHtml(String(row.version))}</h2><dl><dt>ID</dt><dd>${escapeHtml(String(row.id))}</dd><dt>Backend</dt><dd>${escapeHtml(String(row.backend_id))}</dd><dt>Application</dt><dd>${escapeHtml(String(row.application_id))}</dd><dt>Destination</dt><dd>${escapeHtml(String(row.destination_id))}</dd><dt>Instance</dt><dd>${escapeHtml(String(row.instance_id))}</dd><dt>Created</dt><dd>${escapeHtml(String(row.created_at))}</dd><dt>Artifact</dt><dd>${escapeHtml(String(row.artifact_id))}</dd><dt>Expected boot ID</dt><dd>${escapeHtml(String(row.expected_boot_id ?? 'None recorded'))}</dd><dt>Actor</dt><dd>${escapeHtml(String(row.actor))}</dd><dt>Rationale</dt><dd>${escapeHtml(String(row.rationale))}</dd></dl><a href="/applications/hello-observatory/history">Inspect retained event history</a></li>`).join('');
  const path = '/applications/hello-observatory/directives';
  const navigation = `Records ${first}–${last} of ${ledger.total} in snapshot ${ledger.through} · ${ledger.pageSize} per page · ${cursorLinks(path, ledger.through, ledger.nextBefore, 'directives')}`;
  const scopeLabel = ledger.total > ledger.pageSize ? `This page is partial; all ${ledger.total} retained directives are counted across the ledger.` : `This page contains the full retained directive ledger (${ledger.total} directive${ledger.total === 1 ? '' : 's'}).`;
  return layout('External directive ledger', `<nav class="breadcrumbs"><a href="/applications/hello-observatory">Hello Observatory</a> / External directive ledger</nav><h1>External directive ledger</h1><p>This read-only page shows all retained directives, including directives with no events, in stable fixed pages of ${ledger.pageSize}. New directives are excluded from this traversal. Opening it does not observe a target, create a record or dispatch a directive. ${scopeLabel}</p><p>${navigation}</p><ol class="activity-list">${rows || '<li>No external directives recorded.</li>'}</ol><p>${navigation}</p><a href="/applications/hello-observatory/history">Open complete external event history →</a> · <a href="/applications/hello-observatory#external-runtime">Return to Hello Observatory →</a>`);
}

export function externalRuntimeRoutes(app: FastifyInstance, runtime: ExternalRuntime, csrf: string) {
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_request, body, done) => {
    const params = new URLSearchParams(String(body)); const entries = [...params.entries()];
    if (new Set(entries.map(([key]) => key)).size !== entries.length) { const error = new Error('Duplicate form fields are not allowed.') as Error & {statusCode:number}; error.statusCode = 400; done(error); return; }
    done(null, Object.fromEntries(entries));
  });
  app.get<{Params:{targetId:string}}>('/api/runtime/v1/targets/:targetId/directive', async (request, reply) => {
    try { return reply.send({schemaVersion:1,directive:runtime.directive(request.params.targetId)}); }
    catch (error) { return reply.code((error as {statusCode?:number}).statusCode ?? 404).send({error:'unknown_target'}); }
  });
  app.get('/applications/hello-observatory/history', async (request, reply) => {
    try { const cursor = readCursor(request, ['through','before']); return reply.type('text/html').send(historyPage(runtime, cursor.through, cursor.before)); }
    catch (error) { return reply.code((error as {statusCode?:number}).statusCode ?? 400).type('text/html').send(errorPage(error instanceof Error ? error.message : 'History page unavailable.')); }
  });
  app.get('/applications/hello-observatory/directives', async (request, reply) => {
    try { const cursor = readCursor(request, ['through','before']); return reply.type('text/html').send(directivePage(runtime, cursor.through, cursor.before)); }
    catch (error) { return reply.code((error as {statusCode?:number}).statusCode ?? 400).type('text/html').send(errorPage(error instanceof Error ? error.message : 'Directive page unavailable.')); }
  });
  app.post<{Params:{targetId:string};Body:unknown}>('/api/runtime/v1/targets/:targetId/events', async (request, reply) => {
    try { return reply.send(runtime.ingest(request.params.targetId, request.body)); }
    catch (error) { const status = (error as {statusCode?:number}).statusCode ?? 400; return reply.code(status).send({error: status === 409 ? 'conflict' : status === 404 ? 'unknown_target' : 'invalid_event', message: error instanceof Error ? error.message : 'Invalid event.'}); }
  });
  app.post<{Params:{targetId:string};Body:Record<string,string>}>('/external/targets/:targetId/directives', async (request, reply) => {
    const body = request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.values(body).some((v) => typeof v !== 'string')
      || Object.keys(body).some((key) => !['csrf','action','release','actor','rationale'].includes(key)) || body.csrf !== csrf) return reply.code(403).type('text/html').send(errorPage('Invalid form, unsupported fields or CSRF token.'));
    const [version, artifactId, extra] = (body.release ?? '').split('|');
    if (!version || !artifactId || extra) return reply.code(400).type('text/html').send(errorPage('Select one configured release pair.'));
    try { runtime.createDirective(request.params.targetId,{action:body.action,version,artifactId,actor:body.actor,rationale:body.rationale}); return reply.code(303).header('Location','/applications/hello-observatory#external-runtime').send(); }
    catch (error) { return reply.code((error as {statusCode?:number}).statusCode ?? 400).type('text/html').send(errorPage(error instanceof Error ? error.message : 'Directive rejected.')); }
  });
  app.post<{Params:{targetId:string};Body:Record<string,string>}>('/external/targets/:targetId/reconcile', async (request, reply) => {
    const body = request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.values(body).some((v) => typeof v !== 'string')
      || Object.keys(body).length !== 4 || Object.keys(body).some((key) => !['csrf','directiveId','actor','rationale'].includes(key)) || body.csrf !== csrf) return reply.code(403).type('text/html').send(errorPage('Invalid reconciliation form, unsupported fields or CSRF token.'));
    try { runtime.reconcile(request.params.targetId,{directiveId:body.directiveId,actor:body.actor,rationale:body.rationale}); return reply.code(303).header('Location','/applications/hello-observatory#external-runtime').send(); }
    catch (error) { return reply.code((error as {statusCode?:number}).statusCode ?? 400).type('text/html').send(errorPage(error instanceof Error ? error.message : 'Reconciliation rejected.')); }
  });
}
