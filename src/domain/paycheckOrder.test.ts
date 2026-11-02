import { expect, it } from 'vitest';
import { emptyData } from './models';
import { newestPaychecks } from './calculations';
import { upsertRecord } from './store';
it('chooses the most recently added paycheck when dates match without mutating the source', () => {
  const paychecks = [{ id: 'older', amountCents: 100, receivedAt: '2026-11-02' }, { id: 'earlier-date', amountCents: 100, receivedAt: '2026-10-30' }, { id: 'newer', amountCents: 100, receivedAt: '2026-11-02' }];
  expect(newestPaychecks(paychecks).map(p => p.id)).toEqual(['newer', 'older', 'earlier-date']);
  expect(paychecks[0].id).toBe('older');
});
it('categorizes new spending against the latest same-date received active paycheck', () => {
  const d = emptyData();
  d.categories = [{ id: 'food', name: 'Food' }];
  d.paychecks = ['older', 'newer', 'planned', 'archived'].map(id => ({ id, amountCents: 10000, receivedAt: '2026-11-02', status: id === 'planned' ? 'planned' : 'received', budgetArchived: id === 'archived' })) as typeof d.paychecks;
  d.allocations = d.paychecks.map(p => ({ id: `${p.id}-a`, paycheckId: p.id, categoryId: 'food', amountCents: 10000 }));
  const saved = upsertRecord(d, 'transactions', { id: 'tx', type: 'expense', description: 'Food', amountCents: 500, categoryId: 'food', date: '2026-11-02' });
  expect(saved.error).toBeUndefined();
  expect(saved.data.transactions[0].allocationId).toBe('newer-a');
});
