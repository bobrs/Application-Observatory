import type { FastifyInstance } from 'fastify';
import type { ExternalRuntime } from './external-runtime.js';
import { escapeHtml, layout } from './views.js';

function errorPage(message: string) { return layout('External runtime update', `<h1>External runtime update rejected</h1><p class="notice">${escapeHtml(message)}</p><a href="/applications/hello-observatory">Return to Hello Observatory</a>`); }
function form(csrf: string, targetId: string, action: 'deploy' | 'rollback', title: string, options: Array<{version:string;artifactId:string}>) {
  return `<form method="post" action="/external/targets/${encodeURIComponent(targetId)}/directives" class="external-control"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}"><input type="hidden" name="action" value="${action}"><h3>${title}</h3><label>Configured release<select required name="release">${options.map((option) => `<option value="${escapeHtml(option.version)}|${escapeHtml(option.artifactId)}">${escapeHtml(option.version)} · ${escapeHtml(option.artifactId.slice(0, 20))}…</option>`).join('')}</select></label><label>Actor <input required maxlength="120" name="actor" autocomplete="name"></label><label>Rationale <textarea required maxlength="1000" name="rationale" rows="3"></textarea></label><button type="submit">Create ${action} directive</button></form>`;
}
export function externalControls(runtime: ExternalRuntime, csrf: string): string {
  const state = runtime.state(); const { target } = state;
  const stateLabel = state.contradictory ? 'Contradictory evidence' : state.unresolved ? 'Reconciliation required' : state.fresh ? 'Fresh observation' : state.observation?.outcome === 'unknown' ? 'Unknown' : state.lastObservation ? 'Stale' : 'No observation yet';
  const failedReceiptNeedsRead = state.receipt?.outcome === 'failed' && (!state.observation || Date.parse(state.observation.observedAt ?? '') <= Date.parse(state.receipt.recordedAt));
  const canChange = !state.unresolved && (!state.directive || (state.fresh && !failedReceiptNeedsRead));
  const rollbackOptions = state.fresh && state.observation?.outcome === 'observed' ? target.artifacts.filter((artifact) => artifact.artifactId !== state.observation!.artifactId && runtime.events().some((event) => event.kind === 'observation' && event.outcome === 'observed' && event.artifactId === artifact.artifactId && Date.parse(event.observedAt ?? '') < Date.parse(state.observation!.observedAt ?? ''))) : [];
  const h = (value: unknown) => escapeHtml(String(value ?? 'Unknown'));
  const history = state.history.map(({ directive, events }) => `<details><summary>Directive ${h((directive as Record<string,unknown>).id)} · ${h((directive as Record<string,unknown>).action)} ${h((directive as Record<string,unknown>).version)}</summary><pre>${h(JSON.stringify({directive,events},null,2))}</pre></details>`).join('');
  return `<section class="panel external-runtime" id="external-runtime"><h2>External runtime · ${h(target.name)}</h2><p><strong>${stateLabel}</strong> · ${h(target.stage)} · externally managed process; health is not evaluated.</p><p>This page reads persisted evidence only. The external client separately polls directives and submits receipt or version observations; opening this page never probes or executes the target.</p>
    <dl><dt>Configured identity</dt><dd>${h(target.applicationId)} · destination ${h(target.id)} · instance ${h(target.instanceId)}</dd>
    <dt>Desired directive</dt><dd>${state.directive ? `${h(state.directive.action)} ${h(state.directive.version)} · ${h(state.directive.artifactId)} · ${h(state.directive.id)} · ${h(state.directive.createdAt)}` : 'None'}</dd>
    <dt>Declared operator and rationale</dt><dd>${state.directive ? `${h(state.directive.actor)} · ${h(state.directive.rationale)}` : 'No directive recorded.'}</dd>
    <dt>Separate receipt</dt><dd>${state.receipt ? `${h(state.receipt.outcome)} · ${h(state.receipt.recordedAt)} · ${h(state.receipt.source)} · ${h(state.receipt.detail)}` : 'No receipt received.'}</dd>
    <dt>Latest observation</dt><dd>${state.observation ? `${h(state.observation.outcome)}${state.observation.version ? ` · ${h(state.observation.version)} · ${h(state.observation.artifactId)}` : ''}${state.observation.bootId ? ` · boot ${h(state.observation.bootId)}` : ''} · observed ${h(state.observation.observedAt ?? 'Unknown')} · recorded ${h(state.observation.recordedAt)} · ${h(state.observation.source)} · ${h(state.observation.detail)}` : state.lastObservation ? `No current observation. Last observed ${h(state.lastObservation.version)} at ${h(state.lastObservation.observedAt)}; historical.` : 'No observation received.'}</dd></dl>
    ${state.unresolved ? '<p class="notice">This directive is unresolved. Do not create another change until evidence reconciles the receipt and a fresh observation.</p>' : ''}${state.contradictory ? '<p class="notice">The latest valid runtime version observation contradicts the completed directive. The discrepancy is preserved for review.</p>' : ''}${failedReceiptNeedsRead ? '<p class="notice">The failed operation needs a separate fresh observation collected after its receipt before another directive.</p>' : ''}
    ${canChange ? `<div class="external-forms">${form(csrf,target.id,'deploy','Deploy / change version',target.artifacts)}${rollbackOptions.length ? form(csrf,target.id,'rollback','Rollback to retained release',rollbackOptions) : ''}</div>` : ''}
    <p class="source-note">Artifact identities are private-config allowlisted pairs. Actor and rationale are local declarations, not authenticated organizational standing. Only one unresolved directive is allowed; unknown outcomes are never replayed automatically.</p><h3>Directive and event history</h3>${history || '<p>No external directives or events recorded.</p>'}</section>`;
}

export function externalRuntimeRoutes(app: FastifyInstance, runtime: ExternalRuntime, csrf: string) {
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_request, body, done) => {
    const params = new URLSearchParams(String(body)); const entries = [...params.entries()];
    if (new Set(entries.map(([key]) => key)).size !== entries.length) { done(new Error('Duplicate form fields are not allowed.')); return; }
    done(null, Object.fromEntries(entries));
  });
  app.get<{Params:{targetId:string}}>('/api/runtime/v1/targets/:targetId/directive', async (request, reply) => {
    try { return reply.send({schemaVersion:1,directive:runtime.directive(request.params.targetId)}); }
    catch (error) { return reply.code((error as {statusCode?:number}).statusCode ?? 404).send({error:'unknown_target'}); }
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
}
