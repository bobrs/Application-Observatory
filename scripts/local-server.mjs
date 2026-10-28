import { spawn } from 'node:child_process';
import { once } from 'node:events';

// Used only by developer tests/demo, always with a disposable data directory.
export async function startLocalServer(directory) {
  const child = spawn(process.execPath, ['dist/server.js'], {
    env: { ...process.env, AO_DATA_DIR: directory, AO_PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = once(child, 'exit');
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const address = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Local server did not start: ${stderr}`));
    }, 10000);
    child.stdout.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/Application Observatory ready at (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Local server exited before ready (${code}): ${stderr}`));
    });
  });
  return {
    address,
    stop: async () => {
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
      try {
        const [code, signal] = await exited;
        if (code !== 0) throw new Error(`Unclean server exit (${code}, ${signal}): ${stderr}`);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
