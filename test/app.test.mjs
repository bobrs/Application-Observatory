import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { createApplication } from '../dist/app.js';
import { startLocalServer } from '../scripts/local-server.mjs';

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'ao-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('executive portfolio separates two applications, keeps controls behind drill-down, and preserves historical self metadata', async (t) => {
  const app = createApplication(fixture(t)); t.after(() => app.close());
  const portfolio = await app.inject('/');
  assert.equal(portfolio.statusCode, 200); assert.match(portfolio.headers['content-security-policy'], /form-action 'none'/);
  assert.match(portfolio.body, /Executive portfolio/); assert.match(portfolio.body, /2 applications/);
  assert.match(portfolio.body, /data-application="application-observatory"/); assert.match(portfolio.body, /data-application="hello-observatory"/);
  assert.match(portfolio.body, /Next responsible role/); assert.match(portfolio.body, /Unknown/);
  assert.doesNotMatch(portfolio.body, /<(form|input|button|script)\b/i);
  assert.doesNotMatch(portfolio.body, /PM review of AO-INC-001 evidence|class="reference-card"|name="candidateId"/);
  const detail = await app.inject('/applications/application-observatory');
  assert.equal(detail.statusCode, 200); assert.match(detail.body, /No concrete destinations connected/);
  assert.match(detail.body, /Development, Test and Production remain unknown/);
  assert.match(detail.body, /historical snapshot, not live workflow state/); assert.match(detail.body, /PM review of AO-INC-001 evidence/);
  assert.match(detail.body, /Seeded project metadata/); assert.match(detail.body, /source_revision/);
  assert.match(detail.body, /No operational activity recorded for this application/);
  assert.doesNotMatch(detail.body, /<(form|input|button|script)\b/i);
  const hello = await app.inject('/applications/hello-observatory');
  assert.equal(hello.statusCode, 200); assert.match(hello.body, /Local reference session inactive/);
  assert.match(hello.body, /not a database seed, runtime observation or registration timestamp/);
  assert.doesNotMatch(hello.body, /<(form|input|button|script)\b/i);
  assert.equal((await app.inject('/styles.css')).statusCode, 200);
  assert.equal((await app.inject('/applications/missing')).statusCode, 404);
  assert.equal((await app.inject('/not-a-route')).statusCode, 404);
  assert.equal((await app.inject({ method: 'HEAD', url: '/' })).body, '');
});

test('mutation methods and nonlocal host names are rejected', async (t) => {
  const app = createApplication(fixture(t));
  t.after(() => app.close());
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const response = await app.inject({ method, url: '/applications/application-observatory' });
    assert.equal(response.statusCode, 405);
    assert.equal(response.headers.allow, 'GET, HEAD');
  }
  assert.equal((await app.inject({ url: '/', headers: { host: 'external.example' } })).statusCode, 403);
});

test('persisted fixture text is escaped and unsafe source links are not executable', async (t) => {
  const directory = fixture(t);
  const initial = createApplication(directory);
  await initial.close();
  const db = new Database(join(directory, 'catalog.sqlite'));
  db.prepare('UPDATE applications SET purpose = ?, source_url = ?').run('<script>alert("fixture")</script>', 'javascript:alert(1)');
  db.close();
  const app = createApplication(directory);
  t.after(() => app.close());
  const response = await app.inject('/applications/application-observatory');
  assert.match(response.body, /&lt;script&gt;/);
  assert.doesNotMatch(response.body, /<script|href="javascript:/);
});

test('built server binds loopback and retains its first seed across restart and offline restore', async (t) => {
  const directory = fixture(t);
  let server;
  try {
    server = await startLocalServer(directory);
    assert.match(server.address, /^http:\/\/127\.0\.0\.1:\d+$/);
    const first = await (await fetch(`${server.address}/applications/application-observatory`)).text();
    const firstTimestamp = first.match(/&quot;recorded_at&quot;: &quot;([^&]+)&quot;/)[1];
    await server.stop();
    server = undefined;
    server = await startLocalServer(directory);
    const second = await (await fetch(`${server.address}/applications/application-observatory`)).text();
    assert.equal(second.match(/&quot;recorded_at&quot;: &quot;([^&]+)&quot;/)[1], firstTimestamp);
    assert.match(await (await fetch(server.address)).text(), /2 applications<\/span>/);
    assert.equal(first, second);
    await server.stop();
    server = undefined;
    const restored = fixture(t);
    copyFileSync(join(directory, 'catalog.sqlite'), join(restored, 'catalog.sqlite'));
    server = await startLocalServer(restored);
    assert.equal(await (await fetch(`${server.address}/applications/application-observatory`)).text(), first);
  } finally {
    if (server) await server.stop();
  }
});
