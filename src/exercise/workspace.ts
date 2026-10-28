import { closeSync, constants, existsSync, fsyncSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dataDirectory } from '../config.js';
import { candidates, environments } from './model.js';

export interface Workspace {
  kind: 'ao-local-release-exercise'; id: string; createdAt: string;
  instances: Record<string, string>; sampleDigests: string[];
}
export function regularFile(path: string) {
  const stat = lstatSync(path, { throwIfNoEntry: false });
  if (stat && (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1)) throw new Error('Exercise files must be owned regular files, not links.');
}
export function ownedDirectory(path: string) {
  const stat = lstatSync(path, { throwIfNoEntry: false });
  if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) throw new Error('Exercise directories cannot be symbolic links.');
  mkdirSync(path, { recursive: true, mode: 0o700 });
}
export function replaceFile(path: string, text: string) {
  regularFile(path);
  const temporary = `${path}.${randomUUID()}.next`;
  const fd = openSync(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  try { writeFileSync(fd, text); fsyncSync(fd); } finally { closeSync(fd); }
  try { renameSync(temporary, path); } finally { if (existsSync(temporary)) unlinkSync(temporary); }
}
export function loadWorkspace(directory: string): Workspace {
  ownedDirectory(directory);
  const marker = join(directory, 'workspace.json');
  regularFile(marker);
  const value = JSON.parse(readFileSync(marker, 'utf8')) as Workspace;
  if (value.kind !== 'ao-local-release-exercise' || !/^[0-9a-f-]{36}$/.test(value.id)
    || environments.some((env) => !/^[0-9a-f-]{36}$/.test(value.instances?.[env.id] ?? ''))
    || new Set(Object.values(value.instances)).size !== 2
    || JSON.stringify(value.sampleDigests) !== JSON.stringify(candidates.map((item) => item.digest))) {
    throw new Error('Workspace marker does not match this fixed exercise. Create a new workspace.');
  }
  return value;
}
export function openWorkspace(resume?: string) {
  // An explicit resume may only open a previously generated marked workspace.
  if (resume && lstatSync(resume).isSymbolicLink()) throw new Error('Workspace cannot be a symbolic link.');
  const directory = dataDirectory(resume ?? mkdtempSync(join(tmpdir(), 'ao-release-')));
  if (!resume) {
    const marker: Workspace = {
      kind: 'ao-local-release-exercise', id: randomUUID(), createdAt: new Date().toISOString(),
      instances: Object.fromEntries(environments.map((env) => [env.id, randomUUID()])),
      sampleDigests: candidates.map((item) => item.digest),
    };
    replaceFile(join(directory, 'workspace.json'), JSON.stringify(marker));
  }
  const marker = loadWorkspace(directory);
  const lock = join(directory, 'controller.lock');
  regularFile(lock);
  if (existsSync(lock)) {
    const previous = Number(readFileSync(lock, 'utf8'));
    if (!Number.isSafeInteger(previous) || previous <= 0) throw new Error('Invalid workspace lock; do not reuse this workspace.');
    let alive = true;
    try { process.kill(previous, 0); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') alive = false; }
    if (alive) throw new Error('This exercise workspace already has a live controller.');
    unlinkSync(lock);
  }
  const fd = openSync(lock, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  try { writeFileSync(fd, String(process.pid)); } finally { closeSync(fd); }
  return { directory, marker, unlock: () => unlinkSync(lock) };
}
