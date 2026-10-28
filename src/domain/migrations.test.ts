import { describe, expect, it } from 'vitest';
import { migrateAppData } from './migrations';

describe('persisted snapshot migration', () => {
  it('migrates v1 snapshots, defaults rates to zero, and preserves existing records', () => {
    const old = {
      version: 1,
      user: { id: 'u', displayName: 'User' },
      paychecks: [{ id: 'p', amountCents: 10000, receivedAt: '2025-01-01' }],
      categories: [{ id: 'c', name: 'Food' }],
      allocations: [{ id: 'al', paycheckId: 'p', categoryId: 'c', amountCents: 1000 }],
      transactions: [{ id: 't', description: 'Coffee', amountCents: 100, date: '2025-01-02', type: 'expense' }],
      accounts: [{ id: 'a', name: 'Savings', type: 'savings', initialBalanceCents: 5000, interestRatePercent: 3.75 }],
      goals: [{ id: 'g', name: 'Trip', targetCents: 10000, initialSavedCents: 500 }],
      contributions: [{ id: 'co', goalId: 'g', amountCents: 200, date: '2025-01-03' }],
    };
    const upgraded = migrateAppData(old, '2026-10-27');
    expect(upgraded.version).toBe(2);
    expect(upgraded.accounts[0].interestRatePercent).toBe(3.75);
    expect(upgraded.accounts[0].interestStartDate).toBe('2026-10-27');
    expect(upgraded.accounts[0].interestRateHistory).toEqual([{ effectiveDate: '2026-10-27', ratePercent: 3.75 }]);
    expect(upgraded.transactions).toEqual(old.transactions);
    expect(upgraded.paychecks).toEqual(old.paychecks);
    expect(upgraded.allocations).toEqual(old.allocations);
    expect(upgraded.goals).toEqual(old.goals);
    expect(upgraded.contributions).toEqual(old.contributions);
  });

  it('defaults missing interest rates to zero and is idempotent for v2 data', () => {
    const upgraded = migrateAppData({ version: 1, accounts: [{ id: 'a', name: 'Card', type: 'credit_card', initialBalanceCents: 10 }] }, '2026-10-27');
    const repeated = migrateAppData(upgraded, '2027-01-01');
    expect(upgraded.accounts[0].interestRatePercent).toBe(0);
    expect(repeated.accounts[0].interestStartDate).toBe('2026-10-27');
    expect(repeated.accounts[0].interestRateHistory).toEqual(upgraded.accounts[0].interestRateHistory);
  });
});
