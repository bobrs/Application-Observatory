// Trusted fixture code only. Candidates are data, never programs or shell commands.
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { candidateById, digest, environmentById, faults, type State } from './model.js';
import { loadWorkspace, ownedDirectory, regularFile, replaceFile } from './workspace.js';

process.umask(0o077);
const directory = process.argv[2]!;
const environment = environmentById(process.argv[3]!);
const marker = loadWorkspace(directory);
const targetDirectory = join(directory, environment.id);
ownedDirectory(targetDirectory);
const file = join(targetDirectory, 'state.json');
regularFile(file);
let state: State = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as State : {
  candidateId: 'sample-v1', digest: candidateById('sample-v1').digest, generation: 0, operationId: null,
};
if (candidateById(state.candidateId).digest !== state.digest || !Number.isSafeInteger(state.generation) || state.generation < 0) throw new Error('Invalid fixture state.');
if (!existsSync(file)) replaceFile(file, JSON.stringify(state));
const instanceId = marker.instances[environment.id]!;
const bootId = randomUUID();
const server = createServer((request, response) => {
  if (request.method !== 'GET' || request.url !== '/payload') { response.writeHead(404).end(); return; }
  const bytes = candidateById(state.candidateId).bytes;
  response.writeHead(200, {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'X-AO-Instance': instanceId, 'X-AO-Boot': bootId,
    'X-AO-Generation': String(state.generation), 'X-AO-Operation': state.operationId ?? '',
  }).end(bytes);
});
// This one process owns/serializes its state; there is no network mutation API.
process.on('message', (message: unknown) => {
  if (!message || typeof message !== 'object') return;
  const command = message as Record<string, unknown>;
  const operationId = command.operationId;
  if (typeof operationId !== 'string' || !/^[0-9a-f-]{36}$/.test(operationId)) return;
  const reply = (outcome: string, detail: string) => process.send?.({ type: 'receipt', operationId, outcome, detail, generation: state.generation });
  try {
    if (command.action !== 'activate-bundled-sample' || !faults.includes(command.fault as typeof faults[number])) throw new Error('Unsupported fixture action.');
    if (state.operationId === operationId) { reply('completed', 'Duplicate operation; prior activation retained.'); return; }
    if (command.instanceId !== instanceId || command.bootId !== bootId || command.expectedGeneration !== state.generation || command.expectedDigest !== state.digest) {
      reply('refused', 'Target state or incarnation changed; no activation performed.'); return;
    }
    const candidate = candidateById(String(command.candidateId));
    if (command.candidateDigest !== digest(candidate.bytes)) throw new Error('Payload identity mismatch.');
    if (command.fault === 'refuse') { reply('failed', 'Injected fixture failure before activation; bytes unchanged.'); return; }
    const next: State = { candidateId: candidate.id, digest: candidate.digest, generation: state.generation + 1, operationId };
    replaceFile(file, JSON.stringify(next));
    state = next;
    if (command.fault !== 'lost-receipt') reply('completed', 'Fixture activated the selected sample bytes. This is an adapter receipt, not a read-back.');
  } catch {
    // A filesystem error may be after replacement: never assert that nothing changed.
    reply('unknown', 'Fixture could not establish a terminal result; observe target before any new action.');
  }
});
function shutdown() { server.close(() => process.exit(0)); }
process.on('disconnect', shutdown);
process.on('SIGTERM', shutdown);
server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (address && typeof address !== 'string') process.send?.({ type: 'ready', address: `http://127.0.0.1:${address.port}`, instanceId, bootId });
});
