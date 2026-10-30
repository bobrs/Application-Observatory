import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { openCatalog } from '../dist/catalog.js';
import { dataDirectory, portNumber } from '../dist/config.js';

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'ao-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('migration and seed are repeatable and never replace persisted metadata', (t) => {
  const directory = fixture(t);
  let catalog = openCatalog(directory);
  const initial = catalog.list();
  assert.equal(initial.length, 1);
  assert.equal(initial[0].id, 'application-observatory');
  assert.match(initial[0].source_url, /\/blob\/[0-9a-f]{40}\/docs\/PRODUCT_BRIEF\.md$/);
  catalog.close();
  const db = new Database(join(directory, 'catalog.sqlite'));
  assert.equal(db.pragma('user_version', { simple: true }), 3);
  db.prepare('UPDATE applications SET purpose = ? WHERE id = ?').run('Disposable persistence fixture', initial[0].id);
  db.close();
  for (let restart = 0; restart < 3; restart++) {
    catalog = openCatalog(directory);
    assert.equal(catalog.list().length, 1);
    assert.equal(catalog.find(initial[0].id).purpose, 'Disposable persistence fixture');
    assert.equal(catalog.find(initial[0].id).recorded_at, initial[0].recorded_at);
    assert.equal(catalog.find("' OR 1=1 --"), undefined);
    catalog.close();
  }
});

test('a newer database schema fails without seeding or downgrading it', (t) => {
  const directory = fixture(t);
  const db = new Database(join(directory, 'catalog.sqlite'));
  db.pragma('user_version = 4');
  db.close();
  assert.throws(() => openCatalog(directory), /newer/);
  const unchanged = new Database(join(directory, 'catalog.sqlite'));
  assert.equal(unchanged.pragma('user_version', { simple: true }), 4);
  assert.deepEqual(unchanged.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all(), []);
  unchanged.close();
});

test('runtime configuration rejects repository, symlinked repository and common sync paths', (t) => {
  const directory = fixture(t);
  assert.throws(() => dataDirectory(resolve('.')), /outside the repository/);
  assert.throws(() => dataDirectory(resolve('runtime-data')), /outside the repository/);
  symlinkSync(resolve('.'), join(directory, 'checkout'), 'dir');
  assert.throws(() => dataDirectory(join(directory, 'checkout', 'data')), /outside the repository/);
  assert.throws(() => dataDirectory(join(directory, 'Dropbox', 'catalog')), /synchronized/);
  assert.throws(() => dataDirectory('relative-data'), /absolute/);
  assert.equal(dataDirectory(directory), realpathSync(directory));
  assert.equal(portNumber('0'), 0);
  assert.equal(portNumber('4310'), 4310);
  for (const bad of ['-1', '65536', '4310abc', '', '1.2']) assert.throws(() => portNumber(bad));
});

test('a symbolic-link database is rejected without changing its target', (t) => {
  const directory = fixture(t);
  const target = join(directory, 'untouched-fixture.txt');
  writeFileSync(target, 'leave this fixture unchanged');
  symlinkSync(target, join(directory, 'catalog.sqlite'));
  assert.throws(() => openCatalog(directory), /not a symbolic link/);
  assert.equal(readFileSync(target, 'utf8'), 'leave this fixture unchanged');
});
