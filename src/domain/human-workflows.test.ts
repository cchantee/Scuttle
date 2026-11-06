import { describe, expect, it } from 'vitest';
import { emptyData, AppData } from './models';
import { upsertRecord, receivePlannedPaycheck, reallocateBudget, removeRecord } from './store';
import { accountBalance, allocatedForPaycheck, activeBudgetAllocations, unallocatedForPaycheck } from './calculations';
import { migrateAppData } from './migrations';

function fixture(): AppData {
  return { ...emptyData(), accounts: [{ id: 'cash', name: 'Checking', type: 'checking', initialBalanceCents: 10000 }],
    paychecks: [{ id: 'pay', amountCents: 120000, receivedAt: '2026-11-05', status: 'planned' }],
    categories: [{ id: 'food', name: 'Groceries' }, { id: 'gas', name: 'Gas' }],
    allocations: [{ id: 'food-budget', paycheckId: 'pay', categoryId: 'food', amountCents: 40000 }],
    goals: [{ id: 'goal', name: 'Vacation', targetCents: 200000, initialSavedCents: 0 }] };
}
function received() { return receivePlannedPaycheck(fixture(), 'pay', 120000, '2026-11-05', 'cash').data; }

describe('human specified paycheck workflows', () => {
  it('planning preserves allocations without depositing or enabling spending', () => {
    const data = fixture();
    expect(accountBalance(data, data.accounts[0])).toBe(10000);
    expect(activeBudgetAllocations(data)).toEqual([]);
    expect(upsertRecord(data, 'transactions', { id: 'tx', type: 'expense', description: 'Food', date: '2026-11-05', allocationId: 'food-budget', amountCents: 1000 }).error).toBeTruthy();
    expect(upsertRecord(data, 'paychecks', { ...data.paychecks[0], accountId: 'cash' }).error).toBeTruthy();
  });
  it('receiving a variable paycheck credits income once and retains its plan', () => {
    const result = receivePlannedPaycheck(fixture(), 'pay', 110000, '2026-11-05', 'cash');
    expect(result.error).toBeUndefined();
    expect(accountBalance(result.data, result.data.accounts[0])).toBe(120000);
    expect(result.data.allocations).toEqual(fixture().allocations);
    expect(receivePlannedPaycheck(result.data, 'pay', 110000, '2026-11-05', 'cash').error).toBeTruthy();
    expect(receivePlannedPaycheck(fixture(), 'pay', 30000, '2026-11-05', 'cash').error).toBeTruthy();
  });
  it('moves a category amount to a goal atomically without changing balances or creating a transaction', () => {
    const data = received();
    const result = reallocateBudget(data, 'food-budget', undefined, 'goal', 10000, 'contribution', '2026-11-05');
    expect(result.error).toBeUndefined();
    expect(result.data.allocations[0].amountCents).toBe(30000);
    expect(result.data.contributions[0]).toMatchObject({ paycheckId: 'pay', amountCents: 10000, status: 'pending', accountId: 'cash' });
    expect(allocatedForPaycheck(result.data, 'pay')).toBe(40000);
    expect(unallocatedForPaycheck(result.data, 'pay')).toBe(80000);
    expect(accountBalance(result.data, data.accounts[0])).toBe(accountBalance(data, data.accounts[0]));
    expect(result.data.transactions).toEqual(data.transactions);
    expect(removeRecord(result.data, 'paychecks', 'pay').error).toBeTruthy();
    expect(migrateAppData(JSON.parse(JSON.stringify(result.data))).contributions[0].paycheckId).toBe('pay');
  });
  it('moves only unspent funds and rolls back if the destination cannot accept them', () => {
    const data = received();
    data.transactions = [{ id: 'expense', description: 'Food', type: 'expense', allocationId: 'food-budget', categoryId: 'food', amountCents: 35000, date: '2026-11-05' }];
    expect(reallocateBudget(data, 'food-budget', undefined, 'goal', 6000, 'c', '2026-11-05').data).toBe(data);
    expect(reallocateBudget(data, 'food-budget', undefined, 'missing', 1000, 'c', '2026-11-05').data).toBe(data);
    const result = reallocateBudget(data, 'food-budget', 'gas', undefined, 5000, 'gas-budget', '2026-11-05');
    expect(result.error).toBeUndefined();
    expect(result.data.allocations.find(a => a.categoryId === 'gas')?.amountCents).toBe(5000);
    expect(allocatedForPaycheck(result.data, 'pay')).toBe(40000);
  });
});
