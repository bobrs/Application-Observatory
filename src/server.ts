import { createApplication } from './app.js';
import { portNumber } from './config.js';

process.umask(0o077);
const port = portNumber();
const app = createApplication();
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await app.close();
}
process.on('SIGINT', () => { void close(); });
process.on('SIGTERM', () => { void close(); });

try {
  const address = await app.listen({ host: '127.0.0.1', port });
  console.log(`Application Observatory ready at ${address}`);
} catch (error) {
  await close();
  console.error(error instanceof Error ? error.message : 'Unable to start the local catalog.');
  process.exitCode = 1;
}
