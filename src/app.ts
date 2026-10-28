import Fastify from 'fastify';
import { openCatalog } from './catalog.js';
import { catalogPage, detailPage, notFoundPage } from './views.js';
import { styles } from './styles.js';
import type { Exercise } from './exercise/controller.js';
import { exerciseRoutes } from './exercise/routes.js';

export function createApplication(directory?: string, exercise?: Exercise) {
  const catalog = openCatalog(directory);
  const app = Fastify({ logger: false, exposeHeadRoutes: true, bodyLimit: 4096 });
  app.addHook('onClose', async () => { try { await exercise?.close(); } finally { catalog.close(); } });
  app.addHook('onRequest', async (request, reply) => {
    const pathname = request.url.split('?')[0]!;
    const exerciseRoute = !!exercise && (pathname === '/exercise' || pathname.startsWith('/exercise/'));
    reply.header('Content-Security-Policy', `default-src 'none'; style-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action ${exerciseRoute ? "'self'" : "'none'"}`)
      .header('X-Content-Type-Options', 'nosniff')
      .header('Referrer-Policy', exerciseRoute ? 'same-origin' : 'no-referrer')
      .header('Cache-Control', 'no-store');
    if (!['127.0.0.1', 'localhost'].includes(request.hostname)) {
      return reply.code(403).type('text/plain').send('This catalog only accepts local host names.');
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      if (exerciseRoute && request.method === 'POST') {
        if (request.headers.origin !== `http://${request.headers.host}` || request.headers['sec-fetch-site'] === 'cross-site') {
          return reply.code(403).type('text/plain').send('Same-origin form submission is required.');
        }
        return;
      }
      return reply.code(405).header('Allow', 'GET, HEAD').type('text/plain').send('This increment is read-only.');
    }
  });
  app.get('/', async (_request, reply) => reply.type('text/html').send(catalogPage(catalog.list(), !!exercise)));
  app.get<{ Params: { id: string } }>('/applications/:id', async (request, reply) => {
    const application = catalog.find(request.params.id);
    return application
      ? reply.type('text/html').send(detailPage(application))
      : reply.code(404).type('text/html').send(notFoundPage());
  });
  app.get('/styles.css', async (_request, reply) => reply.type('text/css').send(styles));
  if (exercise) exerciseRoutes(app, exercise);
  app.setNotFoundHandler(async (_request, reply) => reply.code(404).type('text/html').send(notFoundPage()));
  return app;
}
