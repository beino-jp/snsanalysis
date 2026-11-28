import { query } from '../server/db';
import { tickJob } from './process';
import { tickDiscovery } from './discovery';
export type WorkflowKind = 'job' | 'discovery';
export async function runMockStep(id: string, kind: WorkflowKind) {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) throw Error('INVALID_JOB_ID');
  if (kind !== 'job' && kind !== 'discovery') throw Error('INVALID_WORKFLOW_KIND');
  const table = kind === 'job' ? 'jobs' : 'discovery_jobs';
  const job = (await query(`SELECT * FROM ${table} WHERE id=$1`, [id]))[0];
  if (!job || job.provider !== 'mock') throw Error('MOCK_WORKFLOW_ONLY');
  if (job.status === 'completed') return 'completed';
  if (['error', 'paused', 'budget_stopped'].includes(job.status)) return 'stopped';
  try {
    if (kind === 'job') await tickJob(job); else await tickDiscovery(job);
  } catch {
    // Persist a recoverable state, never the provider's exception/body/credentials.
    await query(`UPDATE ${table} SET status='error',error=$2,lease_until=NULL WHERE id=$1`, [id, '処理が停止しました。再開ボタンから続けてください。']);
    throw Error('MOCK_STEP_FAILED');
  }
  const latest = (await query(`SELECT status FROM ${table} WHERE id=$1`, [id]))[0];
  if (!latest || ['error', 'paused', 'budget_stopped'].includes(latest.status)) return 'stopped';
  return latest.status === 'completed' ? 'completed' : 'running';
}
