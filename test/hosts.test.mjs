import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { request } from 'node:http';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApplication } from '../dist/app.js';
import { parseAllowedHosts } from '../dist/config.js';
import { validateConfig } from '../dist/external-runtime.js';

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'ao-hosts-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('allowed hosts parser keeps local defaults and normalizes explicit ASCII hostname/IPv4 entries', () => {
  assert.deepEqual(parseAllowedHosts(), ['127.0.0.1', 'localhost']);
  assert.deepEqual(parseAllowedHosts(' Observatory.Example.Invalid , 192.0.2.10 '),
    ['127.0.0.1', 'localhost', 'observatory.example.invalid', '192.0.2.10']);
  assert.deepEqual(parseAllowedHosts('LOCALHOST'), ['127.0.0.1', 'localhost']);
  assert.ok(parseAllowedHosts('lab-console,0.0.0.0,255.255.255.255').includes('lab-console'));
  const maximumName = `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`;
  assert.ok(parseAllowedHosts(maximumName).includes(maximumName));
  assert.equal(parseAllowedHosts(Array.from({ length: 20 }, (_, i) => `host-${i}.invalid`).join(',')).length, 22);
  assert.ok(parseAllowedHosts(`${' '.repeat(4092)}host`).includes('host'));
});

test('allowed hosts parser rejects malformed, ambiguous, duplicate, empty and oversized settings without echoing input', () => {
  const invalid = [
    '', ' ', ',', 'host.invalid,', ',host.invalid', 'one.invalid,,two.invalid',
    '*', '*.example.invalid', 'http://host.invalid', 'https://host.invalid', 'host.invalid:4310',
    'host.invalid/path', 'host.invalid?query', 'host.invalid#fragment', 'user@host.invalid',
    'two hosts.invalid', 'two\thosts.invalid', 'host.invalid\n', 'host.invalid\r', 'host\0.invalid', 'host\x7f.invalid',
    'höst.invalid', '\u212a.invalid', '\u00a0host.invalid', 'host_invalid', '.host.invalid', 'host.invalid.',
    'host..invalid', '-host.invalid', 'host-.invalid', `${'a'.repeat(64)}.invalid`,
    Array(4).fill('a'.repeat(63)).join('.'),
    '256.0.0.1', '192.0.2.999', '192.0.2.01', '127.1', '2130706433', '0x7f000001', '0x7f.0.0.1',
    '1e2.0.0.1', '192.0.2.1garbage', '::1', '[::1]', 'host.invalid,HOST.INVALID', 'localhost,LOCALHOST',
    '192.0.2.10,192.0.2.10', ' host.invalid,Host.Invalid ',
    Array.from({ length: 21 }, (_, i) => `host-${i}.invalid`).join(','), ' '.repeat(4093) + 'host',
  ];
  for (const value of invalid) {
    assert.throws(() => parseAllowedHosts(value), { message: /Invalid AO_ALLOWED_HOSTS:/ }, JSON.stringify(value));
  }
  assert.throws(() => parseAllowedHosts('sensitive-example.invalid:123'), (error) =>
    error.message.includes('AO_ALLOWED_HOSTS') && !error.message.includes('sensitive-example'));
});

test('direct application host option validates before opening data and cannot bypass parsing', (t) => {
  const directory = join(fixture(t), 'unopened');
  for (const value of ['*', '', 'host.invalid:123', 'host.invalid,HOST.INVALID', [], ['host.invalid'], {}, null, 123]) {
    assert.throws(() => createApplication(directory, undefined, undefined, value), /Invalid AO_ALLOWED_HOSTS:/);
    assert.equal(existsSync(directory), false);
  }
});

test('configured GET/HEAD hosts are case insensitive, retain defaults and ignore spoofed forwarding headers', async (t) => {
  const app = createApplication(fixture(t), undefined, undefined, 'Observatory.Example.Invalid,192.0.2.10');
  t.after(() => app.close());
  for (const host of ['localhost:4310', 'LOCALHOST', '127.0.0.1:4310', 'observatory.example.invalid:4310', 'OBSERVATORY.EXAMPLE.INVALID', '192.0.2.10:4310']) {
    for (const method of ['GET', 'HEAD']) {
      const response = await app.inject({ method, url: '/', headers: { host, forwarded: 'host=unlisted.invalid;proto=https', 'x-forwarded-host': 'unlisted.invalid', 'x-forwarded-proto': 'https' } });
      assert.equal(response.statusCode, 200, `${method} ${host}`);
      if (method === 'HEAD') assert.equal(response.body, '');
    }
  }
  for (const host of ['unlisted.invalid', '192.0.2.11', 'observatory.example.invalid.attacker.invalid']) {
    for (const method of ['GET', 'HEAD']) {
      const response = await app.inject({ method, url: '/', headers: { host, forwarded: 'host=observatory.example.invalid;proto=http', 'x-forwarded-host': 'observatory.example.invalid' } });
      assert.equal(response.statusCode, 403, `${method} ${host}`);
    }
  }
  assert.equal((await app.inject({ method: 'POST', url: '/', headers: { host: '192.0.2.10' } })).statusCode, 405);
  const local = createApplication(join(fixture(t), 'local')); t.after(() => local.close());
  assert.equal((await local.inject({ url: '/', headers: { host: 'observatory.example.invalid', 'x-forwarded-host': 'localhost' } })).statusCode, 403);
});

test('configured host retains bearer authentication and same-origin/CSRF synthetic deploy controls', async (t) => {
  const token = 'synthetic-test-bearer-secret-long-enough';
  const artifactId = `sha256:${'a'.repeat(64)}`;
  const config = validateConfig({ schemaVersion: 1, backendId: 'synthetic-backend', targets: [
    { id: 'synthetic-target', name: 'Synthetic Test', applicationId: 'observatory-hello-reference', stage: 'Test', instanceId: 'synthetic-instance', artifacts: [{ version: '1.0.0', artifactId }] },
  ] });
  const app = createApplication(fixture(t), undefined, { config, token }, 'console.example.invalid,192.0.2.10');
  t.after(() => app.close());
  const api = '/api/runtime/v1/targets/synthetic-target/directive';
  const auth = { authorization: `Bearer ${token}` };
  for (const host of ['console.example.invalid:4310', '192.0.2.10:4310']) {
    for (const method of ['GET', 'HEAD']) {
      assert.equal((await app.inject({ method, url: api, headers: { host } })).statusCode, 401);
      assert.equal((await app.inject({ method, url: api, headers: { host, authorization: 'Bearer wrong' } })).statusCode, 401);
      assert.equal((await app.inject({ method, url: api, headers: { host, ...auth } })).statusCode, 200);
    }
    assert.equal((await app.inject({ method: 'POST', url: '/api/runtime/v1/targets/synthetic-target/events', headers: { host, 'content-type': 'application/json' }, payload: 'invalid-json' })).statusCode, 401);
  }
  assert.equal((await app.inject({ url: api, headers: { host: 'unlisted.invalid', ...auth, 'x-forwarded-host': 'console.example.invalid' } })).statusCode, 403);
  const host = '192.0.2.10:4310';
  const page = await app.inject({ url: '/applications/hello-observatory', headers: { host } });
  assert.equal(page.statusCode, 200);
  assert.ok(!page.body.includes(token));
  const csrf = page.body.match(/name="csrf" value="([a-f0-9]+)"/)[1];
  const fields = { csrf, action: 'deploy', release: `1.0.0|${artifactId}`, actor: 'Declared synthetic operator', rationale: 'Fixture directive only' };
  const post = (headers, payload = fields) => app.inject({ method: 'POST', url: '/external/targets/synthetic-target/directives',
    headers: Object.fromEntries(Object.entries({ host, origin: `http://${host}`, 'content-type': 'application/x-www-form-urlencoded', ...headers }).filter(([, value]) => value !== undefined)), payload: new URLSearchParams(payload).toString() });
  for (const origin of ['http://other.invalid:4310', 'http://192.0.2.10:4311', 'https://192.0.2.10:4310', 'null', undefined]) {
    assert.equal((await post({ origin, forwarded: `host=${host};proto=http`, 'x-forwarded-host': host, 'x-forwarded-proto': 'http' })).statusCode, 403);
  }
  assert.equal((await post({ 'sec-fetch-site': 'cross-site' })).statusCode, 403);
  const { csrf: _csrf, ...missingCsrf } = fields;
  assert.equal((await post({}, missingCsrf)).statusCode, 403);
  assert.equal((await post({}, { ...fields, csrf: 'incorrect' })).statusCode, 403);
  assert.deepEqual((await app.inject({ url: api, headers: { host, ...auth } })).json(), { schemaVersion: 1, directive: null });
  assert.equal((await post({ 'x-forwarded-proto': 'https' })).statusCode, 303);
  const directive = (await app.inject({ url: api, headers: { host, ...auth } })).json().directive;
  assert.equal(directive.action, 'deploy'); assert.equal(directive.artifactId, artifactId);
  assert.equal(directive.expectedBootId, null);
});

test('invalid AO_ALLOWED_HOSTS fails built startup safely before data or fixture creation in every mode', (t) => {
  const directory = fixture(t);
  for (const mode of [[], ['--exercise'], ['--reference']]) {
    for (const setting of ['', 'sensitive-example.invalid:123', 'host.invalid,HOST.INVALID']) {
      const child = spawnSync(process.execPath, ['dist/server.js', ...mode], { encoding: 'utf8', timeout: 5000,
        env: { AO_PORT: '0', AO_ALLOWED_HOSTS: setting, AO_DATA_DIR: join(directory, 'db'), AO_EXERCISE_DIR: join(directory, 'exercise'), AO_REFERENCE_DIR: join(directory, 'reference') } });
      assert.ifError(child.error); assert.equal(child.status, 1);
      assert.match(child.stderr, /Invalid AO_ALLOWED_HOSTS:/);
      assert.doesNotMatch(child.stderr, /sensitive-example|host\.invalid/);
      assert.doesNotMatch(child.stdout, /ready at|workspace:/);
      for (const name of ['db', 'exercise', 'reference']) assert.equal(existsSync(join(directory, name)), false);
    }
  }
});

test('built server wires AO_ALLOWED_HOSTS while retaining the loopback listener', async (t) => {
  const directory = fixture(t);
  const child = spawn(process.execPath, ['dist/server.js'], { stdio: ['ignore', 'pipe', 'pipe'],
    env: { AO_PORT: '0', AO_DATA_DIR: directory, AO_ALLOWED_HOSTS: 'Observatory.Example.Invalid,192.0.2.10' } });
  const exited = once(child, 'exit');
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM'); await exited; });
  const address = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Fixture server startup timed out.')), 5000);
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('exit', () => { clearTimeout(timeout); reject(new Error('Fixture server exited before ready.')); });
    child.stdout.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  });
  // Use node:http to transmit the exact Host header (fetch may replace it).
  const status = (method, headers) => new Promise((resolve, reject) => {
    const req = request(address, { method, headers }, (response) => {
      response.resume();
      response.once('end', () => resolve(response.statusCode));
      response.once('error', reject);
    });
    req.once('error', reject); req.end();
  });
  for (const host of ['localhost', 'OBSERVATORY.EXAMPLE.INVALID:4310', '192.0.2.10:4310']) {
    for (const method of ['GET', 'HEAD']) assert.equal(await status(method, { host }), 200);
  }
  assert.equal(await status('GET', { host: 'unlisted.invalid', 'x-forwarded-host': 'observatory.example.invalid' }), 403);
});
