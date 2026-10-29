import { createApplication } from './app.js';
import { portNumber } from './config.js';
import { createExercise } from './exercise/controller.js';

process.umask(0o077);
const port = portNumber();
if (process.argv.slice(2).length > 1 || process.argv.slice(2).some((argument) => !['--exercise', '--reference'].includes(argument))) throw new Error('Only one fixed --exercise or --reference mode is supported.');
const reference = process.argv.includes('--reference');
const exercise = reference ? await createExercise(process.env.AO_REFERENCE_DIR, undefined, true) : process.argv.includes('--exercise') ? await createExercise(process.env.AO_EXERCISE_DIR) : undefined;
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
