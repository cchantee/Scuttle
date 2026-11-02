import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getItem: vi.fn(), setItem: vi.fn(), rpc: vi.fn(), maybeSingle: vi.fn() }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: mocks.getItem, setItem: mocks.setItem } }));
vi.mock('../backend/supabase', () => ({ supabase: { rpc: mocks.rpc, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }) } }));
import { AsyncStorageAdapter } from './asyncStorage';
import { SupabaseStorageAdapter } from './supabaseStorage';
import { emptyData } from '../domain/models';
import { applyPaycheckOperation } from '../domain/paycheckOperations';

function planned() {
  const d = emptyData();
  d.user.id = 'owner';
  d.paychecks = [{ id: 'p', amountCents: 120000, status: 'planned', receivedAt: '2026-11-10' }];
  d.accounts = [{ id: 'a', name: 'Checking', type: 'checking', initialBalanceCents: 0 }];
  return d;
}
beforeEach(() => vi.resetAllMocks());
it('persists a local plan and receipt through new adapter instances', async () => {
  let raw: string | null = null;
  mocks.getItem.mockImplementation(async () => raw);
  mocks.setItem.mockImplementation(async (_key, value) => { raw = value; });
  await new AsyncStorageAdapter().save(planned());
  const loaded = (await new AsyncStorageAdapter().load())!;
  expect(loaded.paychecks[0].status).toBe('planned');
  const received = applyPaycheckOperation(loaded, { type: 'receive', paycheckId: 'p', amountCents: 115000, accountId: 'a', date: '2026-11-10' }).data;
  await new AsyncStorageAdapter().save(received);
  expect((await new AsyncStorageAdapter().load())?.paychecks).toEqual(received.paychecks);
  mocks.setItem.mockRejectedValueOnce(new Error('Disk failure'));
  await expect(new AsyncStorageAdapter().save(planned())).rejects.toThrow('Disk failure');
  expect((await new AsyncStorageAdapter().load())?.paychecks).toEqual(received.paychecks);
});
it('uses one atomic cloud snapshot and retains its revision on conflict or failure', async () => {
  const d = planned();
  mocks.maybeSingle.mockResolvedValue({ data: { data: d, revision: 7 }, error: null });
  const storage = new SupabaseStorageAdapter('owner');
  const loaded = await storage.load();
  expect(loaded?.paychecks).toEqual(d.paychecks);
  mocks.rpc.mockResolvedValueOnce({ error: new Error('Conflict') });
  await expect(storage.save(d)).rejects.toThrow('Conflict');
  mocks.rpc.mockResolvedValueOnce({ data: 8, error: null });
  await storage.save(d);
  expect(mocks.rpc).toHaveBeenLastCalledWith('save_scuttle_data', { p_data: d, p_expected_revision: 7 });
  mocks.rpc.mockResolvedValueOnce({ data: 9, error: null });
  await storage.save(d);
  expect(mocks.rpc).toHaveBeenLastCalledWith('save_scuttle_data', { p_data: d, p_expected_revision: 8 });
});
