import Database from 'better-sqlite3';
import { chmodSync, lstatSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { dataDirectory } from './config.js';
import { schema, schemaVersion } from './migrations/001-self-catalog.js';
import { exerciseSchema } from './migrations/002-release-exercise.js';
import { externalRuntimeSchema } from './migrations/003-external-runtime.js';
import { externalHistoryIndexesSchema } from './migrations/004-external-history-indexes.js';

export interface Application {
  id: string;
  name: string;
  purpose: string;
  stewardship: string;
  source_url: string;
  source_revision: string;
  recorded_at: string;
  next_decision: string;
  next_decision_source: string;
}

export const sourceRevision = '3e5ee4925540c300a9b1ae9bdc267254ea644a7a';
export const projectUrl = 'https://github.com/bobrs/Application-Observatory';

export function openCatalog(directory?: string) {
  const localDirectory = dataDirectory(directory);
  mkdirSync(localDirectory, { recursive: true, mode: 0o700 });
  const path = join(localDirectory, 'catalog.sqlite');
  if (lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink()) {
    throw new Error('The catalog database must be a local file, not a symbolic link.');
  }
  const db = new Database(path, { timeout: 5000 });
  try {
    chmodSync(path, 0o600);
    db.transaction(() => {
      const version = db.pragma('user_version', { simple: true }) as number;
      if (version > 4) throw new Error('Database schema is newer than this application; use the matching source version.');
      if (version === 0) db.exec(schema);
      if (version <= schemaVersion) db.exec(exerciseSchema);
      if (version <= 2) db.exec(externalRuntimeSchema);
      if (version <= 3) db.exec(externalHistoryIndexesSchema);
      db.prepare(`INSERT INTO applications
        (id, name, purpose, stewardship, source_url, source_revision, recorded_at, next_decision, next_decision_source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`).run(
        'application-observatory',
        'Application Observatory',
        'Make software lifecycle status, evidence and decisions mutually intelligible.',
        'Product Sponsor / repository owner (role; individual not recorded)',
        `${projectUrl}/blob/${sourceRevision}/docs/PRODUCT_BRIEF.md`,
        sourceRevision,
        new Date().toISOString(),
        'PM review of AO-INC-001 evidence, then separate Product Sponsor merge authorization.',
        `${projectUrl}/issues/3`,
      );
    })();
    return {
      list: () => db.prepare('SELECT * FROM applications ORDER BY name, id').all() as Application[],
      find: (id: string) => db.prepare('SELECT * FROM applications WHERE id = ?').get(id) as Application | undefined,
      db,
      close: () => db.close(),
    };
  } catch (error) {
    db.close();
    throw error;
  }
}

export type Catalog = ReturnType<typeof openCatalog>;
