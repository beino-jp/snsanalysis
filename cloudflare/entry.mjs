import handler from '../.open-next/worker.js';
import { withDatabaseUrl } from '../src/server/db';
import { cleanupExpired } from '../src/worker/retention';
export { AnalysisWorkflow } from './analysis';
export { LiveAnalysisWorkflow } from './live-analysis';
export default {
  ...handler,
  scheduled(_event, env, ctx) {
    ctx.waitUntil(withDatabaseUrl(env.HYPERDRIVE.connectionString, cleanupExpired)
      .catch(() => { console.error('RETENTION_CLEANUP_FAILED'); }));
  },
};
