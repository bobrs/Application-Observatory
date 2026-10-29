import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createExercise } from '../dist/exercise/controller.js';
import { createApplication } from '../dist/app.js';

process.env.PLAYWRIGHT_BROWSERS_PATH = resolve('.cache/playwright');
const { chromium } = await import('playwright');
const output = resolve('test-results/reference'); mkdirSync(output, { recursive: true });
const exercise = await createExercise(undefined, undefined, true);
const app = createApplication(exercise.workspace.directory, exercise);
let browser; const scenarios = [];
try {
  const address = await app.listen({ port: 0, host: '127.0.0.1' });
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const page = await context.newPage();
  const errors = []; let externalRequests = 0;
  const watch = (tab) => {
    tab.on('pageerror', (error) => errors.push(error.message));
    tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    tab.on('response', (response) => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}`); });
  };
  watch(page); context.on('page', watch);
  await context.route('**/*', (route) => {
    const request = route.request().url();
    const owned = [address, ...[...exercise.targets.values()].filter((target) => target.child.connected).map((target) => target.address)];
    if (owned.some((url) => request.startsWith(`${url}/`))) return route.continue();
    externalRequests++; return route.abort();
  });
  const capture = async (name) => {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name}: horizontal overflow`);
    await page.screenshot({ path: join(output, `${name}.png`), fullPage: true });
  };
  async function overview() { await page.goto(`${address}/reference`); }
  async function refresh() { await overview(); await page.getByRole('button', { name: 'Refresh observations', exact: true }).click(); }
  async function request(version, fault = 'normal') {
    await overview(); await page.getByRole('combobox', { name: /^Version/ }).selectOption(version);
    await page.getByRole('combobox', { name: /^Destination/ }).selectOption('test-reference');
    if (fault !== 'normal') { await page.getByText('Demonstration faults', { exact: true }).click(); await page.getByRole('combobox', { name: /^Injected condition/ }).selectOption(fault); }
    await page.getByRole('button', { name: 'Review change', exact: true }).click();
    return page.url().split('/').at(-1);
  }
  async function decide(disposition = 'authorize') {
    await page.getByRole('combobox', { name: /^Decision/ }).selectOption(disposition);
    await page.getByLabel('Your name', { exact: true }).fill('Alex — demo operator');
    await page.getByLabel('Rationale', { exact: true }).fill('Explicit local disposable reference demonstration.');
    await page.locator('input[name=scope]').check(); await page.getByRole('button', { name: 'Record decision', exact: true }).click();
  }
  const apply = () => page.getByRole('button', { name: /^(Upgrade|Rollback|Restart|Activate) to / }).click();
  await refresh();
  assert.deepEqual(exercise.environments.map((item) => exercise.latestObservation(item.id).version), ['1.2.0', '1.1.0', '1.0.0']);
  const initialBoots = [...exercise.targets.values()].map((target) => target.bootId);
  await capture('three-destinations-desktop');
  const firstCard = page.locator('[data-destination=dev-reference]');
  await firstCard.getByText('Evidence', { exact: true }).click();

  assert.match(await firstCard.innerText(), /sha256:7410f8f433f8d7668000a290b573df8873334ca1f4aadc4622c48b76610b199f/);
  await capture('destination-evidence');
  await firstCard.getByText('Evidence', { exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 }); await capture('three-destinations-mobile');
  await page.setViewportSize({ width: 1440, height: 1050 });
  const upgrade = await request('1.2.0'); await decide(); await capture('upgrade-authorized');
  await page.setViewportSize({ width: 390, height: 844 }); await capture('upgrade-authorized-mobile');
  await page.setViewportSize({ width: 1440, height: 1050 }); await apply();
  assert.equal(exercise.readBack(upgrade), null); assert.equal(exercise.events(upgrade).at(-1).data.outcome, 'completed');
  await capture('receipt-before-observation');
  await page.getByRole('button', { name: 'Observe target', exact: true }).click();
  assert.equal(exercise.readBack(upgrade).version, '1.2.0');
  await refresh(); await capture('test-upgraded');
  const appPage = await context.newPage();
  await appPage.goto(exercise.targets.get('test-reference').address);
  assert.equal(await appPage.locator('h1').innerText(), '1.2.0');
  await appPage.screenshot({ path: join(output, 'actual-test-app-upgraded.png'), fullPage: true });
  await appPage.close();
  const rollback = await request('1.1.0'); await decide(); await apply();
  await page.getByRole('button', { name: 'Observe target', exact: true }).click();
  assert.equal(exercise.readBack(rollback).digest, exercise.candidate('1.1.0').digest);
  await refresh(); await capture('test-rolled-back');
  const actual = await context.newPage();
  await actual.goto(exercise.targets.get('test-reference').address); assert.equal(await actual.locator('h1').innerText(), '1.1.0');
  await actual.screenshot({ path: join(output, 'actual-test-app-rolled-back.png'), fullPage: true }); await actual.close();
  for (const i of [0, 2]) assert.equal([...exercise.targets.values()][i].bootId, initialBoots[i]);
  scenarios.push('PASS: three real destination versions, desktop/mobile, explicit authorization/apply, real new-process upgrade and exact retained-package rollback, separate HTTP observations, other two boots unchanged');
  const declined = await request('1.0.0'); await decide('decline'); assert.equal(await page.getByRole('button', { name: /^Rollback to/ }).isDisabled(), true);
  await exercise.apply(declined); assert.equal(exercise.attempt(declined), undefined);
  const stale = await request('1.0.0'); await decide();
  await request('1.2.0'); await decide(); await apply();
  await page.goto(`${address}/reference/requests/${stale}`); assert.equal(await page.getByRole('button', { name: /^Rollback to/ }).isDisabled(), true);
  await exercise.apply(stale); assert.equal(exercise.attempt(stale), undefined); await page.reload(); await capture('stale-request');
  await refresh(); const refused = await request('1.1.0', 'refuse'); await decide(); await apply();
  assert.equal(exercise.events(refused).at(-1).data.outcome, 'failed');
  await refresh(); const uncertain = await request('1.1.0', 'lost-receipt'); await decide(); await apply();
  assert.equal(exercise.events(uncertain).at(-1).data.outcome, 'unknown');
  await page.getByRole('button', { name: 'Observe target', exact: true }).click(); assert.equal(exercise.readBack(uncertain).version, '1.1.0');
  await capture('unknown-receipt-observed-version');
  await refresh(); const failed = await request('1.2.0', 'launch-failure'); await decide(); await apply();
  assert.equal(exercise.events(failed).at(-1).data.outcome, 'failed');
  await capture('failed-launch');
  await refresh(); assert.equal(exercise.latestObservation('test-reference').outcome, 'unknown');
  assert.equal(exercise.latestObservation('dev-reference').outcome, 'observed'); assert.equal(exercise.latestObservation('production-reference').outcome, 'observed');
  await capture('unavailable-preserves-other-destinations');
  scenarios.push('PASS: decline and stale request backend refusal; injected refusal/startup failure; withheld receipt stays unknown despite matching fresh version; failed refresh preserves explicitly historical last-known and two other independent observations');
  assert.deepEqual(errors, []); assert.equal(externalRequests, 0);
  const report = {
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceDirty: execFileSync('git', ['status', '--porcelain=v1'], { encoding: 'utf8' }).trim() !== '',
    capturedAt: new Date().toISOString(), node: process.version, platform: `${process.platform} ${process.arch}`, browser: `Chromium ${browser.version()}`,
    referenceReviewedCommit: '982aeb68451a8044a00c15a7f079861ac53e31bb', referenceMergeCommit: 'da5731368d49c0426fd57a52588ff3db3e4a69e2',
    acceptedArtifacts: exercise.candidates, scenarios, browserErrors: errors, externalRequests,
    limits: 'Developer checks on macOS arm64/Chromium; same-host trusted packages, not independent Test, health or hostile-host attestation. No external deployment.',
  };
  writeFileSync(join(output, 'demo.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2));
} finally {
  if (browser) await browser.close(); await app.close(); rmSync(exercise.workspace.directory, { recursive: true, force: true });
}
