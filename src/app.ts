import Fastify from 'fastify';
import { openCatalog } from './catalog.js';
import { catalogPage, detailPage, notFoundPage } from './views.js';
import { styles } from './styles.js';

export function createApplication(directory?: string) {
  const catalog = openCatalog(directory);
  const app = Fastify({ logger: false, exposeHeadRoutes: true });
  app.addHook('onClose', async () => catalog.close());
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Content-Security-Policy', "default-src 'none'; style-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'")
      .header('X-Content-Type-Options', 'nosniff')
      .header('Referrer-Policy', 'no-referrer')
      .header('Cache-Control', 'no-store');
    if (!['127.0.0.1', 'localhost'].includes(request.hostname)) {
      return reply.code(403).type('text/plain').send('This catalog only accepts local host names.');
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      return reply.code(405).header('Allow', 'GET, HEAD').type('text/plain').send('This increment is read-only.');
    }
  });
  app.get('/', async (_request, reply) => reply.type('text/html').send(catalogPage(catalog.list())));
  app.get<{ Params: { id: string } }>('/applications/:id', async (request, reply) => {
    const application = catalog.find(request.params.id);
    return application
      ? reply.type('text/html').send(detailPage(application))
      : reply.code(404).type('text/html').send(notFoundPage());
  });
  app.get('/styles.css', async (_request, reply) => reply.type('text/css').send(styles));
  app.setNotFoundHandler(async (_request, reply) => reply.code(404).type('text/html').send(notFoundPage()));
  return app;
}
