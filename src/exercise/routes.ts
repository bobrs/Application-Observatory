import type { FastifyInstance } from 'fastify';
import type { Exercise } from './controller.js';
import { exerciseError, exercisePage, requestPage } from './views.js';

export function exerciseRoutes(app: FastifyInstance, exercise: Exercise) {
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_request, body, done) => {
    const params = new URLSearchParams(String(body));
    const entries = [...params.entries()];
    if (new Set(entries.map(([key]) => key)).size !== entries.length) { done(new Error('Duplicate form fields are not allowed.')); return; }
    done(null, Object.fromEntries(entries));
  });
  app.get('/exercise', async (_request, reply) => reply.type('text/html').send(exercisePage(exercise)));
  app.get<{ Params: { id: string } }>('/exercise/requests/:id', async (request, reply) => {
    try { return reply.type('text/html').send(requestPage(exercise, exercise.plan(request.params.id))); }
    catch { return reply.code(404).type('text/html').send(exerciseError('Request not found or its stored identity is inconsistent.')); }
  });
  const post = (path: string, fields: string[], action: (body: Record<string, string>, params: Record<string, string>) => Promise<string> | string) => {
    app.post<{ Body: Record<string, string>; Params: Record<string, string> }>(path, async (request, reply) => {
      try {
        const body = request.body;
        if (!body || typeof body !== 'object' || Array.isArray(body) || Object.values(body).some((value) => typeof value !== 'string')
          || Object.keys(body).some((key) => !['csrf', ...fields].includes(key)) || body.csrf !== exercise.csrf) {
          return reply.code(403).type('text/html').send(exerciseError('Invalid form, unsupported fields or CSRF token.'));
        }
        const location = await action(body, request.params);
        return reply.code(303).header('Location', location).send();
      } catch (error) {
        // Domain errors are controlled; never expose filesystem paths or exception stacks.
        const message = error instanceof Error && !/[/\\]|SQLITE|ENOENT/.test(error.message) ? error.message : 'The fixed exercise could not complete this request. Inspect the timeline or create a new workspace.';
        return reply.code(400).type('text/html').send(exerciseError(message));
      }
    });
  };
  post('/exercise/observe/:environment', [], async (_body, params) => { await exercise.observe(params.environment!); return '/exercise'; });
  post('/exercise/requests', ['candidateId', 'environmentId', 'fault'], (body) => `/exercise/requests/${exercise.createRequest(body.candidateId ?? '', body.environmentId ?? '', body.fault ?? 'normal').id}`);
  post('/exercise/requests/:id/decision', ['disposition', 'actor', 'role', 'rationale', 'scope'], (body, params) => {
    exercise.decide(params.id!, body.disposition ?? '', body.actor ?? '', body.role ?? '', body.rationale ?? '', body.scope === 'fixture-only');
    return `/exercise/requests/${params.id}`;
  });
  post('/exercise/requests/:id/apply', [], async (_body, params) => { await exercise.apply(params.id!); return `/exercise/requests/${params.id}`; });
  post('/exercise/requests/:id/observe', [], async (_body, params) => { await exercise.observe(exercise.plan(params.id!).environmentId, params.id); return `/exercise/requests/${params.id}`; });
}
