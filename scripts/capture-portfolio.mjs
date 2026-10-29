import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import Fastify from 'fastify';
import { createExercise } from '../dist/exercise/controller.js';
import { createApplication } from '../dist/app.js';
import { referenceView } from '../dist/portfolio.js';
import { applicationOverview, portfolioPage } from '../dist/portfolio-views.js';
import { styles } from '../dist/styles.js';

process.env.PLAYWRIGHT_BROWSERS_PATH = resolve('.cache/playwright');
const { chromium } = await import('playwright');
const output = resolve('test-results/portfolio'); mkdirSync(output, { recursive: true });
const exercise = await createExercise(undefined, undefined, true);
const app = createApplication(exercise.workspace.directory, exercise);
const illustrations = Fastify({ logger: false });
let browser; const scenarios = [];
try {
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  const illustrative = (id, stage) => ({ id, name: `Illustrative ${id}`, stage, disposable: true, state: 'Unknown',
    explanation: 'Illustrative layout only — no process or running version exists for this card.', observation: null, lastKnown: null,
    evidence: { source: 'Synthetic presentation fixture, not runtime evidence' } });
  const shapes = {
    zero: [], one: [illustrative('dev-a', 'Development')],
    three: [illustrative('dev-a', 'Development'), illustrative('test-a', 'Test'), illustrative('demo-a', 'Production')],
    multiple: [illustrative('dev-a', 'Development'), illustrative('dev-b', 'Development'), illustrative('test-a', 'Test'), illustrative('test-b', 'Test'), illustrative('demo-a', 'Production'), illustrative('lab-a', 'Local review')],
  };
  // These routes belong only to this test server, never the product or executable target registry.
  illustrations.get('/styles.css', async (_request, reply) => reply.type('text/css').send(styles));
  illustrations.get('/favicon.ico', async (_request, reply) => reply.code(204).send());
  for (const [name, destinations] of Object.entries(shapes)) illustrations.get(`/${name}`, async (_request, reply) => reply.type('text/html').send(applicationOverview({ ...referenceView(), name: 'ILLUSTRATIVE LAYOUT — NOT LIVE', purpose: 'Synthetic shape only. No new target, observation, action or permission is created.', destinations })));
  illustrations.get('/many-applications', async (_request, reply) => reply.type('text/html').send(portfolioPage(Array.from({ length: 24 }, (_, i) => ({ ...referenceView(), id: `example-${i}`, name: `Illustrative application ${i + 1} — not live` })))));
  const illustrationAddress = await illustrations.listen({ host: '127.0.0.1', port: 0 });
  browser = await chromium.launch(); const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } }); const page = await context.newPage();
  const errors = []; let externalRequests = 0;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}`); });
  await context.route('**/*', (route) => {
    if ([address, illustrationAddress].some((origin) => route.request().url().startsWith(`${origin}/`))) return route.continue();
    externalRequests++; return route.abort();
  });
  async function capture(name) {
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    if (!fits) console.log(JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('body *')].filter((element) => element.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map((element) => ({ tag: element.tagName, className: element.className, right: element.getBoundingClientRect().right, text: element.textContent.slice(0, 80) })))));
    assert.equal(fits, true, name);
    await page.screenshot({ path: join(output, `${name}.png`), fullPage: true });
  }
  await page.goto(address);
  assert.equal(await page.locator('[data-application]').count(), 2); assert.equal(await page.locator('form,button,input,script').count(), 0);
  await capture('portfolio-unknown-desktop');
  await page.locator('[data-application=hello-observatory]').getByRole('link', { name: 'View application' }).click();
  assert.equal(new URL(page.url()).pathname, '/applications/hello-observatory');
  await page.getByRole('button', { name: 'Refresh observations', exact: true }).click();
  await page.goto(`${address}/applications/hello-observatory`); await capture('application-observed-desktop');
  await page.getByRole('link', { name: 'Application portfolio', exact: true }).click(); await capture('portfolio-observed-desktop');
  await page.setViewportSize({ width: 390, height: 844 }); await capture('portfolio-observed-mobile');
  await page.locator('[data-application=hello-observatory]').getByRole('link', { name: 'View application' }).click(); await capture('application-observed-mobile');
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.getByRole('combobox', { name: /^Version/ }).selectOption('1.2.0'); await page.getByRole('combobox', { name: /^Destination/ }).selectOption('test-reference');
  await page.getByRole('button', { name: 'Review change', exact: true }).click(); const requestId = page.url().split('/').at(-1);
  await page.getByLabel('Your name', { exact: true }).fill('Alex — local demo'); await page.getByLabel('Rationale', { exact: true }).fill('Only this exact disposable Test candidate.'); await page.locator('input[name=scope]').check();
  await page.getByRole('button', { name: 'Record decision', exact: true }).click();
  await page.getByRole('button', { name: 'Upgrade to 1.2.0', exact: true }).click();
  assert.equal(await page.getByText('Request consumed; a new decision is required for any further change.', { exact: true }).count(), 1);
  assert.equal(await page.getByText('Original criteria and current reuse checks', { exact: true }).count(), 1);
  await capture('consumed-request');
  await page.getByRole('button', { name: 'Observe target', exact: true }).click(); assert.equal(exercise.readBack(requestId).version, '1.2.0');
  await page.getByRole('link', { name: '← Application detail', exact: true }).click(); await capture('activity-and-decision');
  const uncertain = exercise.createRequest('1.1.0', 'test-reference', 'lost-receipt'); exercise.decide(uncertain.id, 'authorize', 'Alex', 'Local demo', 'Bounded fault demonstration', true); await exercise.apply(uncertain.id); await exercise.observe('test-reference', uncertain.id);
  await page.goto(address); assert.match(await page.locator('body').innerText(), /execution outcome unknown/); await capture('portfolio-unknown-execution');
  scenarios.push('PASS: real portfolio has two separate applications and no operational controls; drill-down hosts scoped decisions/apply/refresh; completed request is consumed, fresh observation separate, lost receipt remains executive-visible despite matching version');
  for (const [name, destinations] of Object.entries(shapes)) {
    await page.goto(`${illustrationAddress}/${name}`); assert.equal(await page.locator('[data-destination]').count(), destinations.length); assert.equal(await page.locator('form,button,input').count(), 0); await capture(`illustrative-${name}-destinations`);
    await page.setViewportSize({ width: 390, height: 844 }); await capture(`illustrative-${name}-mobile`); await page.setViewportSize({ width: 1440, height: 1050 });
  }
  await page.goto(`${illustrationAddress}/many-applications`); assert.equal(await page.locator('[data-application]').count(), 24);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: join(output, 'illustrative-portfolio-24-applications.png'), fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  scenarios.push('PASS: clearly illustrative zero/one/three/six destinations with two per stage and an extra stage; 24-application portfolio desktop/mobile; no new runtime target or executable controls; no horizontal overflow');
  assert.deepEqual(errors, []); assert.equal(externalRequests, 0);
  const report = { sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sourceDirty: execFileSync('git', ['status', '--porcelain=v1'], { encoding: 'utf8' }).trim() !== '', capturedAt: new Date().toISOString(), node: process.version,
    platform: `${process.platform} ${process.arch}`, browser: `Chromium ${browser.version()}`, scenarios, browserErrors: errors, externalRequests,
    limits: 'Dev-run macOS/Chromium checks, not independent Test/health/standing. Only original three fixed reference apps execute. Other destination/portfolio sizes are synthetic layout fixtures on a separate test server, never registrations or observations.' };
  writeFileSync(join(output, 'demo.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2));
} finally { if (browser) await browser.close(); await illustrations.close(); await app.close(); rmSync(exercise.workspace.directory, { recursive: true, force: true }); }
