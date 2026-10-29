import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { digest, type Observation, type Receipt } from '../exercise/model.js';
import type { Target } from '../exercise/adapter.js';
import { loadWorkspace, ownedDirectory, regularFile, replaceFile } from '../exercise/workspace.js';
import { boundedFile, bundledRoot, packageFiles, referenceCandidate, referenceCandidates, referenceDestination, verifyReference } from './catalog.js';

export function retainPackages(workspace: string) {
  const root = join(workspace, 'packages');
  ownedDirectory(root);
  for (const candidate of referenceCandidates) {
    verifyReference(join(bundledRoot, candidate.id), candidate.id);
    const directory = join(root, candidate.id);
    if (!existsSync(directory)) {
      mkdirSync(directory, { mode: 0o700 });
      for (const file of packageFiles) writeFileSync(join(directory, file), boundedFile(join(bundledRoot, candidate.id, file)), { flag: 'wx', mode: 0o400 });
    }
    verifyReference(directory, candidate.id); // Never repair an altered retained artifact.
  }
}
export function running(target: Target) { return target.child.exitCode === null && target.child.signalCode === null && target.child.connected; }
async function stopChild(child: ChildProcess) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 2000);
  try { await exited; } finally { clearTimeout(timer); }
}
export async function startReferenceTarget(workspace: string, id: string): Promise<Target> {
  const marker = loadWorkspace(workspace, true);
  const destination = referenceDestination(id);
  const instanceId = marker.instances[id]!;
  const runtime = join(workspace, id);
  ownedDirectory(runtime);
  const selection = join(runtime, 'retained-selection.json');
  regularFile(selection);
  // Resume is an explicit fresh runtime from the last retained selection, never a replay of an old request.
  let selected = existsSync(selection) ? JSON.parse(boundedFile(selection).toString('utf8')).version as string : destination.initial;
  referenceCandidate(selected);
  let current: { child: ChildProcess; address: string; bootId: string };
  let busy = false;
  let closing = false;
  let settled = Promise.resolve();
  async function launch(version: string) {
    const directory = join(workspace, 'packages', version);
    const expected = verifyReference(directory, version); // Trusted verifier BEFORE any candidate code.
    const child = fork(join(directory, 'server.mjs'), [], {
      cwd: runtime, execArgv: [], env: {
        SystemRoot: process.env.SystemRoot, HELLO_PORT: '0', HELLO_STAGE: destination.stage,
        HELLO_DESTINATION_ID: id, HELLO_INSTANCE_ID: instanceId, HELLO_DISPOSABLE_DEMO: 'true',
      }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    try {
      const ready = await new Promise<{ address: string; bootId: string }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Reference startup timed out.')), 5000);
        const fail = () => { clearTimeout(timer); reject(new Error('Reference exited before verified startup.')); };
        child.once('error', fail); child.once('exit', fail);
        child.on('message', (value: unknown) => {
          const message = value as { type?: string; address?: string; identity?: Record<string, unknown> };
          if (message?.type !== 'ready') return;
          clearTimeout(timer);
          const identity = message.identity;
          const context = identity?.context as Record<string, unknown> | undefined;
          if (!message.address || !/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(message.address)
            || identity?.applicationId !== 'observatory-hello-reference' || identity.version !== version || identity.artifactId !== expected.digest
            || typeof identity.bootId !== 'string' || !/^[0-9a-f-]{36}$/.test(identity.bootId)
            || context?.destinationId !== id || context.instanceId !== instanceId || context.stage !== destination.stage || context.disposableDemo !== true) {
            reject(new Error('Reference startup identity conflicts with verified package and fixed context.')); return;
          }
          resolve({ address: message.address, bootId: identity.bootId });
        });
      });
      return { child, ...ready };
    } catch (error) { await stopChild(child); throw error; }
  }
  current = await launch(selected);
  try { replaceFile(selection, JSON.stringify({ version: selected })); }
  catch (error) { await stopChild(current.child); throw error; }
  const target: Target = {
    instanceId, get bootId() { return current.bootId; }, get address() { return current.address; }, get child() { return current.child; },
    activate: async (plan): Promise<Receipt> => {
      if (busy || closing || !running(target) || plan.action !== 'activate-reference-artifact' || plan.instanceId !== instanceId || plan.bootId !== current.bootId
        || plan.expected?.digest !== referenceCandidate(selected).digest || plan.expected.bootId !== current.bootId) {
        return { outcome: 'refused', detail: 'Destination is busy, stopped, or no longer matches the exact expected incarnation.', source: 'Fixed local launcher validation' };
      }
      busy = true;
      let finish!: () => void;
      settled = new Promise<void>((resolve) => { finish = resolve; });
      try {
        if (plan.fault === 'refuse') return { outcome: 'failed', detail: 'Injected refusal before stopping the current app.', source: 'Fixed local launcher — injected failure' };
        const candidate = referenceCandidate(plan.candidateId);
        if (candidate.digest !== plan.candidateDigest) throw new Error('Candidate mapping changed.');
        try { verifyReference(join(workspace, 'packages', candidate.id), candidate.id); }
        catch { return { outcome: 'failed', detail: 'Selected package failed trusted external-digest verification before execution. Current app was not stopped.', source: 'Trusted Observatory pre-execution verifier' }; }
        await stopChild(current.child);
        if (closing) throw new Error('Controller is stopping.');
        if (plan.fault === 'launch-failure') return { outcome: 'failed', detail: 'Injected startup failure after stopping the old process. Destination is unavailable; no automatic rollback.', source: 'Fixed local launcher — injected failure' };
        current = await launch(candidate.id);
        selected = candidate.id;
        replaceFile(selection, JSON.stringify({ version: selected }));
        if (plan.fault === 'lost-receipt') {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return { outcome: 'unknown', detail: 'Injected loss of terminal receipt after launch. Observe separately; never automatically replay.', source: 'Controller demonstration — terminal receipt withheld' };
        }
        return { outcome: 'completed', detail: 'Verified package started in a new owned process. Running version still requires a separate HTTP observation.', source: 'Fixed local launcher completion receipt (not an observation)' };
      } catch {
        return { outcome: 'unknown', detail: 'Launch or selection recording did not complete reliably. Inspect fresh observations; do not automatically retry.', source: 'Fixed local launcher — incomplete execution evidence' };
      } finally { busy = false; finish(); }
    },
    stop: async () => { closing = true; await settled; await stopChild(current.child); },
  };
  return target;
}

// Validate a fresh HTTP witness, never a deployment receipt or desired selection.
export function validateVersion(value: unknown, target: Target, destinationId: string) {
  const identity = value as Record<string, unknown> | null;
  const context = identity?.context as Record<string, unknown> | undefined;
  const destination = referenceDestination(destinationId);
  if (!identity || identity.schemaVersion !== 1 || identity.applicationId !== 'observatory-hello-reference'
    || typeof identity.version !== 'string' || referenceCandidate(identity.version).digest !== identity.artifactId
    || identity.bootId !== target.bootId || context?.destinationId !== destinationId || context.instanceId !== target.instanceId
    || context.stage !== destination.stage || context.disposableDemo !== true) throw new Error('Reference HTTP identity is unknown or conflicts with the owned runtime.');
  return { version: identity.version, artifactId: String(identity.artifactId) };
}
export async function readReference(target: Target, destinationId: string, now: () => string): Promise<Observation> {
  const instanceId = target.instanceId, bootId = target.bootId;
  const recordedAt = () => now();
  try {
    if (!running(target)) throw new Error('Owned child is no longer alive; do not probe its historical port.');
    const response = await fetch(`${target.address}/version`, { signal: AbortSignal.timeout(1000), redirect: 'error' });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Invalid version response.');
    const reader = response.body!.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 4096) throw new Error('Oversized version response.'); chunks.push(value); }
    } finally { await reader.cancel(); }
    if (!running(target) || bootId !== target.bootId) throw new Error('Runtime changed during observation.');
    const bytes = Buffer.concat(chunks);
    const identity = validateVersion(JSON.parse(bytes.toString('utf8')), target, destinationId);
    return { instanceId, bootId, outcome: 'observed', digest: identity.artifactId, version: identity.version, responseHash: digest(bytes),
      generation: null, operationId: null, observedAt: now(), recordedAt: recordedAt(), source: 'Fresh owned loopback HTTP GET /version',
      detail: 'Runtime-reported identity checked against accepted package mapping and owned context; response hash is separate. Not health, Test acceptance or hostile-host attestation.' };
  } catch {
    return { instanceId, bootId, outcome: 'unknown', digest: null, generation: null, operationId: null, observedAt: null, recordedAt: recordedAt(),
      source: 'Owned loopback version observation attempt', detail: 'Current observation unavailable or invalid. Earlier observed versions remain historical; dead child ports are not probed.' };
  }
}
