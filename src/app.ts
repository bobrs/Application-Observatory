import Fastify from 'fastify';
import { openCatalog } from './catalog.js';
import { escapeHtml, layout, notFoundPage } from './views.js';
import { externalApplicationViews, portfolioViews, referenceView } from './portfolio.js';
import { portfolioPage, applicationOverview } from './portfolio-views.js';
import { referencePage, selectionError, selectedDestination } from './reference/views.js';
import { environmentsPage, selectReadView } from './read-navigation.js';
import { styles } from './styles.js';
import { randomBytes } from 'node:crypto';
import { ExternalRuntime, type ExternalConfig } from './external-runtime.js';
import { externalControls, externalRuntimeRoutes } from './external-routes.js';
import type { Exercise } from './exercise/controller.js';
import { exerciseRoutes } from './exercise/routes.js';

export function createApplication(directory?: string, exercise?: Exercise, external?: { config: ExternalConfig; token: string }) {
  if (exercise && external) throw new Error('External runtime and local reference/exercise modes cannot run together.');
  const catalog = openCatalog(directory);
  const runtime = external ? new ExternalRuntime(catalog.db, external.config, external.token) : undefined;
  const csrf = randomBytes(32).toString('hex');
  const app = Fastify({ logger: false, exposeHeadRoutes: true, bodyLimit: 4096 });
  app.addHook('onClose', async () => { try { await exercise?.close(); } finally { catalog.close(); } });
  app.addHook('onRequest', async (request, reply) => {
    const pathname = request.url.split('?')[0]!;
    const exerciseRoute = !!exercise && ((exercise.reference && pathname === '/applications/hello-observatory') || pathname === (exercise.reference ? '/reference' : '/exercise') || pathname.startsWith(exercise.reference ? '/reference/' : '/exercise/'));
    const externalSlugs = runtime?.config.applications.map((application) => `/applications/${application.slug}`) ?? [];
    const externalUiRoute = !!runtime && (externalSlugs.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) || pathname.startsWith('/external/'));
    const apiRoute = !!runtime && pathname.startsWith('/api/runtime/v1/');
    reply.header('Content-Security-Policy', `default-src 'none'; style-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action ${exerciseRoute || externalUiRoute || pathname === '/' || pathname === '/environments' ? "'self'" : "'none'"}`)
      .header('X-Content-Type-Options', 'nosniff')
      .header('Referrer-Policy', exerciseRoute || externalUiRoute ? 'same-origin' : 'no-referrer')
      .header('Cache-Control', 'no-store');
    if (!['127.0.0.1', 'localhost'].includes(request.hostname)) {
      return reply.code(403).type('text/plain').send('This catalog only accepts local host names.');
    }
    if (apiRoute && !runtime!.authenticate(request.headers.authorization)) return reply.code(401).header('WWW-Authenticate', 'Bearer').type('application/json').send({ error: 'unauthorized' });
    if (!['GET', 'HEAD'].includes(request.method)) {
      if (exerciseRoute && request.method === 'POST') {
        if (request.headers.origin !== `http://${request.headers.host}` || request.headers['sec-fetch-site'] === 'cross-site') {
          return reply.code(403).type('text/plain').send('Same-origin form submission is required.');
        }
        return;
      }
      if (apiRoute && request.method === 'POST' && request.url.startsWith('/api/runtime/v1/targets/') && request.url.endsWith('/events')) return;
      if (externalUiRoute && request.method === 'POST' && pathname.startsWith('/external/')) {
        if (request.headers.origin !== `http://${request.headers.host}` || request.headers['sec-fetch-site'] === 'cross-site') return reply.code(403).type('text/plain').send('Same-origin form submission is required.');
        return;
      }
      return reply.code(405).header('Allow', 'GET, HEAD').type('text/plain').send('This increment is read-only.');
    }
  });
  for (const path of ['/', '/environments']) app.get(path, async (request, reply) => {
    const applications = portfolioViews(catalog.list(), exercise, runtime);
    let selection;
    try {
      selection = selectReadView(request.raw.url ?? path, applications);
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      return reply.code(400).type('text/html').send(layout('Invalid filters', `<h1>Invalid filters</h1><p>${escapeHtml(error.message)}</p><a href="${path}">Reset filters</a>`, false, { active: path === '/environments' ? 'environments' : 'applications' }));
    }
    return reply.type('text/html').send(path === '/' ? portfolioPage(selection.applications, selection) : environmentsPage(selection));
  });
  app.get<{ Params: { id: string } }>('/applications/:id', async (request, reply) => {
    if (request.params.id === 'hello-observatory') {
      if (exercise?.reference) {
        let selected: string | undefined;
        try { selected = selectedDestination(exercise, (request.query as Record<string, unknown>).destination); }
        catch { return reply.code(400).type('text/html').send(selectionError()); }
        return reply.type('text/html').send(referencePage(exercise, selected));
      }
      if (runtime && !runtime.config.applications.some((application) => application.slug === 'hello-observatory')) return reply.code(404).type('text/html').send(notFoundPage());
      return reply.type('text/html').send(applicationOverview(referenceView(undefined, runtime), {
        ...(runtime ? { external: true, controls: runtime.config.targets.filter((target) => target.applicationId === runtime.config.applications.find((application) => application.slug === 'hello-observatory')?.id && target.mode !== 'planned').map((target) => externalControls(runtime, csrf, target.id)).join('') } : { controls: '<section class="panel selection"><h2>Local reference session inactive</h2><p>No reference processes were started or observed by this mode. Start the existing opt-in mode from the checkout with <code>npm run reference</code> to connect its three disposable local destinations. This is not a remote deployment command.</p></section>' }),
      }));
    }
    if (runtime) {
      const application = externalApplicationViews(runtime).find((item) => item.id === request.params.id);
      if (application) {
        const metadata = runtime.config.applications.find((item) => item.slug === request.params.id)!;
        const controls = runtime.config.targets.filter((target) => target.applicationId === metadata.id && target.mode !== 'planned').map((target) => externalControls(runtime, csrf, target.id)).join('');
        return reply.type('text/html').send(applicationOverview(application, { external: true, controls }));
      }
    }
    const application = portfolioViews(catalog.list(), exercise, runtime).find((item) => item.id === request.params.id);
    return application ? reply.type('text/html').send(applicationOverview(application, { exerciseLink: !!exercise && !exercise.reference }))
      : reply.code(404).type('text/html').send(notFoundPage());
  });
  app.get('/styles.css', async (_request, reply) => reply.type('text/css').send(styles));
  if (exercise) exerciseRoutes(app, exercise);
  if (runtime) externalRuntimeRoutes(app, runtime, csrf);
  app.setNotFoundHandler(async (_request, reply) => reply.code(404).type('text/html').send(notFoundPage()));
  return app;
}
