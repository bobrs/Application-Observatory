import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { startLocalServer } from './local-server.mjs';

process.env.PLAYWRIGHT_BROWSERS_PATH = resolve('.cache/playwright');
const { chromium } = await import('playwright');
const output = resolve('test-results/demo');
mkdirSync(output, { recursive: true });
const directory = mkdtempSync(join(tmpdir(), 'ao-demo-'));
let server;
let browser;
try {
  server = await startLocalServer(directory);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}`); });
  const requests = [];
  await page.route('**/*', (route) => {
    requests.push(route.request().url());
    if (!route.request().url().startsWith(`${server.address}/`)) return route.abort();
    return route.continue();
  });
  await page.goto(server.address);
  assert.equal(await page.locator('.unknown').count(), 3);
  assert.equal(await page.getByText('1 application', { exact: true }).count(), 1);
  await page.screenshot({ path: join(output, 'catalog-desktop.png'), fullPage: true });
  await page.getByRole('link', { name: 'View application' }).click();
  assert.match(await page.title(), /Application Observatory/);
  assert.equal(await page.locator('.unknown').count(), 3);
  assert.equal(await page.getByText('Recorded next decision', { exact: true }).count(), 1);
  await page.screenshot({ path: join(output, 'detail-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: join(output, 'detail-mobile.png'), fullPage: true });
  await page.getByRole('link', { name: 'Application catalog', exact: true }).click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: join(output, 'catalog-mobile.png'), fullPage: true });
  assert.deepEqual(errors, []);
  assert.equal(requests.every((url) => url.startsWith(`${server.address}/`)), true);
  const report = {
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceDirty: execFileSync('git', ['status', '--porcelain=v1'], { encoding: 'utf8' }).trim() !== '',
    capturedAt: new Date().toISOString(),
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    browser: `Chromium ${browser.version()}`,
    result: 'PASS: desktop list/detail, mobile list/detail without horizontal overflow, navigation, three unknown environments, next decision, no page/console/HTTP errors or external requests',
    data: 'Disposable local fixture; removed after capture. Seed timestamp is record creation, not observation time.',
  };
  writeFileSync(join(output, 'demo.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (browser) await browser.close();
  if (server) await server.stop();
  rmSync(directory, { recursive: true, force: true });
}
