import type { WorkflowKind } from '../worker/cloudflare-mock';
import { query } from './db';
interface Binding {
  create(options: { id: string; params: { id: string; kind: WorkflowKind } }): Promise<unknown>;
  get(id: string): Promise<{ restart(): Promise<unknown> }>;
}
export async function dispatchCloudflare(id: string, kind: WorkflowKind, restart = false) {
  if (process.env.DEPLOY_TARGET !== 'cloudflare') return;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = await getCloudflareContext({ async: true });
    const binding = (env as { ANALYSIS_WORKFLOW?: Binding }).ANALYSIS_WORKFLOW;
    if (!binding) throw Error('WORKFLOW_BINDING_MISSING');
    const instanceId = `${kind}-${id}`;
    if (restart) { const instance = await binding.get(instanceId); await instance.restart(); }
    else await binding.create({ id: instanceId, params: { id, kind } });
  } catch {
    const table = kind === 'job' ? 'jobs' : 'discovery_jobs';
    await query(`UPDATE ${table} SET status='error',error=$2,lease_until=NULL WHERE id=$1 AND status='queued'`, [id, '処理の開始を確認できませんでした。管理者にお問い合わせください。']);
    // A create timeout may still have started the workflow. Do not create another instance.
    throw Error('WORKFLOW_START_UNCONFIRMED');
  }
}
