// Synthetic fixtures only. Writes screenshots/report, never HTML, credentials or operator data.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { createApplication } from '../dist/app.js';
import { openCatalog } from '../dist/catalog.js';
import { ExternalRuntime, validateConfig } from '../dist/external-runtime.js';

process.env.PLAYWRIGHT_BROWSERS_PATH = resolve('.cache/playwright');
const { chromium } = await import('playwright');
const output = resolve('test-results/navigation');
mkdirSync(output, { recursive: true });
const directory = mkdtempSync(join(tmpdir(), 'ao-navigation-capture-'));
const artifacts = [{ version: '1.0.0', artifactId: `sha256:${'a'.repeat(64)}` }, { version: '2.0.0', artifactId: `sha256:${'b'.repeat(64)}` }];
const config = validateConfig({ schemaVersion: 1, backendId: 'synthetic-backend', applications: [
  { id: 'fixture-alpha', slug: 'alpha', name: 'Alpha sample', purpose: 'Synthetic navigation and keyboard fixture' },
  { id: 'fixture-beta', slug: 'beta', name: 'Beta sample', purpose: 'Synthetic planned and observation-only fixture' },
], targets: ['fresh', 'missing', 'unknown', 'unconfirmed', 'stale-conflict', 'observe-only', 'planned'].map((id, i) => ({ id, name: `Fixture ${id}`, applicationId: i < 5 ? 'fixture-alpha' : 'fixture-beta',
  stage: i < 5 ? 'QA' : 'Demo', instanceId: `fixture-instance-${i}`, artifacts: id === 'planned' ? [] : artifacts, mode: id === 'planned' ? 'planned' : id === 'observe-only' ? 'observe-only' : 'managed' })) });
const token = randomBytes(24).toString('hex');
const catalog = openCatalog(join(directory, 'db'));
const app = createApplication(join(directory, 'db'), undefined, { config, token });
let browser;
try {
  let clock = Date.now() - 800_000;
  const runtime = new ExternalRuntime(catalog.db, config, token, () => new Date(clock));
  const at = () => new Date(clock).toISOString();
  const request = (id) => runtime.createDirective(id, { action: 'deploy', ...artifacts[1], actor: 'Synthetic declared actor', rationale: 'Synthetic fixture; no actual operation' });
  const common = (id, kind, directiveId = null) => ({ schemaVersion: 1, eventId: `capture-${id}-${kind}`, backendId: config.backendId,
    applicationId: config.targets.find((target) => target.id === id).applicationId, destinationId: id, instanceId: config.targets.find((target) => target.id === id).instanceId,
    directiveId, kind, source: kind === 'receipt' ? 'Synthetic operation reporter' : 'Synthetic version collector', detail: 'Synthetic fixture, not live evidence' });
  const receipt = (id, directive, outcome = 'completed') => runtime.ingest(id, { ...common(id, 'receipt', directive.id), outcome, artifactId: artifacts[1].artifactId, startedAt: at(), finishedAt: at() });
  const observe = (id, release = artifacts[1]) => runtime.ingest(id, { ...common(id, 'observation'), outcome: 'observed', observedAt: at(), ...release, bootId: `capture-boot-${id}` });
  const old = request('stale-conflict'); clock += 1000; receipt('stale-conflict', old); clock += 1000; observe('stale-conflict', artifacts[0]);
  clock = Date.now() - 20_000;
  request('missing'); const unknown = request('unknown'); const unconfirmed = request('unconfirmed');
  clock += 1000; receipt('unknown', unknown, 'unknown'); receipt('unconfirmed', unconfirmed);
  clock += 1000; observe('fresh'); observe('missing'); observe('unknown'); observe('observe-only');
  const rowCounts = () => catalog.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
    .map(({ name }) => [name, catalog.db.prepare(`SELECT count(*) AS n FROM "${name}"`).get().n]);
  const before = rowCounts();
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  let blockedRequests = 0; const errors = [];
  await context.route('**/*', (route) => {
    if (route.request().url().startsWith(`${address}/`)) return route.continue();
    blockedRequests++; return route.abort();
  });
  const page = await context.newPage(); page.setDefaultTimeout(10_000);
  page.on('pageerror', () => errors.push('Browser page error'));
  const captures = [];
  const capture = async (name) => {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, name);
    assert.equal(await page.locator('script,form[method=post],input[name=csrf]').count(), 0);
    await page.screenshot({ path: join(output, `${name}.png`), fullPage: true }); captures.push(name);
  };
  await page.goto(`${address}/environments`);
  assert.equal(await page.locator('[data-placement]').count(), 7);
  assert.equal(await page.getByRole('navigation', { name: 'Main navigation' }).locator('[aria-current=page]').innerText(), 'Environments');
  await capture('environments-desktop');
  await page.keyboard.press('Tab'); assert.equal(await page.getByRole('link', { name: 'Skip to content' }).evaluate((element) => element === document.activeElement), true);
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); // Brand, then Applications.
  assert.equal(await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Applications', exact: true }).evaluate((element) => element === document.activeElement), true);
  await page.keyboard.press('Tab'); await Promise.all([page.waitForNavigation(), page.keyboard.press('Enter')]);
  await page.getByLabel('Search apps or placements', { exact: true }).fill('Fixture');
  await page.getByRole('combobox', { name: 'Stage', exact: true }).selectOption('Demo');
  await page.getByRole('combobox', { name: 'Capability', exact: true }).selectOption('planned');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).focus(); await page.keyboard.press('Enter');
  await page.waitForURL('**/environments?**');
  assert.equal(await page.locator('[data-placement]').count(), 1);
  assert.equal(new URL(page.url()).searchParams.get('stage'), 'Demo');
  await capture('environments-filtered-desktop');
  await page.getByRole('link', { name: 'View matching applications', exact: false }).click();
  assert.equal(await page.getByRole('combobox', { name: 'Stage', exact: true }).inputValue(), 'Demo');
  assert.equal(await page.locator('[data-application]').count(), 1);
  await capture('applications-filtered-desktop');
  await page.goBack(); assert.equal(await page.getByRole('combobox', { name: 'Capability', exact: true }).inputValue(), 'planned');
  await page.getByRole('link', { name: 'Reset filters', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 }); await capture('environments-mobile');
  await page.getByLabel('Search apps or placements', { exact: true }).fill('No matching fixture');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await page.getByRole('heading', { name: 'No matching results' }).waitFor(); await capture('empty-mobile');
  await page.getByRole('link', { name: 'Reset filters', exact: true }).click();
  const anchor = page.locator('[data-placement=planned]').getByRole('link', { name: 'Target evidence', exact: false });
  const href = await anchor.getAttribute('href'); await anchor.click();
  assert.equal(new URL(page.url()).hash, '#destination-planned'); assert.ok(href.endsWith('#destination-planned'));
  assert.equal(await page.locator('#destination-planned').count(), 1);
  // Application detail intentionally has existing controls, so do not capture it.
  await page.goto(`${address}/`); await page.setViewportSize({ width: 390, height: 844 }); await capture('applications-mobile');
  assert.deepEqual(rowCounts(), before); assert.equal(blockedRequests, 0); assert.deepEqual(errors, []);
  const sourceFiles = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', 'src', 'scripts', 'test', 'README.md', 'docs/AO_X02_DESIGN.md'], { encoding: 'utf8' }).trim().split('\n'))].sort();
  const sourceDigest = createHash('sha256');
  for (const file of sourceFiles) { sourceDigest.update(`${file}\0`); sourceDigest.update(readFileSync(file)); sourceDigest.update('\0'); }
  const report = { fixture: 'Synthetic in-process configuration and temporary SQLite only; no target processes or network collection', source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceFiles, sourceTreeSha256: sourceDigest.digest('hex'), dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), runtime: process.version, platform: `${process.platform}/${process.arch}`, browser: browser.version(),
    captures, checks: ['Desktop/mobile no horizontal overflow', 'Keyboard skip and main navigation; Enter submits native GET filters', 'URL filters, back navigation, active link and reset', 'Exact placement evidence anchor', 'All fixture ledger counts unchanged; zero external requests'], result: 'PASS — developer evidence only' };
  writeFileSync(join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
} finally { await browser?.close(); await app.close(); catalog.close(); rmSync(directory, { recursive: true, force: true }); }
