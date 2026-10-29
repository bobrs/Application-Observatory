export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

export function layout(title: string, content: string, exercise: boolean | 'reference' = false): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Application Observatory</title><link rel="stylesheet" href="/styles.css"><link rel="icon" href="data:,"></head><body>
  <a class="skip-link" href="#main">Skip to content</a><header><div class="shell"><div class="topbar"><a class="brand" href="/"><span class="mark" aria-hidden="true"></span>Application Observatory</a><span class="mode">${exercise === 'reference' ? 'Disposable reference · Application detail' : exercise ? 'Disposable local release exercise' : 'Local portfolio · Read-only'}</span></div></div></header>
  <main id="main" class="shell">${content}</main>
  <footer><div class="shell footer-row"><p>A shared view of what is known, and what is not.</p><p>${exercise === 'reference' ? 'AO-INC-004 · Reference demo · Health not evaluated' : exercise ? 'AO-INC-002 · Fixture only · Health not evaluated' : 'AO-INC-004 · Claims, actions and observations stay distinct'}</p></div></footer></body></html>`;
}

export function notFoundPage(): string {
  return layout('Application not found', '<p class="eyebrow">No matching record</p><h1>Application not found</h1><p class="intro">There is no catalog entry at this address.</p><a href="/">Return to the application portfolio</a>');
}
