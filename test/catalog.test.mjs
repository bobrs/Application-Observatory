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
  assert.equal(db.pragma('user_version', { simple: true }), 4);
  assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='index' AND name LIKE 'external_events_%'").get().n, 5);
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
  db.pragma('user_version = 5');
  db.close();
  assert.throws(() => openCatalog(directory), /newer/);
  const unchanged = new Database(join(directory, 'catalog.sqlite'));
  assert.equal(unchanged.pragma('user_version', { simple: true }), 5);
  assert.deepEqual(unchanged.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all(), []);
  unchanged.close();
});

test('populated schema 3 migrates to indexed schema 4 without changing retained directive or event evidence across restarts', (t) => {
  const directory = fixture(t);
  let catalog = openCatalog(directory); catalog.close();
  const db = new Database(join(directory, 'catalog.sqlite'));
  db.exec(`DROP INDEX external_events_latest_observation;
    DROP INDEX external_events_latest_known_observation;
    DROP INDEX external_events_artifact_observation;
    DROP INDEX external_events_target_sequence;
    DROP INDEX external_events_directive_kind_sequence;
    PRAGMA user_version=3;`);
  const directive = ['legacy-directive','legacy-backend','legacy-app','legacy-target','legacy-instance','rollback','1.0.0','sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','2026-10-30T12:00:00Z','boot-before','Legacy operator','Preserve this complete rationale'];
  db.prepare('INSERT INTO external_directives (id,backend_id,application_id,destination_id,instance_id,action,version,artifact_id,created_at,expected_boot_id,actor,rationale) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(...directive);
  const payloads = [
    JSON.stringify({schemaVersion:1,eventId:'legacy-observation',backendId:'legacy-backend',applicationId:'legacy-app',destinationId:'legacy-target',instanceId:'legacy-instance',directiveId:null,kind:'observation',source:'legacy source',detail:'original observation bytes',outcome:'observed',observedAt:'2026-10-30T12:00:00Z',version:'1.0.0',artifactId:directive[7],bootId:'boot-before'}),
    JSON.stringify({schemaVersion:1,eventId:'legacy-receipt',backendId:'legacy-backend',applicationId:'legacy-app',destinationId:'legacy-target',instanceId:'legacy-instance',directiveId:'legacy-directive',kind:'receipt',source:'legacy client',detail:'original receipt bytes',outcome:'unknown',artifactId:directive[7],startedAt:'2026-10-30T12:00:01Z',finishedAt:'2026-10-30T12:00:02Z'}),
  ];
  const eventInsert = db.prepare('INSERT INTO external_events (event_id,backend_id,application_id,destination_id,instance_id,directive_id,kind,source,detail,outcome,version,artifact_id,boot_id,observed_at,started_at,finished_at,recorded_at,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  eventInsert.run('legacy-observation','legacy-backend','legacy-app','legacy-target','legacy-instance',null,'observation','legacy source','original observation bytes','observed','1.0.0',directive[7],'boot-before','2026-10-30T12:00:00Z',null,null,'2026-10-30T12:00:03Z',payloads[0]);
  eventInsert.run('legacy-receipt','legacy-backend','legacy-app','legacy-target','legacy-instance','legacy-directive','receipt','legacy client','original receipt bytes','unknown',null,directive[7],null,null,'2026-10-30T12:00:01Z','2026-10-30T12:00:02Z','2026-10-30T12:00:04Z',payloads[1]);
  db.close();

  for (let restart = 0; restart < 3; restart++) {
    catalog = openCatalog(directory);
    assert.equal(catalog.db.pragma('user_version', { simple: true }), 4);
    assert.equal(catalog.db.prepare('SELECT COUNT(*) AS n FROM external_directives').get().n, 1);
    assert.equal(catalog.db.prepare('SELECT COUNT(*) AS n FROM external_events').get().n, 2);
    assert.deepEqual(catalog.db.prepare('SELECT id,actor,rationale,expected_boot_id FROM external_directives').get(), {id:directive[0],actor:directive[10],rationale:directive[11],expected_boot_id:directive[9]});
    assert.deepEqual(catalog.db.prepare('SELECT event_id,payload_json FROM external_events ORDER BY seq').all(), [{event_id:'legacy-observation',payload_json:payloads[0]},{event_id:'legacy-receipt',payload_json:payloads[1]}]);
    assert.equal(catalog.db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='index' AND name LIKE 'external_events_%'").get().n, 5);
    catalog.close();
  }
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
