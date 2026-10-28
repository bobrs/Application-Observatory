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

test('list and detail show provenance and three honest unknowns without advancement controls', async (t) => {
  const app = createApplication(fixture(t));
  t.after(() => app.close());
  for (const url of ['/', '/applications/application-observatory']) {
    const response = await app.inject(url);
    assert.equal(response.statusCode, 200);
    assert.match(response.headers['content-type'], /text\/html/);
    assert.match(response.headers['content-security-policy'], /form-action 'none'/);
    assert.match(response.body, /Seeded project metadata/);
    assert.match(response.body, /Repository (source|product brief)/);
    assert.match(response.body, /\d{4}-\d{2}-\d{2}.* UTC/);
    assert.match(response.body, /Recorded next decision/);
    assert.match(response.body, /PM review of AO-INC-001 evidence/);
    for (const name of ['Development', 'Test', 'Production']) assert.match(response.body, new RegExp(name + ' recorded state'));
    assert.equal((response.body.match(/class="unknown">Unknown/g) || []).length, 3);
    assert.equal((response.body.match(/<dd>Not recorded<\/dd>/g) || []).length, 3);
    assert.equal((response.body.match(/<dd>None recorded<\/dd>/g) || []).length, 3);
    assert.equal((response.body.match(/<dd>Not observed<\/dd>/g) || []).length, 3);
    assert.doesNotMatch(response.body, /<(form|input|button|script)\b/i);
    assert.doesNotMatch(response.body, /<dd>(Healthy|Failed|Approved|Deployed|Passed|Not applicable)<\/dd>/i);
  }
  assert.match((await app.inject('/')).body, /1 application<\/span>/);
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
    const firstTimestamp = first.match(/datetime="([^"]+)"/)[1];
    await server.stop();
    server = undefined;
    server = await startLocalServer(directory);
    const second = await (await fetch(`${server.address}/applications/application-observatory`)).text();
    assert.equal(second.match(/datetime="([^"]+)"/)[1], firstTimestamp);
    assert.match(await (await fetch(server.address)).text(), /1 application<\/span>/);
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
