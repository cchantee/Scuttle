import { describe, expect, it } from 'vitest';
import { emptyData } from './models';
import { upsertRecord } from './store';
import { applyPaycheckOperation } from './paycheckOperations';
import { goalSummary } from './calculations';

describe('Jordan Moving Fund study workflow', () => {
  it('keeps $300 starting savings separate and allocates $50 from the current paycheck', () => {
    let data = emptyData();
    data.accounts = [{ id: 'savings', name: 'Savings', type: 'savings', initialBalanceCents: 60_000 }];
    data.categories = [{ id: 'groceries', name: 'Groceries' }];
    data.paychecks = [{ id: 'current', amountCents: 85_000, receivedAt: '2026-11-05', status: 'received', accountId: 'savings', accountCreditCents: 85_000, remainingAccountId: 'savings' }];
    data.allocations = [{ id: 'groceries-allocation', paycheckId: 'current', categoryId: 'groceries', amountCents: 12_000 }];
    const created = upsertRecord(data, 'goals', { id: 'moving', name: 'Moving Fund', targetCents: 150_000, initialSavedCents: 30_000 });
    expect(created.error).toBeUndefined();
    const moved = applyPaycheckOperation(created.data, { type: 'reallocate', paycheckId: 'current', sourceId: 'groceries-allocation', goalId: 'moving', amountCents: 5_000, id: 'moving-from-paycheck' });
    expect(moved.error).toBeUndefined();
    expect(goalSummary(moved.data, moved.data.goals[0])).toMatchObject({ savedCents: 35_000, remainingCents: 115_000 });
    expect(moved.data.contributions[0]).toMatchObject({ amountCents: 5_000, paycheckId: 'current', status: 'allocated' });
  });
});
