import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { digest, type Identity, type Observation, type Plan, type Receipt } from './model.js';

export interface Target extends Identity {
  address: string; child: ChildProcess;
  activate: (plan: Plan, operationId: string) => Promise<Receipt>;
  stop: () => Promise<void>;
}
export async function startTarget(directory: string, id: string): Promise<Target> {
  const child = fork(new URL('./target.js', import.meta.url), [directory, id], { execArgv: [], stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  const ready = await new Promise<{ address: string } & Identity>((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error('Local fixture startup timed out.')); }, 5000);
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('exit', () => { clearTimeout(timer); reject(new Error('Local fixture exited before ready; workspace may be invalid.')); });
    child.on('message', (value: unknown) => {
      const message = value as Record<string, unknown>;
      if (message?.type === 'ready' && typeof message.address === 'string' && /^http:\/\/127\.0\.0\.1:\d+$/.test(message.address)
        && typeof message.instanceId === 'string' && typeof message.bootId === 'string') {
        clearTimeout(timer); resolve(message as unknown as { address: string } & Identity);
      }
    });
  });
  return {
    ...ready, child,
    activate: (plan, operationId) => new Promise((resolve) => {
      const finish = (receipt: Receipt) => { clearTimeout(timer); child.off('message', listener); resolve(receipt); };
      const listener = (value: unknown) => {
        const receipt = value as Record<string, unknown>;
        if (receipt?.type === 'receipt' && receipt.operationId === operationId
          && ['completed', 'failed', 'refused', 'unknown'].includes(String(receipt.outcome)) && typeof receipt.detail === 'string') {
          finish({ outcome: receipt.outcome as Receipt['outcome'], detail: receipt.detail, generation: Number(receipt.generation), source: 'Trusted fixture IPC receipt (not a target observation)' });
        }
      };
      const timer = setTimeout(() => finish({ outcome: 'unknown', detail: 'No terminal adapter receipt arrived. The target may have changed; do not automatically retry.', source: 'Controller timeout — no fixture receipt' }), 1000);
      child.on('message', listener);
      const command = {
        action: plan.action, operationId, candidateId: plan.candidateId, candidateDigest: plan.candidateDigest,
        instanceId: plan.instanceId, bootId: plan.bootId, expectedGeneration: plan.expected?.generation,
        expectedDigest: plan.expected?.digest, fault: plan.fault,
      };
      if (!child.connected) { finish({ outcome: 'unknown', detail: 'Target channel unavailable; dispatch outcome unknown.', source: 'Controller channel check — no fixture receipt' }); return; }
      child.send(command, (error) => { if (error) finish({ outcome: 'unknown', detail: 'Target channel failed; dispatch outcome unknown.', source: 'Controller send failure — no fixture receipt' }); });
    }),
    stop: async () => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 2000);
      try { await exited; } finally { clearTimeout(timer); }
    },
  };
}

// This reader never consults desired state or the adapter receipt. It hashes served bytes.
export async function readTarget(target: Target, now: () => string): Promise<Observation> {
  try {
    const response = await fetch(`${target.address}/payload`, { signal: AbortSignal.timeout(1000), redirect: 'error' });
    const generation = response.headers.get('x-ao-generation');
    if (!response.ok || response.headers.get('x-ao-instance') !== target.instanceId
      || response.headers.get('x-ao-boot') !== target.bootId || !generation || !/^\d+$/.test(generation)) throw new Error('Invalid target identity/response.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > 4096 || !Number.isSafeInteger(Number(generation))) throw new Error('Invalid fixture response.');
    return { instanceId: target.instanceId, bootId: target.bootId, outcome: 'observed', digest: digest(bytes),
      generation: Number(generation), operationId: response.headers.get('x-ao-operation') || null,
      observedAt: now(), recordedAt: now(), source: 'Fresh loopback HTTP read-back; SHA-256 of served bytes',
      detail: 'Same-host fixture observation only; not independent Test acceptance or health attestation.' };
  } catch {
    return { instanceId: target.instanceId, bootId: target.bootId, outcome: 'unknown', digest: null, generation: null,
      operationId: null, observedAt: null, recordedAt: now(), source: 'Loopback HTTP read-back attempt',
      detail: 'Unable to read a valid response from the fixed target. Earlier observations remain historical.' };
  }
}
