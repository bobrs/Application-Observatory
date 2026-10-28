import type { Application } from './catalog.js';
import { projectUrl } from './catalog.js';

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

function externalLink(url: string, label: string): string {
  // Even stored text must never become an executable href.
  return url.startsWith(`${projectUrl}/`)
    ? `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`
    : escapeHtml(label);
}

function timestamp(value: string): string {
  return `<time datetime="${escapeHtml(value)}">${escapeHtml(value.replace('T', ' ').replace('Z', ' UTC'))}</time>`;
}

function layout(title: string, content: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Application Observatory</title><link rel="stylesheet" href="/styles.css"><link rel="icon" href="data:,"></head><body>
  <a class="skip-link" href="#main">Skip to content</a><header><div class="shell"><div class="topbar"><a class="brand" href="/"><span class="mark" aria-hidden="true"></span>Application Observatory</a><span class="mode">Local self-catalog · Read-only</span></div></div></header>
  <main id="main" class="shell">${content}</main>
  <footer><div class="shell footer-row"><p>A shared view of what is known, and what is not.</p><p>AO-INC-001 · Seeded metadata, no live observations</p></div></footer></body></html>`;
}

function environments(): string {
  return `<div class="environments">${['Development', 'Test', 'Production'].map((name) => `<section class="environment" aria-label="${name} recorded state"><h3>${name}</h3><span class="unknown">Unknown</span><p>No operational observation recorded.</p><dl><dt>Version</dt><dd>Not recorded</dd><dt>Source</dt><dd>None recorded</dd><dt>Observed at</dt><dd>Not observed</dd></dl></section>`).join('')}</div>`;
}

function nextDecision(app: Application): string {
  return `<section class="next"><h3 class="eyebrow">Recorded next decision</h3><p>${escapeHtml(app.next_decision)}</p><small>Seeded review step · ${externalLink(app.next_decision_source, 'Issue #3')} · Snapshot, not live workflow status</small></section>`;
}

const notice = `<aside class="notice">Project metadata is seeded from repository documents. Environment state is <strong>unknown</strong> until supported by observations. A running catalog does not verify deployment, acceptance or health.</aside>`;

export function catalogPage(applications: Application[]): string {
  return layout('Application catalog', `<p class="eyebrow">Know the state. See the source.</p><h1>Application catalog</h1><p class="intro">Where software stands, what supports that view, and the next decision to make.</p>${notice}
  <div class="section-heading"><h2>Catalog entries</h2><span class="count">${applications.length} application${applications.length === 1 ? '' : 's'}</span></div>
  ${applications.map((app) => `<article class="panel"><div class="catalog-heading"><h2>${escapeHtml(app.name)}</h2><span class="tag">Self-entry</span></div><p class="purpose">${escapeHtml(app.purpose)}</p><p class="metadata-line"><strong>Stewardship:</strong> ${escapeHtml(app.stewardship)}</p>
  <p class="metadata-line">Seeded project metadata · ${externalLink(app.source_url, 'Repository source')} · Recorded ${timestamp(app.recorded_at)}</p>${environments()}${nextDecision(app)}<div class="catalog-footer"><span class="source-note">No Test acceptance, deployment or health evidence recorded.</span><a class="button-link" href="/applications/${encodeURIComponent(app.id)}">View application <span aria-hidden="true">↗</span></a></div></article>`).join('')}`);
}

export function detailPage(app: Application): string {
  return layout(app.name, `<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Application catalog</a> / Application detail</nav><p class="eyebrow">The Observatory's first entry</p><h1>${escapeHtml(app.name)}</h1><p class="intro">${escapeHtml(app.purpose)}</p>${notice}
  <div class="detail-grid"><section class="panel"><h2>Project record</h2><dl class="facts"><dt>Stewardship</dt><dd>${escapeHtml(app.stewardship)}</dd><dt>Project</dt><dd><a href="${projectUrl}">bobrs/Application-Observatory</a></dd><dt>Source type</dt><dd>Seeded project metadata; not an operational observation or independent verification.</dd><dt>Source identity / reference</dt><dd>${externalLink(app.source_url, 'Repository product brief')} and ${externalLink(`${projectUrl}/blob/${app.source_revision}/README.md`, 'README stewardship role')}</dd><dt>Metadata source revision</dt><dd><code>${escapeHtml(app.source_revision)}</code></dd><dt>Recorded at (first seed)</dt><dd>${timestamp(app.recorded_at)}</dd><dt>Observation time</dt><dd>Not observed. The seed timestamp records catalog creation only.</dd></dl>${nextDecision(app)}<p class="fine-print">Review declarations, candidate tracking and correction history are outside this increment. External links are references; this catalog does not fetch or verify them.</p></section>
  <section class="panel detail-environments"><h2>Recorded environments</h2><p class="source-note">No running versions have been established.</p>${environments()}</section></div>`);
}

export function notFoundPage(): string {
  return layout('Application not found', '<p class="eyebrow">No matching record</p><h1>Application not found</h1><p class="intro">There is no catalog entry at this address.</p><a href="/">Return to the application catalog</a>');
}
