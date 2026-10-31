import type { ApplicationView, DestinationView } from './portfolio.js';
import { escapeHtml as e, layout } from './views.js';

const evidenceValues = ['observed', 'no-observation', 'unknown', 'stale', 'contradiction', 'unresolved', 'planned', 'missing-receipt', 'unknown-receipt', 'unconfirmed', 'failed-receipt'] as const;
const modeValues = ['planned', 'observe-only', 'managed', 'local-reference'] as const;
export interface ReadFilters { application?: string; q?: string; stage?: string; evidence?: string; mode?: string }
export interface ReadSelection {
  filters: ReadFilters; all: ApplicationView[]; applications: ApplicationView[];
  totalTargets: number; matchingTargets: number; query: string;
}
export function capability(destination: DestinationView) { return destination.mode ?? (destination.disposable ? 'local-reference' : undefined); }
export function evidenceMatches(destination: DestinationView, value: string) {
  const latest = destination.externalSummary?.observation ?? destination.latestObservation ?? destination.observation;
  if (value === 'no-observation') return destination.state !== 'Planned' && !latest && !destination.lastKnown;
  if (value === 'unknown') return latest?.outcome === 'unknown';
  if (value === 'observed') return destination.observation?.outcome === 'observed' && ['Observed', 'Exception'].includes(destination.state);
  if (value === 'stale') return destination.state === 'Stale' || (!!destination.externalSummary?.contradictory && !destination.externalSummary.fresh);
  if (value === 'contradiction') return destination.state === 'Exception';
  if (value === 'unresolved') return destination.externalSummary?.unresolved ?? !!destination.uncertainRequestId;
  if (value === 'missing-receipt') return destination.receiptCondition === 'missing';
  if (value === 'unknown-receipt') return destination.receiptCondition === 'unknown';
  if (value === 'unconfirmed') return destination.receiptCondition === 'completed-unconfirmed';
  if (value === 'failed-receipt') return destination.receiptCondition === 'failed';
  return destination.state.toLowerCase() === value;
}
// Validate original URL entries, including duplicates, rather than a lossy parsed query object.
export function selectReadView(rawUrl: string, all: ApplicationView[]): ReadSelection {
  const separator = rawUrl.indexOf('?');
  const query = separator < 0 ? '' : rawUrl.slice(separator + 1);
  if (query.length > 1024 || /%(?![a-fA-F0-9]{2})/.test(query)) throw new Error('Invalid or oversized filter query (maximum 1024 characters).');
  const entries = [...new URLSearchParams(query).entries()];
  const allowed = ['application', 'q', 'stage', 'evidence', 'mode'];
  if (entries.some(([key]) => !allowed.includes(key)) || new Set(entries.map(([key]) => key)).size !== entries.length) throw new Error('Unsupported or repeated filter fields.');
  const filters: ReadFilters = {};
  for (const [key, value] of entries) {
    if (value.length > (key === 'q' ? 120 : 160) || /[\u0000-\u001f\u007f\ufffd]/u.test(value)) throw new Error(`Invalid ${key} filter.`);
    // Empty native form selections mean all; every nonempty selection must be exact.
    if (value) (filters as Record<string, string>)[key] = value;
  }
  if (filters.application && !all.some((application) => application.id === filters.application)) throw new Error('Unknown application filter.');
  if (filters.stage && !all.some((application) => application.destinations.some((target) => target.stage === filters.stage))) throw new Error('Unknown configured stage filter.');
  if (filters.evidence && !(evidenceValues as readonly string[]).includes(filters.evidence)) throw new Error('Unsupported evidence condition.');
  if (filters.mode && !(modeValues as readonly string[]).includes(filters.mode)) throw new Error('Unsupported capability filter.');
  const term = filters.q?.trim().toLowerCase();
  const placementFilter = !!(filters.stage || filters.evidence || filters.mode);
  const applications = all.flatMap((application) => {
    if (filters.application && filters.application !== application.id) return [];
    const appMatches = !term || `${application.name} ${application.id}`.toLowerCase().includes(term);
    const destinations = application.destinations.filter((target) => (appMatches || target.name.toLowerCase().includes(term!))
      && (!filters.stage || filters.stage === target.stage) && (!filters.mode || filters.mode === capability(target))
      && (!filters.evidence || evidenceMatches(target, filters.evidence)));
    return destinations.length || (!placementFilter && !application.destinations.length && appMatches) ? [{ ...application, destinations }] : [];
  });
  const normalized = new URLSearchParams(Object.entries(filters));
  return { filters, all, applications, totalTargets: all.reduce((sum, application) => sum + application.destinations.length, 0),
    matchingTargets: applications.reduce((sum, application) => sum + application.destinations.length, 0), query: normalized.size ? `?${normalized}` : '' };
}
const options = (values: Array<{ value: string; label: string }>, selected?: string) => `<option value="">All</option>${values.map(({ value, label }) => `<option value="${e(value)}"${selected === value ? ' selected' : ''}>${e(label)}</option>`).join('')}`;
export function readFilters(selection: ReadSelection, path: '/' | '/environments') {
  const { filters, all } = selection;
  const stages = [...new Set(all.flatMap((application) => application.destinations.map((target) => target.stage)))];
  return `<form class="read-filters" method="get" action="${path}" aria-label="Filter ${path === '/' ? 'applications' : 'environments'}"><label>Search apps or placements<input name="q" type="search" maxlength="120" value="${e(filters.q ?? '')}"></label><label>Application<select name="application">${options(all.map((application) => ({ value: application.id, label: application.name })), filters.application)}</select></label><label>Stage<select name="stage">${options(stages.map((stage) => ({ value: stage, label: stage })), filters.stage)}</select></label><label>Evidence condition<select name="evidence">${options(evidenceValues.map((value) => ({ value, label: ({ observed: 'Fresh version report', 'no-observation': 'No observation received', unknown: 'Latest read unknown', stale: 'Stale version', contradiction: 'Contradictory evidence', unresolved: 'Unresolved directive', planned: 'Planned metadata', 'missing-receipt': 'Result not received', 'unknown-receipt': 'Receipt unknown', unconfirmed: 'Completed, unconfirmed', 'failed-receipt': 'Receipt failed' })[value] })), filters.evidence)}</select></label><label>Capability<select name="mode">${options(modeValues.map((value) => ({ value, label: value === 'local-reference' ? 'Local reference (separate fixture)' : value })), filters.mode)}</select></label><div class="filter-actions"><button type="submit">Apply filters</button><a href="${path}">Reset filters</a></div></form>`;
}
export function readCounts(selection: ReadSelection) {
  return `<p class="source-note filter-counts">${selection.matchingTargets} matching placements of ${selection.totalTargets} configured · ${selection.applications.length} matching applications of ${selection.all.length} known. Counts include planned metadata; stage labels do not establish host identity or isolation.</p>`;
}
export const receiptLabel = (target: DestinationView) => target.receiptCondition === 'missing' ? 'Result not received' : target.receiptCondition === 'unknown' ? 'Receipt outcome unknown'
  : target.receiptCondition === 'completed-unconfirmed' ? 'Completed receipt; running version unconfirmed' : target.receiptCondition === 'completed' ? 'Completed receipt; matching fresh version read-back' : target.receiptCondition === 'failed' ? 'Failed receipt; running version is separate' : '';
const time = (value: string) => `<time datetime="${e(value)}">${e(value.replace('T', ' ').replace('Z', ' UTC'))}</time>`;
function age(value: string | null | undefined, evaluatedAt: number) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'age unknown';
  const seconds = Math.round((evaluatedAt - Date.parse(value)) / 1000);
  if (seconds < 0) return `collection clock is ${Math.abs(seconds)}s ahead of evaluation`;
  return seconds < 60 ? `${seconds}s old` : seconds < 3600 ? `${Math.floor(seconds / 60)}m old` : `${Math.floor(seconds / 3600)}h old`;
}
function placement(application: ApplicationView, target: DestinationView, evaluatedAt: number) {
  const base = `/applications/${encodeURIComponent(application.id)}`;
  const evidence = target.targetId ? `${base}/targets/${encodeURIComponent(target.targetId)}` : `${base}#destination-${encodeURIComponent(target.id)}`;
  const summary = target.externalSummary;
  const latest = summary ? summary.observation : target.latestObservation ?? target.observation;
  const fresh = !!target.observation && target.observation.outcome === 'observed' && (summary ? summary.fresh : ['Observed', 'Exception'].includes(target.state));
  const current = fresh ? target.observation : null;
  const archive = target.targetId ? `${base}/targets/${encodeURIComponent(target.targetId)}` : undefined;
  return `<article class="placement" data-placement="${e(target.id)}"><div class="placement-heading"><div><p class="eyebrow">${e(application.name)}</p><h3><a href="${e(evidence)}">${e(target.name)}</a></h3></div><span class="evidence-badge">${e(target.state)}</span></div>
    <p class="placement-version">${current ? e(current.version ?? 'Unknown') : target.state === 'Planned' ? 'Configured only' : 'Current version unknown'}${current?.digest ? `<small>Artifact ${e(`${summary ? 'sha256:' : ''}${current.digest.slice(0, 16)}`)}…</small>` : ''}</p>
    <p class="source-note">${e(target.explanation)}</p>
    ${!current && target.lastKnown ? `<p class="source-note">Historical last-known version <strong>${e(target.lastKnown.version ?? 'Unknown')}</strong> · ${target.lastKnown.observedAt ? time(target.lastKnown.observedAt) : 'Collection time unknown'}${target.lastKnown.digest ? ` · artifact ${e(target.lastKnown.digest.slice(0, 16))}…` : ''}. Not current.</p>` : ''}
    <dl class="placement-facts"><dt>Capability</dt><dd>${e(capability(target) ?? 'Unknown')} · ${target.disposable ? 'local disposable fixture; not an external managed declaration' : 'configuration declaration only'}</dd>
    <dt>Version collection</dt><dd>${latest ? `${e(latest.outcome)} · collected ${latest.observedAt ? time(latest.observedAt) : 'time unknown'} · ${e(age(latest.observedAt, evaluatedAt))}<br>Recorded by Observatory ${time(latest.recordedAt)} · ${e(age(latest.recordedAt, evaluatedAt))}<br>Reported collector/source: ${e(latest.source)}${summary ? ' (producer-supplied, unverified identity)' : ''}` : 'No observation collected; collection and recording times/source unknown.'}</dd>
    <dt>Response evidence</dt><dd>${latest?.outcome === 'observed' ? `${fresh ? 'Fresh' : 'Historical'} successful reported /version collection; this supports responsiveness only at collection.` : 'No successful current version read established; response data uncollected or unknown.'} HTTP status and latency: uncollected.</dd>
    <dt>Latest directive</dt><dd>${summary?.directive ? `${e(summary.directive.action)} ${e(summary.directive.version)} · requested ${time(summary.directive.createdAt)}<br>Declared actor: ${e(summary.directive.actor)} (self-declared, unauthenticated)` : target.localSummary ? `${e(target.recentChange?.text ?? 'Local request')} · requested ${time(target.localSummary.requestedAt)}<br>Declared actor: ${e(target.localSummary.actor ?? 'Unknown')} (self-declared, unauthenticated)${target.localSummary.decisionAt ? ` · decision recorded ${time(target.localSummary.decisionAt)}` : ''}` : 'No directive recorded in current scope.'}</dd>
    <dt>Separate receipt</dt><dd>${summary?.directive ? `${e(receiptLabel(target))}${summary.receipt ? `<br>Reported source: ${e(summary.receipt.source)} · recorded ${time(summary.receipt.recordedAt)}${summary.receipt.kind === 'receipt' && summary.receipt.finishedAt ? `<br>Operation finished ${time(summary.receipt.finishedAt)}` : ''}` : '; execution start and outcome are not established.'}` : target.localSummary ? target.localSummary.receipt ? `${e(target.localSummary.receipt.outcome)} · reported source: ${e(target.localSummary.receipt.source)} · recorded ${time(target.localSummary.receipt.recordedAt)}` : target.localSummary.dispatched ? 'Result not received; execution outcome unknown.' : 'Not dispatched; no execution result expected.' : 'No receipt for a current directive.'}</dd>
    ${summary?.reconciliation ? `<dt>Continuation decision</dt><dd>${summary.reconciled ? 'Current witnessed acknowledgment' : 'Historical acknowledgment'} by ${e(summary.reconciliation.actor)} · ${time(summary.reconciliation.recordedAt)}. Original receipt outcome is preserved.</dd>` : ''}
    </dl>
    ${summary ? `<p class="source-note scope">Current scope: backend ${e(summary.backendId)} · app ${e(summary.applicationId)} · target ${e(target.id)} · incarnation ${e(summary.instanceId)}.</p>` : ''}
    ${target.disposable ? '<p class="demo-warning">Disposable local reference · Production labels are NOT REAL PRODUCTION</p>' : ''}
    <div class="placement-links"><a href="${e(evidence)}">Target evidence →</a>${archive ? `<a href="${e(`${archive}/history`)}">Event archive</a><a href="${e(`${archive}/directives`)}">Directive archive</a>` : ''}</div></article>`;
}
export function environmentsPage(selection: ReadSelection) {
  const evaluatedAt = Date.now();
  const groups = new Map<string, Array<{ application: ApplicationView; target: DestinationView }>>();
  for (const application of selection.applications) for (const target of application.destinations) {
    const group = groups.get(target.stage) ?? []; group.push({ application, target }); groups.set(target.stage, group);
  }
  const noPlacements = selection.applications.filter((application) => !application.destinations.length);
  return layout('Environments', `<p class="eyebrow">Read-only placement overview</p><div class="register-heading"><h1>Environments</h1><a href="/${e(selection.query)}">View matching applications →</a></div><p class="intro">Where applications are placed, and what the evidence actually says.</p>
    ${readFilters(selection, '/environments')}${readCounts(selection)}
    <p class="source-note">Evaluated ${time(new Date(evaluatedAt).toISOString())}. Fresh external reports require collection and recording within five minutes. Health and independent Test acceptance are not evaluated. Commit author, trigger initiator, deployer and authenticated human: unknown / uncollected.</p>
    ${[...groups].map(([stage, rows]) => `<section class="environment-stage" data-stage="${e(stage)}"><div class="section-heading"><h2>${e(stage)}</h2><span class="count">${rows.length} matching placements of ${selection.all.flatMap((application) => application.destinations).filter((target) => target.stage === stage).length} configured · ${new Set(rows.map(({ application }) => application.id)).size} matching applications</span></div><div class="placement-grid">${rows.map(({ application, target }) => placement(application, target, evaluatedAt)).join('')}</div></section>`).join('')}
    ${noPlacements.length ? `<section class="panel no-placements"><h2>Applications without placements</h2><ul>${noPlacements.map((application) => `<li><a href="/applications/${encodeURIComponent(application.id)}">${e(application.name)}</a> · No concrete destinations connected; current version unknown.</li>`).join('')}</ul></section>` : ''}
    ${!selection.applications.length ? '<section class="panel empty-results"><h2>No matching results</h2><p>Try fewer filters or <a href="/environments">reset filters</a>.</p></section>' : ''}
    <p class="source-note">Archives retain original backend and incarnation scopes and may include earlier configurations. Focused target pages provide safe packets and pinned read links. Existing managed controls remain in application detail.</p>`, false, { active: 'environments', query: selection.query });
}
