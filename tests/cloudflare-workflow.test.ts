import { beforeEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ query: vi.fn(), job: vi.fn(), discovery: vi.fn() }));
vi.mock('../src/server/db', () => ({ query: f.query }));
vi.mock('../src/worker/process', () => ({ tickJob: f.job }));
vi.mock('../src/worker/discovery', () => ({ tickDiscovery: f.discovery }));
import { runMockStep } from '../src/worker/cloudflare-mock';
const id = '00000000-0000-4000-8000-000000000000';
beforeEach(() => vi.resetAllMocks());
it('never sends a live job to the legacy unbounded provider', async () => {
  f.query.mockResolvedValue([{provider: 'apify', status: 'queued'}]);
  await expect(runMockStep(id, 'job')).rejects.toThrow('MOCK_WORKFLOW_ONLY');
  expect(f.job).not.toHaveBeenCalled(); expect(f.discovery).not.toHaveBeenCalled();
});
it('persists a recoverable error without disclosing exception data', async () => {
  f.query.mockResolvedValue([{provider: 'mock', status: 'queued'}]);
  f.job.mockRejectedValue(Error('secret-provider-body'));
  await expect(runMockStep(id, 'job')).rejects.toThrow('MOCK_STEP_FAILED');
  expect(JSON.stringify(f.query.mock.calls)).not.toContain('secret-provider-body');
  expect(f.query.mock.calls[1][0]).toContain("status='error'");
});
it('does not restart completed or budget-stopped work', async () => {
  f.query.mockResolvedValueOnce([{provider:'mock',status:'completed'}]).mockResolvedValueOnce([{provider:'mock',status:'budget_stopped'}]);
  expect(await runMockStep(id,'job')).toBe('completed');
  expect(await runMockStep(id,'discovery')).toBe('stopped');
  expect(f.job).not.toHaveBeenCalled(); expect(f.discovery).not.toHaveBeenCalled();
});
it('continues the correct mock pipeline and returns only a status checkpoint', async () => {
  f.query.mockResolvedValueOnce([{provider:'mock',status:'queued'}]).mockResolvedValueOnce([{status:'completed'}]);
  expect(await runMockStep(id,'discovery')).toBe('completed');
  expect(f.discovery).toHaveBeenCalledTimes(1); expect(f.job).not.toHaveBeenCalled();
});
