import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest } from '../exercise/model.js';

// Accepted Step A index, pinned OUTSIDE candidate packages. No arbitrary intake.
export const referenceCandidates = [
  { id: '1.0.0', label: '1.0.0', digest: 'sha256:53cfab8899f14848e3979a1afa2e41c12334fb05bccee5c55398d53598c04262' },
  { id: '1.1.0', label: '1.1.0', digest: 'sha256:17498c7bc08280b1bc2077d9ee302bdada8fb401192f2efce61f594ad2b236e8' },
  { id: '1.2.0', label: '1.2.0', digest: 'sha256:7410f8f433f8d7668000a290b573df8873334ca1f4aadc4622c48b76610b199f' },
];
export const referenceDestinations = [
  { id: 'dev-reference', name: 'Dev Reference', stage: 'Development', initial: '1.2.0' },
  { id: 'test-reference', name: 'Test Reference', stage: 'Test', initial: '1.1.0' },
  { id: 'production-reference', name: 'Demo Production', stage: 'Production', initial: '1.0.0' },
] as const;
export const referenceFaults = ['normal', 'refuse', 'launch-failure', 'lost-receipt'] as const;
export const payloadFiles = ['identity.mjs', 'page.html', 'release.json', 'server.mjs', 'style.css'];
export const packageFiles = [...payloadFiles, 'artifact.json'];
export const bundledRoot = fileURLToPath(new URL('../../fixtures/reference/', import.meta.url));
export function referenceCandidate(id: string) {
  const candidate = referenceCandidates.find((item) => item.id === id);
  if (!candidate) throw new Error('Select one of the three accepted reference artifacts.');
  return candidate;
}
export function referenceDestination(id: string) {
  const destination = referenceDestinations.find((item) => item.id === id);
  if (!destination) throw new Error('Select one of the three disposable reference destinations.');
  return destination;
}
export function boundedFile(path: string) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 1024 * 1024) throw new Error('Reference package requires bounded regular unlinked files.');
  return readFileSync(path);
}
export function verifyReference(directory: string, version: string) {
  // This trusted Observatory code reads bytes; it never imports the candidate verifier.
  const expected = referenceCandidate(version);
  const stat = lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Reference package directory must not be a link.');
  if (JSON.stringify(readdirSync(directory).sort()) !== JSON.stringify([...packageFiles].sort())) throw new Error('Reference package membership differs.');
  const files = payloadFiles.map((path) => { const bytes = boundedFile(join(directory, path)); return { path, size: bytes.length, sha256: digest(bytes) }; });
  const manifest = { schemaVersion: 1, files };
  const artifactId = `sha256:${digest(JSON.stringify(manifest) + '\n')}`;
  if (artifactId !== expected.digest) throw new Error('Reference bytes differ from the accepted external digest.');
  const sidecar = JSON.parse(boundedFile(join(directory, 'artifact.json')).toString('utf8'));
  if (JSON.stringify(sidecar) !== JSON.stringify({ ...manifest, artifactId })) throw new Error('Reference sidecar differs from verified bytes.');
  const release = JSON.parse(boundedFile(join(directory, 'release.json')).toString('utf8'));
  if (release.applicationId !== 'observatory-hello-reference' || release.version !== version) throw new Error('Reference release mapping differs from the accepted index.');
  return expected;
}
