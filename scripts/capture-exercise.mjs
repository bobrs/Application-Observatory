import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createExercise } from '../dist/exercise/controller.js';
import { createApplication } from '../dist/app.js';

process.env.PLAYWRIGHT_BROWSERS_PATH = resolve('.cache/playwright');
const { chromium } = await import('playwright');
const output = resolve('test-results/exercise');
mkdirSync(output, { recursive: true });
const exercise = await createExercise();
const app = createApplication(exercise.workspace.directory, exercise);
let browser;
const scenarios = [];
try {
  const address = await app.listen({ port: 0, host: '127.0.0.1' });
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}`); });
  let externalRequests = 0;
  await page.route('**/*', (route) => {
    if (route.request().url().startsWith(`${address}/`)) return route.continue();
    externalRequests++;
    return route.abort();
  });
  async function capture(name) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: join(output, `${name}.png`), fullPage: true });
  }
  async function request(fault = 'normal', candidate = 'sample-v2', destination = 'test-sandbox') {
    await page.goto(`${address}/exercise`);
    await page.getByRole('combobox', { name: /^Sample version/ }).selectOption(candidate);
    await page.getByRole('combobox', { name: /^Concrete destination/ }).selectOption(destination);
    if (fault !== 'normal') {
      await page.getByText('Demonstration faults (optional, explicitly injected)', { exact: true }).click();
      await page.getByRole('combobox', { name: /^Fixture condition/ }).selectOption(fault);
    }
    await page.getByRole('button', { name: 'Review release request', exact: true }).click();
    return new URL(page.url()).pathname.split('/').at(-1);
  }
  async function decision(disposition = 'authorize') {
    await page.getByLabel('Actor (self-declared)', { exact: true }).fill('Alex — demo operator');
    await page.getByRole('combobox', { name: /^Decision/ }).selectOption(disposition);
    await page.locator('input[name=scope]').check();
    await page.getByRole('button', { name: 'Record demo decision', exact: true }).click();
  }
  async function apply() { await page.getByRole('button', { name: /^Apply Sample/ }).click(); }
  await page.goto(`${address}/exercise`);
  await page.getByRole('button', { name: 'Observe Dev Sandbox', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Observe Test Sandbox', exact: true }).count(), 1, await page.locator('body').innerText());
  await page.getByRole('button', { name: 'Observe Test Sandbox', exact: true }).click();
  const development = await request('normal', 'sample-v2', 'dev-sandbox');
  await decision(); await apply();
  await page.getByRole('button', { name: 'Observe target separately', exact: true }).click();
  assert.equal(exercise.readBack(development).generation, 1);
  scenarios.push('PASS: same immutable sample activated and observed first in Development, then selected for Test; stage is distinct from instance');
  await page.goto(`${address}/exercise`);
  await capture('destinations-desktop');
  const success = await request();
  await decision(); await apply();
  assert.equal(exercise.readBack(success), null);
  assert.equal(exercise.events(success).at(-1).data.outcome, 'completed');
  await capture('receipt-before-observation');
  await page.getByRole('button', { name: 'Observe target separately', exact: true }).click();
  assert.equal(exercise.readBack(success).generation, 1);
  await capture('success-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await capture('success-mobile');
  scenarios.push('PASS: authorized Test activation, no observation inferred from receipt, separate HTTP read-back matches, desktop/mobile no overflow');
  await page.setViewportSize({ width: 1280, height: 1000 });
  const declined = await request('normal', 'sample-v1');
  await decision('decline');
  assert.equal(await page.getByRole('button', { name: /^Apply Sample/ }).isDisabled(), true);
  await exercise.apply(declined); // Also exercise the backend refusal rather than relying on disabled UI.
  await page.reload();
  assert.equal(exercise.attempt(declined), undefined);
  await capture('declined');
  scenarios.push('PASS: declined request has no dispatch and backend refusal is recorded');
  const failed = await request('refuse', 'sample-v1');
  await decision(); await apply();
  assert.equal(exercise.events(failed).at(-1).data.outcome, 'failed');
  await capture('failed');
  scenarios.push('PASS: explicitly injected pre-activation failure has a separate failed adapter receipt');
  const stale = await request('normal', 'sample-v1');
  await decision();
  const changed = await request('normal', 'sample-v2');
  await decision(); await apply();
  assert.equal(exercise.events(changed).at(-1).data.outcome, 'completed');
  await page.goto(`${address}/exercise/requests/${stale}`);
  await apply();
  assert.equal(exercise.attempt(stale), undefined);
  assert.equal(await page.getByRole('button', { name: /^Apply Sample/ }).isDisabled(), true);
  await capture('stale');
  scenarios.push('PASS: another request changes generation; stale authorized request cannot dispatch');
  await page.goto(`${address}/exercise`);
  await page.getByRole('button', { name: 'Observe Test Sandbox', exact: true }).click();
  const uncertain = await request('lost-receipt', 'sample-v1');
  await decision(); await apply();
  assert.equal(exercise.events(uncertain).at(-1).data.outcome, 'unknown');
  await capture('uncertain-result');
  await page.getByRole('button', { name: 'Observe target separately', exact: true }).click();
  assert.equal(exercise.readBack(uncertain).generation, 3);
  await exercise.targets.get('test-sandbox').stop(); // Labeled fixture outage, not a real host operation.
  await page.getByRole('button', { name: 'Observe target separately', exact: true }).click();
  assert.equal(exercise.readBack(uncertain).outcome, 'unknown');
  await capture('unknown-observation');
  scenarios.push('PASS: lost receipt after real local change remains unknown; read-back proves bytes separately; fixture outage preserves observation uncertainty');
  assert.deepEqual(errors, []);
  assert.equal(externalRequests, 0);
  const report = {
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceDirty: execFileSync('git', ['status', '--porcelain=v1'], { encoding: 'utf8' }).trim() !== '',
    capturedAt: new Date().toISOString(), node: process.version, platform: `${process.platform} ${process.arch}`,
    browser: `Chromium ${browser.version()}`, scenarios,
    limits: 'Same-host trusted fixture/data-only payloads; faults explicitly injected. Not a real deployment, health attestation or independent Test acceptance.',
  };
  writeFileSync(join(output, 'demo.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (browser) await browser.close();
  await app.close();
  rmSync(exercise.workspace.directory, { recursive: true, force: true });
}
