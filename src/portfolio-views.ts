import { escapeHtml as e, layout } from './views.js';
import { readCounts, readFilters, receiptLabel, type ReadSelection } from './read-navigation.js';
import { groupDestinations, type ApplicationView, type DestinationView } from './portfolio.js';
export const time = (value: string) => `<time datetime="${e(value)}">${e(value.replace('T', ' ').replace('Z', ' UTC'))}</time>`;
const json = (value: unknown) => `<pre>${e(JSON.stringify(value, null, 2))}</pre>`;
function locationSummary(application: ApplicationView) {
  const groups = groupDestinations(application.destinations);
  if (!groups.length) return '<p class="portfolio-state"><strong>Unknown</strong> · No concrete destinations connected. No running version established.</p>';
  return `<ul class="stage-summary">${groups.slice(0, 3).map(({ stage, instances }) => {
    const current = instances.filter((instance) => ['Observed', 'Exception'].includes(instance.state) && instance.observation?.outcome === 'observed');
    const versions = [...new Set(current.map((instance) => instance.observation!.version))];
    const planned = instances.filter((instance) => instance.state === 'Planned').length;
    const unknown = instances.length - current.length - planned;
    return `<li><strong>${e(stage)}${stage === 'Production' && instances.some((instance) => instance.disposable) ? ' · demo' : ''}</strong>: ${instances.length} instance${instances.length === 1 ? '' : 's'} · ${versions.length ? e(versions.slice(0, 2).join(', ')) : 'Unknown'}${versions.length > 2 ? '…' : ''}${unknown ? ` · ${unknown} unknown/stale` : ''}${planned ? ` · ${planned} planned metadata-only` : ''}</li>`;
  }).join('')}${groups.length > 3 ? `<li>${groups.length - 3} more stage groups in application detail.</li>` : ''}</ul>`;
}
function attention(application: ApplicationView) {
  if (!application.destinations.length) return 'No operational evidence; recognition does not establish readiness.';
  const uncertain = application.destinations.filter((destination) => !['Observed', 'Planned'].includes(destination.state));
  const planned = application.destinations.filter((destination) => destination.state === 'Planned').length;
  const results: string[] = [];
  const unconfirmed = application.destinations.filter((destination) => destination.receiptCondition === 'completed-unconfirmed').length;
  const missing = application.destinations.filter((destination) => destination.receiptCondition === 'missing').length;
  const unknownReceipt = application.destinations.filter((destination) => destination.receiptCondition === 'unknown').length;
  const unknownExecution = application.destinations.filter((destination) => destination.uncertainRequestId && !destination.receiptCondition).length;
  if (unconfirmed) results.push(`${unconfirmed} completed receipt${unconfirmed === 1 ? '' : 's'}; running version unconfirmed`);
  if (missing) results.push(`${missing} result${missing === 1 ? '' : 's'} not received`);
  if (unknownReceipt) results.push(`${unknownReceipt} receipt outcome${unknownReceipt === 1 ? '' : 's'} unknown`);
  if (unknownExecution) results.push(`${unknownExecution} execution outcome${unknownExecution === 1 ? '' : 's'} unknown`);
  if (results.length) return `${results.join(' · ')}. ${uncertain.length} version snapshots unknown/stale/conflicting. Keep receipts and observations separate.${planned ? ` ${planned} planned metadata-only.` : ''}`;
  return uncertain.length ? `${uncertain.length} destination${uncertain.length === 1 ? '' : 's'} need attention: ${[...new Set(uncertain.map((destination) => destination.state.toLowerCase()))].join(', ')}.${planned ? ` ${planned} planned metadata-only.` : ''}` : planned ? `${planned} planned metadata-only; observed versions remain separate. Health and independent Test acceptance remain unknown.` : 'Version snapshots available. Health and independent Test acceptance remain unknown.';
}
function compactLocation(application: ApplicationView) {
  const destinations = application.destinations;
  if (!destinations.length) return 'Unknown · No operational destinations observed';
  const current = destinations.filter((item) => ['Observed', 'Exception'].includes(item.state) && item.observation?.outcome === 'observed');
  const planned = destinations.filter((item) => item.state === 'Planned').length;
  const uncertain = destinations.length - current.length - planned;
  if (destinations.length <= 3 && !uncertain && !planned) return groupDestinations(destinations).map(({ stage, instances }) => {
    const label = stage === 'Development' ? 'Dev' : stage === 'Production' && instances.some((item) => item.disposable) ? 'Demo Prod' : stage;
    return `${label} ${[...new Set(instances.map((item) => item.observation?.version ?? 'Unknown'))].join(', ')}`;
  }).join(' · ');
  return `${destinations.length} destinations · ${new Set(current.map((item) => item.observation?.version)).size} observed versions${uncertain ? ` · ${uncertain} unknown/stale` : ''}${planned ? ` · ${planned} planned` : ''}${destinations.some((item) => item.state === 'Exception') ? ' · discrepancy' : ''}`;
}
function compactAttention(application: ApplicationView) {
  const signals: string[] = [];
  const pending = application.pendingChanges ?? [];
  const decisions = pending.filter((change) => change.status === 'Decision required').length;
  const declarations = pending.filter((change) => change.status === 'Declared authorization').length;
  if (decisions) signals.push(`${decisions} decision${decisions === 1 ? '' : 's'} pending`);
  if (declarations) signals.push(`${declarations} declared authorization${declarations === 1 ? '' : 's'} pending`);
  const missing = application.destinations.filter((item) => item.receiptCondition === 'missing').length;
  const receiptUnknown = application.destinations.filter((item) => item.receiptCondition === 'unknown').length;
  if (missing) signals.push(`${missing} result${missing === 1 ? '' : 's'} not received`);
  if (receiptUnknown) signals.push(`${receiptUnknown} receipt outcome${receiptUnknown === 1 ? '' : 's'} unknown`);
  const unknown = application.destinations.filter((item) => item.uncertainRequestId && !item.receiptCondition).length;
  const unconfirmed = application.destinations.filter((item) => item.receiptCondition === 'completed-unconfirmed').length;
  if (unconfirmed) signals.push(`${unconfirmed} completed receipt${unconfirmed === 1 ? '' : 's'}; version unconfirmed`);
  if (unknown) signals.push(`${unknown} execution outcome${unknown === 1 ? '' : 's'} unknown`);
  const uncertain = application.destinations.filter((item) => item.state !== 'Observed');
  if (uncertain.length) {
    const states = new Set(uncertain.map((item) => item.state));
    signals.push(states.size === 1 ? uncertain[0]!.state === 'Exception'
      ? `${uncertain.length} version discrepanc${uncertain.length === 1 ? 'y' : 'ies'}`
      : `${uncertain.length} ${uncertain[0]!.state.toLowerCase()} destination${uncertain.length === 1 ? '' : 's'}`
      : `${uncertain.length} destinations need attention`);
  }
  return signals.length ? signals.join(' · ') : application.destinations.length ? 'No pending changes recorded' : 'Observation scope undecided';
}
function compactResponsibility(application: ApplicationView) {
  const roles = [...new Set((application.pendingChanges ?? []).map((change) => change.nextRole))];
  return roles.length ? `${roles.slice(0, 2).join(' / ')}${roles.length > 2 ? ` +${roles.length - 2} more roles` : ''} · recorded request`
    : `${application.nextRole} · suggested next step`;
}
export function portfolioPage(applications: ApplicationView[], selection?: ReadSelection) {
  return layout('Applications', `<div class="register-heading"><h1>Applications</h1><span class="count">${selection?.query ? `${applications.length} matching application` : `${applications.length} known application`}${applications.length === 1 ? '' : 's'}</span></div>
    ${selection ? `${readFilters(selection, '/')}${readCounts(selection)}` : ''}${!applications.length ? '<p class="panel empty-results">No matching results. <a href="/">Reset filters</a>.</p>' : ''}
    <div class="portfolio-register">${applications.map((application) => `<article class="portfolio-row" data-application="${e(application.id)}"><div class="row-overview"><a class="application-name" href="/applications/${encodeURIComponent(application.id)}">${e(application.name)}</a><p class="row-location" aria-label="Version and destinations">${e(compactLocation(application))}</p><p class="row-attention" aria-label="Attention and responsible role">${e(compactAttention(application))}<span>${e(compactResponsibility(application))}</span></p></div>
    <details class="row-context"><summary><span class="sr-only">Context for ${e(application.name)}</span><span class="row-chevron" aria-hidden="true">⌄</span></summary><div class="expanded-context"><p><strong>${e(application.kind)}</strong> · ${e(application.purpose)}</p><p class="source-note"><strong>Stewardship:</strong> ${e(application.stewardship)}</p><p>${e(application.recognition)}</p>${locationSummary(application)}<p>${e(attention(application))}</p><p><strong>Suggested next step:</strong> ${e(application.nextAction)}</p><details><summary>Sources and snapshot times</summary><ul>${application.destinations.map((destination) => `<li>${e(destination.name)}: ${e(destination.state)} · ${(destination.latestObservation ?? destination.observation) ? `${time((destination.latestObservation ?? destination.observation)!.recordedAt)} · ${e((destination.latestObservation ?? destination.observation)!.source)}` : 'No observation recorded'}</li>`).join('')}</ul>${json(application.metadata)}</details><a class="button-link" href="/applications/${encodeURIComponent(application.id)}">Open application →</a></div></details></article>`).join('')}</div>
    <p class="source-note register-help">Unknown is not healthy, failed or approved. Version snapshots do not establish health or independent Test acceptance. Suggested next steps are not recorded directives or authorizations.</p>`, false, { active: 'applications', query: selection?.query });
}
export function destinationCard(destination: DestinationView, applicationId: string) {
  const observed = ['Observed', 'Exception'].includes(destination.state) && destination.observation?.outcome === 'observed' ? destination.observation : null;
  const external = !!(destination.evidence && typeof destination.evidence === 'object' && 'backendId' in destination.evidence);
  return `<article class="panel reference-card" id="destination-${e(destination.id)}" data-destination="${e(destination.id)}"><h3>${destination.targetId ? `<a href="/applications/${encodeURIComponent(applicationId)}/targets/${encodeURIComponent(destination.targetId)}">${e(destination.name)}</a>` : e(destination.name)}</h3>${destination.disposable ? destination.stage === 'Production' ? '<p class="demo-warning">DISPOSABLE DEMO — NOT REAL PRODUCTION</p>' : '<p class="source-note">Disposable local demo</p>' : ''}
    <p class="version-number">${destination.state === 'Planned' ? 'Configured only' : observed ? e(observed.version ?? 'Unknown') : 'Unknown'}</p><p><strong>${e(destination.state)}</strong>${destination.state === 'Observed' ? ' · runtime-reported version' : ''}</p>
    ${destination.mode ? `<p class="source-note"><strong>Configured mode:</strong> ${e(destination.mode)}. This is a configuration declaration, not proof of backend capability.</p>` : ''}<p class="source-note">${e(destination.explanation)}</p>${observed ? `<p class="hash">${e(observed.digest!.slice(0, 23))}…</p><p class="source-note">${time(observed.observedAt!)}<br>${e(observed.source)}</p>` : destination.lastKnown ? `<p class="source-note">Last known: <strong>${e(destination.lastKnown.version ?? 'Unknown')}</strong><br>${time(destination.lastKnown.observedAt!)}<br>Historical; not current state.</p>` : '<p class="source-note">No valid version observed yet.</p>'}
    ${destination.latestObservation ? `<p class="source-note">Latest collection: ${destination.latestObservation.observedAt ? time(destination.latestObservation.observedAt) : 'time unknown'} · ${e(destination.latestObservation.outcome)}<br>Recorded ${time(destination.latestObservation.recordedAt)} · ${e(destination.latestObservation.source)}</p>` : ''}
    ${destination.limitations ? `<p class="source-note"><strong>Limitations:</strong> ${e(destination.limitations)}</p>` : ''}
    ${destination.url && /^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(destination.url) ? `<a class="button-link" href="${e(destination.url)}" target="_blank" rel="noopener noreferrer">Open app ↗</a>` : '<p class="source-note">No active owned endpoint. Historical ports are not probed.</p>'}
    ${destination.canChange && destination.url && /^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(destination.url) ? `<a class="button-link change-version" href="/applications/hello-observatory?destination=${encodeURIComponent(destination.id)}#propose-change">Change version</a>` : ''}
    ${destination.receiptCondition ? `<p class="notice">${e(receiptLabel(destination))}. Receipts and version observations remain separate.</p>` : ''}
    ${destination.uncertainRequestId && !destination.receiptCondition ? `<p class="notice">Execution outcome unknown. A version observation does not resolve the missing receipt. <a href="${external ? `#target-${encodeURIComponent(destination.id)}` : `/reference/requests/${e(destination.uncertainRequestId)}`}">Inspect ${external ? 'external evidence' : 'consumed request'}</a></p>` : ''}
    ${destination.recentChange ? `<p class="latest-action"><a href="${external ? `#target-${encodeURIComponent(destination.id)}` : `/reference/requests/${e(destination.recentChange.requestId)}`}">${e(destination.recentChange.text)}</a><br><small>Decision: ${e(destination.recentChange.decision)} · Action: ${e(destination.recentChange.result)}</small></p>` : '<p class="source-note">No operator change requested.</p>'}
    <details><summary>Evidence</summary>${json(destination.evidence)}</details></article>`;
}
export function applicationOverview(application: ApplicationView, options: { controls?: string; reference?: boolean; external?: boolean; exerciseLink?: boolean; refresh?: string; history?: string } = {}) {
  const { controls = '', reference = false, external = false, exerciseLink = false, refresh = '', history = '' } = options;
  const groups = groupDestinations(application.destinations);
  const plannedArchives = external ? application.destinations.filter((destination) => destination.mode === 'planned' && destination.targetId).map((destination) => {
    const base = `/applications/${encodeURIComponent(application.id)}/targets/${encodeURIComponent(destination.targetId!)}`;
    return `<p class="source-note planned-archives"><strong>${e(destination.name)}</strong>: <a href="${base}/history">Inspect retained historical events</a> · <a href="${base}/directives">Inspect retained historical directives</a>. These archives do not establish a current runtime or a connected backend.</p>`;
  }).join('') : '';
  return layout(application.name, `<nav class="breadcrumbs"><a href="/">Application portfolio</a> / Application detail</nav><p class="eyebrow">${e(application.kind)}</p><h1>${e(application.name)}</h1><p class="intro">${e(application.purpose)}</p>
    ${external ? '<aside class="notice">Configured external application. Configuration describes declared capabilities; it does not prove backend operation. Observatory does not run host commands or probe targets while rendering this page. Version, receipt, health and independent Test acceptance remain separate.</aside>' : application.id === 'hello-observatory' ? '<aside class="notice">Local disposable reference only. <strong>Production-labeled targets are NOT REAL PRODUCTION.</strong> Version, decision, execution, health and Test acceptance remain separate.</aside>' : '<aside class="notice">Actual operational state is <strong>Unknown</strong>. Seeded project metadata does not verify running versions, acceptance or health.</aside>'}

    <div class="section-heading destination-heading"><h2>Destinations by stage</h2>${refresh}<span class="count">${application.destinations.length} ${external ? 'configured target' : 'concrete instance'}${application.destinations.length === 1 ? '' : 's'}</span></div>
    ${groups.length ? `<div class="stage-groups">${groups.map(({ stage, instances }) => `<section class="stage-group${instances.length > 1 ? ' stage-many' : ''}"><div class="section-heading"><h3>${e(stage)}${stage === 'Production' && instances.some((instance) => instance.disposable) ? ' — demo only' : ''}</h3><span class="count">${instances.length} instance${instances.length === 1 ? '' : 's'}</span></div><div class="destination-grid">${instances.map((destination) => destinationCard(destination, application.id)).join('')}</div></section>`).join('')}</div>` : '<section class="panel empty-destinations"><h3>No concrete destinations connected</h3><p>No running versions have been established. Development, Test and Production remain unknown until supported by scoped observations; stage labels are not invented instances.</p></section>'}


    ${plannedArchives}
    <section class="panel pending-changes" id="pending-changes"><h2>Pending changes &amp; decisions</h2>${application.pendingChanges?.length ? application.pendingChanges.map((change) => `<article data-pending-request="${e(change.requestId)}"><h3>${e(change.destination)} → ${e(change.candidate)}</h3><p><strong>${e(change.status)}</strong> · not dispatched</p>${change.decision ? `<p>${e(change.decision.actor)} · claimed role ${e(change.decision.role)}. ${e(change.decision.rationale || 'No rationale recorded.')}</p><p class="source-note">Scope: ${e(change.decision.scope)} Conditions: ${e(change.decision.conditions)} Expires ${time(change.decision.expiresAt)}. ${e(change.decision.identity)}.</p>` : '<p>Applicable request awaiting a bounded declared decision; no authority is inferred.</p>'}<p class="source-note">Next actor: ${e(change.nextRole)}. Governance standing and execution capability are separate.</p><a href="/reference/requests/${e(change.requestId)}">Review change →</a></article>`).join('') : '<p>No pending changes recorded.</p>'}<p class="source-note">Recommendations, deferrals, declines, refusals, expired or consumed requests remain in history. A self-declared authorization is not authenticated organizational standing or execution credentials.</p></section>
    <section class="next-step"><h2>Next responsible role / action</h2><p><strong>${e(application.nextRole)}</strong> · ${e(application.nextAction)}</p><small>Suggested next step, not a new authorization. Governance standing does not supply execution credentials or capability.</small></section>

    ${controls}${exerciseLink ? '<details><summary>Earlier data-only demonstration</summary><p>Separate fixture ledger; its payload hashes are not reference-app artifact identities.</p><a href="/exercise">Open local release exercise →</a></details>' : ''}
    <section class="activity panel" id="recent-activity"><h2>Recent consequential activity</h2>${application.activity.length ? `<ol class="activity-list activity-preview">${application.activity.slice(0, 3).map((item) => `<li><p>${e(item.text)}</p><small>${time(item.at)} · ${e(item.source)}${item.requestId ? ` · <a href="/reference/requests/${e(item.requestId)}">Request evidence</a>` : ''}</small></li>`).join('')}</ol>` : '<p>No operational activity recorded for this application. Metadata creation is not a runtime observation.</p>'}<details><summary>Full activity &amp; request history</summary>${application.activity.length > 3 ? `<ol class="activity-list activity-history" start="4">${application.activity.slice(3).map((item) => `<li><p>${e(item.text)}</p><small>${time(item.at)} · ${e(item.source)}${item.requestId ? ` · <a href="/reference/requests/${e(item.requestId)}">Request evidence</a>` : ''}</small></li>`).join('')}</ol>` : '<p>No earlier activity summaries.</p>'}${history}<p class="source-note">Complete observations remain in each destination’s Evidence; each request retains its original decision, receipt and timeline.</p></details></section>
    ${application.directives.length ? `<details class="directives"><summary>Recorded decisions and scope</summary><p>Declarations are self-reported, not authenticated organizational authority or execution credentials.</p>${application.directives.map((directive) => `<article><h3>${e(directive.destination)} → ${e(directive.candidate)}</h3><p><strong>${e(directive.disposition)}</strong> · ${e(directive.actor)} · claimed role ${e(directive.role)}${directive.consumed ? ' · Request consumed' : Date.parse(directive.expiresAt) < Date.now() ? ' · Expired — not executable' : ' · Declared decision; readiness recheck required'}</p><p>${e(directive.rationale || 'No rationale recorded.')}</p><p class="source-note">Scope: ${e(directive.scope)} Conditions: ${e(directive.conditions)} Expires ${time(directive.expiresAt)}. ${e(directive.identity)}.</p>${directive.requestId ? `<a href="/reference/requests/${e(directive.requestId)}">Scope, readiness and decision history →</a>` : '<p class="source-note">Recorded directive only — no executable request linked.</p>'}</article>`).join('')}</details>` : ''}
    <details class="metadata-evidence"><summary>Application definition and historical metadata</summary><p>${e(application.recognition)}</p><p>Stewardship: ${e(application.stewardship)}</p><p>Any seeded next-decision text below is a historical snapshot, not live workflow state.</p>${json(application.metadata)}</details>`, reference ? 'reference' : external ? 'external' : false);
}
