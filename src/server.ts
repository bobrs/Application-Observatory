import { createApplication } from './app.js';
import { portNumber } from './config.js';
import { createExercise } from './exercise/controller.js';

process.umask(0o077);
const port = portNumber();
if (process.argv.slice(2).some((argument) => argument !== '--exercise')) throw new Error('Only the fixed --exercise mode is supported.');
const exercise = process.argv.includes('--exercise') ? await createExercise(process.env.AO_EXERCISE_DIR) : undefined;
const app = createApplication(exercise?.workspace.directory, exercise);
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
  if (exercise) console.log(`Disposable exercise workspace: ${exercise.workspace.directory}`);
  console.log(`Application Observatory ready at ${address}`);
} catch (error) {
  await close();
  console.error(error instanceof Error ? error.message : 'Unable to start the local catalog.');
  process.exitCode = 1;
}
