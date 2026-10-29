import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import Fastify from 'fastify';
import { createExercise } from '../dist/exercise/controller.js';
import { createApplication } from '../dist/app.js';
import { referenceView } from '../dist/portfolio.js';
import { portfolioPage } from '../dist/portfolio-views.js';
import { styles } from '../dist/styles.js';

process.env.PLAYWRIGHT_BROWSERS_PATH = resolve('.cache/playwright');
const { chromium } = await import('playwright');
const output = resolve('test-results/refinement'); mkdirSync(output, { recursive: true });
const exercise = await createExercise(undefined, undefined, true); const app = createApplication(exercise.workspace.directory, exercise);
const illustrations = Fastify({ logger: false }); let browser; const scenarios = [];
try {
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  const entries = Array.from({ length: 30 }, (_, i) => ({ ...referenceView(), id: `illustrative-${i}`, name: i === 0 ? `Illustrative long application ${'NameWithoutSpaces'.repeat(10)}` : `Illustrative application ${i + 1} — not live`,
    purpose: `Synthetic description ${'DescriptionWithoutSpaces'.repeat(12)}`, metadata: { source: 'Synthetic layout fixture only, no registration or runtime' } }));
  illustrations.get('/styles.css', async (_request, reply) => reply.type('text/css').send(styles));
  illustrations.get('/favicon.ico', async (_request, reply) => reply.code(204).send());
  illustrations.get('/', async (_request, reply) => reply.type('text/html').send(portfolioPage(entries)));
  const illustrationAddress = await illustrations.listen({ host: '127.0.0.1', port: 0 });
  browser = await chromium.launch(); const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } }); const page = await context.newPage();
  const errors = []; let externalRequests = 0;
  page.on('pageerror', (error) => errors.push(error.message)); page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}`); });
  await context.route('**/*', (route) => {
    if ([address, illustrationAddress].some((origin) => route.request().url().startsWith(`${origin}/`))) return route.continue();
    externalRequests++; return route.abort();
  });
  async function capture(name, fullPage = true) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, name);
    await page.screenshot({ path: join(output, `${name}.png`), fullPage });
  }
  const identity = () => exercise.environments.map((item) => ({ observations: exercise.observations(item.id), bootstrap: exercise.events(`runtime:${item.id}`), boot: exercise.targets.get(item.id).bootId }));
  await page.goto(address); const unchanged = identity();
  assert.equal(await page.locator('[data-application]').count(), 2); assert.equal(await page.locator('form,input,button,script').count(), 0);
  assert.equal(await page.locator('.row-context[open]').count(), 0);
  const heights = await page.locator('.portfolio-row').evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height));
  assert.ok(heights.every((height) => height >= 64 && height <= 81), JSON.stringify(heights));
  await capture('portfolio-collapsed-desktop');
  const self = page.locator('[data-application=application-observatory]'); const hello = page.locator('[data-application=hello-observatory]');
  // Reach the disclosure through real sequential keyboard focus, rather than simulating a click.
  await page.keyboard.press('Tab');
  for (let i = 0; i < 10 && !(await self.locator('.row-context > summary').evaluate((element) => element === document.activeElement)); i++) await page.keyboard.press('Tab');
  assert.equal(await self.locator('.row-context > summary').evaluate((element) => element === document.activeElement), true);
  const location = page.url(); await page.keyboard.press('Enter'); assert.equal(await self.locator('.row-context').getAttribute('open') !== null, true); assert.equal(page.url(), location);
  await hello.locator('.row-context > summary').focus(); await page.keyboard.press('Space'); assert.equal(await page.locator('.row-context[open]').count(), 2);
  assert.equal(page.url(), location); assert.equal(await self.locator('.expanded-context > p').filter({ hasText: 'Make software lifecycle status, evidence and decisions mutually intelligible.' }).isVisible(), true);
  assert.deepEqual(identity(), unchanged); assert.deepEqual(exercise.requests(), []);
  assert.equal(await page.locator('summary a, summary button, summary input, summary summary').count(), 0);
  await capture('portfolio-expanded-desktop');
  await page.setViewportSize({ width: 390, height: 844 }); await capture('portfolio-expanded-mobile');
  await self.locator('.row-context > summary').click(); await hello.locator('.row-context > summary').click(); await capture('portfolio-collapsed-mobile');
  await hello.getByRole('link', { name: 'Hello Observatory', exact: true }).click(); assert.equal(new URL(page.url()).pathname, '/applications/hello-observatory');
  assert.equal(exercise.requests().length, 0);
  scenarios.push(`PASS: collapsed desktop rows ${heights.join('/')}px; independent Enter/Space disclosure vs name navigation; no nested interactive summary controls, state writes, observation or dispatch; desktop/mobile no overflow`);
  await page.setViewportSize({ width: 1440, height: 1050 });
  for (const item of exercise.environments) {
    await page.goto(`${address}/applications/hello-observatory`);
    await page.locator(`[data-destination=${item.id}]`).getByRole('link', { name: 'Change version', exact: true }).click();
    assert.equal(new URL(page.url()).hash, '#propose-change');
    assert.equal(await page.getByRole('combobox', { name: /^Destination/ }).inputValue(), item.id);
    await page.waitForFunction(() => { const bounds = document.querySelector('#propose-change').getBoundingClientRect(); return bounds.top >= -1 && bounds.top < innerHeight - 200; });
  }
  assert.deepEqual(identity(), unchanged); assert.equal(exercise.requests().length, 0);
  await capture('preselected-demo-production-desktop');
  await page.goto(`${address}/applications/hello-observatory`); await page.getByRole('button', { name: 'Refresh observations', exact: true }).click();
  await page.goto(`${address}/applications/hello-observatory`);
  await page.locator('[data-destination=test-reference]').getByRole('link', { name: 'Change version', exact: true }).click();
  await capture('preselected-test-desktop'); await page.setViewportSize({ width: 390, height: 844 }); await capture('preselected-test-mobile');
  assert.equal(await page.getByRole('combobox', { name: /^Destination/ }).inputValue(), 'test-reference');
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.getByRole('combobox', { name: /^Version/ }).selectOption('1.2.0'); await page.getByRole('button', { name: 'Review change', exact: true }).click();
  const requestId = page.url().split('/').at(-1);
  await page.getByLabel('Your name', { exact: true }).fill('Alex — demo operator'); await page.locator('input[name=scope]').check(); await page.getByRole('button', { name: 'Record decision', exact: true }).click();
  // A second applicable proposal for the same target must remain visible application-wide.
  const second = exercise.createRequest('1.0.0', 'test-reference', 'normal');
  for (const disposition of ['recommend', 'decline', 'defer']) { const plan = exercise.createRequest('1.1.0', 'test-reference', 'normal'); exercise.decide(plan.id, disposition, 'Alex', 'Demo operator', 'Non-executable declaration example', true); }
  await page.goto(`${address}/applications/hello-observatory`); assert.equal(await page.locator('[data-pending-request]').count(), 2);
  assert.equal(await page.locator('.activity-preview > li').count(), 3);
  const sections = await page.locator('#pending-changes,#propose-change,#recent-activity').evaluateAll((elements) => elements.map((element) => element.id)); assert.deepEqual(sections, ['pending-changes', 'propose-change', 'recent-activity']);
  await capture('pending-application-desktop'); await page.setViewportSize({ width: 390, height: 844 }); await capture('pending-application-mobile'); await page.setViewportSize({ width: 1440, height: 1050 });
  await page.getByText('Full activity & request history', { exact: true }).click(); await capture('expanded-activity-history');
  await page.goto(`${address}/reference/requests/${requestId}`); await page.getByRole('button', { name: 'Upgrade to 1.2.0', exact: true }).click();
  assert.equal(exercise.readBack(requestId), null); assert.equal(exercise.events(requestId).at(-1).data.outcome, 'completed');
  await capture('consumed-before-observation-desktop'); await page.setViewportSize({ width: 390, height: 844 }); await capture('consumed-before-observation-mobile'); await page.setViewportSize({ width: 1440, height: 1050 });
  await page.getByRole('button', { name: 'Observe target', exact: true }).click(); assert.equal(exercise.readBack(requestId).version, '1.2.0');
  await page.goto(`${address}/applications/hello-observatory`); assert.equal(await page.locator('[data-pending-request]').count(), 0); assert.equal(await page.getByText('No pending changes recorded.', { exact: true }).count(), 1);
  assert.equal(exercise.attempt(second.id), undefined); // Competing proposal is stale, not silently dispatched.
  await capture('after-change-no-pending');
  scenarios.push('PASS: each active card preselects its exact allowlisted destination and scrolls to the single shared form without creating a request; two applicable same-target requests shown, recommendations/declines/deferrals in history; pending → proposal → 3-event activity; explicit apply/observe remain distinct, consumed/stale work leaves pending');
  await page.goto(illustrationAddress); assert.equal(await page.locator('[data-application]').count(), 30); await capture('illustrative-register-30-desktop', false);
  await page.locator('.row-context > summary').first().click(); await capture('illustrative-long-expanded-desktop', false);
  await page.setViewportSize({ width: 390, height: 844 }); await capture('illustrative-long-expanded-mobile');
  await page.locator('.row-context > summary').first().click(); await capture('illustrative-register-30-mobile', false);
  assert.equal(await page.locator('form,input,button,script').count(), 0);
  scenarios.push('PASS: 30 clearly illustrative applications, long unbroken names/descriptions, collapsed and expanded desktop/mobile; no runtime registration, operational controls or overflow');
  assert.deepEqual(errors, []); assert.equal(externalRequests, 0);
  const report = { sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sourceDirty: execFileSync('git', ['status', '--porcelain=v1'], { encoding: 'utf8' }).trim() !== '', capturedAt: new Date().toISOString(), node: process.version,
    platform: `${process.platform} ${process.arch}`, browser: `Chromium ${browser.version()}`, collapsedRowHeights: heights, scenarios, browserErrors: errors, externalRequests,
    limits: 'Dev-run macOS/Chromium, not independent Test/health/standing. Only original three fixed reference targets execute; larger register is a labeled synthetic presentation fixture. Invalid/expired/refused preselection/pending cases are additionally covered by native integration tests.' };
  writeFileSync(join(output, 'demo.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2));
} finally { if (browser) await browser.close(); await illustrations.close(); await app.close(); rmSync(exercise.workspace.directory, { recursive: true, force: true }); }
