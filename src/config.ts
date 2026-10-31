import { existsSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { isIP } from 'node:net';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = realpathSync(fileURLToPath(new URL('../', import.meta.url)));

// Pure parser shared by startup and direct application fixtures. Never echo input.
export function parseAllowedHosts(value?: string): string[] {
  const defaults = ['127.0.0.1', 'localhost'];
  if (value === undefined) return defaults;
  const invalid = () => new Error('Invalid AO_ALLOWED_HOSTS: use 1–20 unique hostname/IPv4 entries, comma-separated, at most 4096 characters; no schemes, ports, paths, wildcards or controls.');
  if (typeof value !== 'string' || value.length > 4096 || /[^\x20-\x7e]/.test(value)) throw invalid();
  const entries = value.split(',');
  if (entries.length > 20) throw invalid();
  const configured = new Set<string>();
  for (const entry of entries) {
    const host = entry.replace(/^ +| +$/g, '').toLowerCase();
    const ipv4 = isIP(host) === 4;
    const hostname = host.length <= 253
      && host.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
      // Refuse numeric/hex IP shorthand and malformed IPv4 rather than treating it as DNS.
      && !/(?:^|\.)(?:[0-9]+|0x[0-9a-f]+)$/.test(host)
      && !/^[0-9]+(?:\.[0-9]+){2}\.[0-9][^.]*$/.test(host);
    if ((!ipv4 && !hostname) || configured.has(host)) throw invalid();
    configured.add(host);
  }
  return [...new Set([...defaults, ...configured])];
}

// Resolve existing ancestors too, so a symlink cannot put runtime data in the checkout.
function canonicalPath(path: string): string {
  if (existsSync(path)) return realpathSync(path);
  return join(canonicalPath(dirname(path)), path.slice(dirname(path).length + 1));
}

export function dataDirectory(override = process.env.AO_DATA_DIR): string {
  const defaultPath = process.platform === 'darwin'
    ? join(homedir(), 'Library', 'Application Support', 'Application Observatory')
    : process.platform === 'win32'
      ? join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'Application Observatory')
      : join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'application-observatory');
  const selected = override ?? defaultPath;
  if (!isAbsolute(selected)) throw new Error('AO_DATA_DIR must be an absolute local directory.');
  const path = canonicalPath(resolve(selected));
  const fromRepository = relative(repositoryRoot, path);
  if (!fromRepository || (!fromRepository.startsWith(`..${sep}`) && fromRepository !== '..' && !isAbsolute(fromRepository))) {
    throw new Error('Runtime data must be outside the repository. Set AO_DATA_DIR to a local directory.');
  }
  if (/(^|[/\\])(CloudStorage|Google Drive|Dropbox|OneDrive[^/\\]*|Mobile Documents)([/\\]|$)/i.test(path)) {
    throw new Error('Runtime data must be outside synchronized folders. Choose a local AO_DATA_DIR.');
  }
  return path;
}

export function portNumber(value = process.env.AO_PORT ?? '4310'): number {
  if (!/^\d+$/.test(value) || Number(value) > 65535) {
    throw new Error('AO_PORT must be an integer from 0 to 65535 (0 selects a free local port).');
  }
  return Number(value);
}
