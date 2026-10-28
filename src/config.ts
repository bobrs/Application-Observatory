import { existsSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = realpathSync(fileURLToPath(new URL('../', import.meta.url)));

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
