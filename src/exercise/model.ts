import { createHash } from 'node:crypto';

export const digest = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const candidates = [
  { id: 'sample-v1', label: 'Sample v1', bytes: '{"release":"sample-v1","message":"A small beginning."}\n' },
  { id: 'sample-v2', label: 'Sample v2', bytes: '{"release":"sample-v2","message":"A visible next step."}\n' },
].map((candidate) => ({ ...candidate, digest: digest(candidate.bytes) }));
export const environments = [
  { id: 'dev-sandbox', name: 'Dev Sandbox', stage: 'Development' },
  { id: 'test-sandbox', name: 'Test Sandbox', stage: 'Test' },
] as const;
export const faults = ['normal', 'refuse', 'lost-receipt'] as const;
export type Fault = typeof faults[number] | 'launch-failure';
export const lifetime = 5 * 60 * 1000;
export interface State { candidateId: string; digest: string; generation: number; operationId: string | null }
export interface Identity { instanceId: string; bootId: string }
export interface Observation extends Identity {
  version?: string; responseHash?: string;
  outcome: 'observed' | 'unknown'; digest: string | null; generation: number | null;
  observedAt: string | null; recordedAt: string; source: string; detail: string; operationId: string | null;
}
export interface Plan {
  action: 'activate-bundled-sample' | 'activate-reference-artifact'; criteriaVersion: 'local-fixture-v1' | 'local-reference-v1';
  id: string; createdAt: string; candidateId: string; candidateDigest: string;
  environmentId: string; instanceId: string; bootId: string;
  expected: Observation | null; fault: Fault; hash: string;
}
export interface Decision {
  disposition: 'recommend' | 'authorize' | 'decline' | 'defer';
  actor: string; role: string; rationale: string; planHash: string; expiresAt: string;
  identity: 'Self-declared; not authenticated organizational standing';
}
export interface Receipt { outcome: 'completed' | 'failed' | 'refused' | 'unknown'; detail: string; generation?: number; source?: string }
export interface Event { seq: number; kind: string; recordedAt: string; source: string; data: Record<string, unknown> }
export function candidateById(id: string) {
  const candidate = candidates.find((item) => item.id === id);
  if (!candidate) throw new Error('Select one of the two bundled sample versions.');
  return candidate;
}
export function environmentById(id: string) {
  const environment = environments.find((item) => item.id === id);
  if (!environment) throw new Error('Select Dev Sandbox or Test Sandbox. Production is unavailable.');
  return environment;
}
