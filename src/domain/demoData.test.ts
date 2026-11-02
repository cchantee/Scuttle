import { describe, expect, it } from 'vitest';
import { accountBalance, availableAccountBalance, goalSummary, unallocatedForPaycheck } from './calculations';
import { addSampleData, hasSampleData, removeSampleData } from './demoData';
import { emptyData } from './models';

describe('in-app sample data', () => {
  it('adds a connected dataset while preserving existing user records', () => {
    const data = emptyData();
    data.paychecks = [{ id: 'my-paycheck', amountCents: 10000, receivedAt: '2026-10-01', source: 'My job' }];
    const result = addSampleData(data, '2026-10-27');
    expect(result.error).toBeUndefined();
    expect(result.data.paychecks.find(item => item.id === 'my-paycheck')).toEqual(data.paychecks[0]);
    expect(result.data.paychecks).toHaveLength(3);
    expect(result.data.accounts).toHaveLength(4);
    expect(result.data.goals).toHaveLength(2);
    expect(hasSampleData(result.data)).toBe(true);
    const sampleChecking = result.data.accounts.find(item => item.id === 'sample:checking')!;
    expect(accountBalance(result.data, sampleChecking)).toBe(396900);
    expect(availableAccountBalance(result.data, sampleChecking)).toBe(381900);
    const currentPaycheck = result.data.paychecks.find(item => item.id === 'sample:paycheck-current')!;
    expect(unallocatedForPaycheck(result.data, currentPaycheck.id)).toBe(54601);
    const vacation = result.data.goals.find(item => item.id === 'sample:goal-vacation')!;
    expect(goalSummary(result.data, vacation).savedCents).toBe(85000);
    expect(result.data.user).toEqual(data.user);
  });

  it('does not modify the account or add the sample records twice', () => {
    const once = addSampleData(emptyData(), '2026-10-27').data;
    const twice = addSampleData(once, '2026-10-27');
    expect(twice.error).toMatch(/already been added/);
    expect(twice.data).toBe(once);
  });

  it('deletes every sample record atomically and preserves a user record', () => {
    const data = emptyData();
    data.categories = [{ id: 'my-category', name: 'My category' }];
    const seeded = addSampleData(data, '2026-10-27').data;
    const removed = removeSampleData(seeded);
    expect(removed.error).toBeUndefined();
    expect(hasSampleData(removed.data)).toBe(false);
    expect(removed.data.categories).toEqual(data.categories);
    expect(removed.data.paychecks).toEqual([]);
    expect(removed.data.allocations).toEqual([]);
    expect(removed.data.transactions).toEqual([]);
    expect(removed.data.accounts).toEqual([]);
    expect(removed.data.goals).toEqual([]);
    expect(removed.data.contributions).toEqual([]);
  });

  it('blocks removal if a user transaction depends on a sample account', () => {
    const seeded = addSampleData(emptyData(), '2026-10-27').data;
    seeded.transactions.push({ id: 'my-transaction', description: 'My expense', amountCents: 100, date: '2026-10-27', type: 'expense', accountId: 'sample:checking' });
    const result = removeSampleData(seeded);
    expect(result.error).toMatch(/regular transaction uses a sample record/);
    expect(result.data).toBe(seeded);
    expect(hasSampleData(result.data)).toBe(true);
  });
});
