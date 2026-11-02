import { describe, expect, it } from 'vitest';
import { emptyData } from './models';
import { applyPaycheckOperation as apply } from './paycheckOperations';
import { accountBalance, accountBalanceAt, activeBudgetAllocations, allocatedForPaycheck, completedGoalSaved, goalSaved, unallocatedForPaycheck } from './calculations';
import { MemoryStorage, removeRecord, upsertRecord } from './store';
import { migrateAppData } from './migrations';

function fixture() {
  let d = emptyData();
  d.accounts = [{ id: 'checking', name: 'Checking', type: 'checking', initialBalanceCents: 0 }];
  d.categories = [{ id: 'food', name: 'Food' }, { id: 'rent', name: 'Rent' }];
  d.goals = [{ id: 'moving', name: 'Moving', targetCents: 200000, initialSavedCents: 0 }];
  d = upsertRecord(d, 'paychecks', { id: 'p', status: 'planned', amountCents: 120000, receivedAt: '2026-11-10' }).data;
  d = upsertRecord(d, 'allocations', { id: 'food-a', paycheckId: 'p', categoryId: 'food', amountCents: 20000 }).data;
  return d;
}
const receive = { type: 'receive' as const, paycheckId: 'p', amountCents: 115000, accountId: 'checking', date: '2026-11-11' };
const reallocate = { type: 'reallocate' as const, paycheckId: 'p', sourceId: 'food-a', goalId: 'moving', amountCents: 5000, id: 'op' };

describe('paycheck planning and reallocation', () => {
  it('creates and edits a plan without spendable money or completed savings', () => {
    let d = fixture();
    d = apply(d, reallocate).data;
    expect(accountBalance(d, d.accounts[0])).toBe(0);
    expect(activeBudgetAllocations(d)).toEqual([]);
    expect(goalSaved(d, 'moving')).toBe(0);
    expect(upsertRecord(d, 'transactions', { id: 'tx', type: 'expense', description: 'Food', date: '2026-11-02', amountCents: 100, allocationId: 'food-a' }).error).toMatch(/Planned/);
    const edited = upsertRecord(d, 'paychecks', { ...d.paychecks[0], amountCents: 125000 });
    expect(edited.error).toBeUndefined();
    expect(edited.data.paychecks[0].amountCents).toBe(125000);
  });
  it('receives once using the existing income ledger and preserves planning information', () => {
    const plan = apply(fixture(), { type: 'reviewReceipt', paycheckId: 'p' }).data;
    const d = apply(plan, receive).data;
    expect(d.paychecks[0]).toMatchObject({ status: 'received', plannedAmountCents: 120000, actualAmountCents: 115000, expectedAt: '2026-11-10' });
    expect(d.paychecks[0].originalPlan?.allocations).toEqual(plan.allocations);
    expect(d.allocations).toEqual(plan.allocations);
    expect(accountBalance(d, d.accounts[0])).toBe(115000);
    expect(accountBalanceAt(d, d.accounts[0], '2026-11-10')).toBe(0);
    expect(accountBalanceAt(d, d.accounts[0], '2026-11-11')).toBe(115000);
    expect(d.transactions).toHaveLength(0);
    expect(apply(d, receive).error).toMatch(/already/);
    expect(apply(d, receive).data).toBe(d);
  });
  it('requires resolving excess allocations and retains the pre-review plan', () => {
    const plan = apply(fixture(), { type: 'reviewReceipt', paycheckId: 'p' }).data;
    expect(apply(plan, { ...receive, amountCents: 10000 }).error).toMatch(/exceed/);
    const adjusted = upsertRecord(plan, 'allocations', { ...plan.allocations[0], amountCents: 10000 }).data;
    const d = apply(adjusted, { ...receive, amountCents: 10000 }).data;
    expect(d.paychecks[0].originalPlan?.allocations[0].amountCents).toBe(20000);
    expect(d.allocations[0].amountCents).toBe(10000);
    expect(d.paychecks[0].plannedAmountCents).toBe(120000);
  });
  it('reallocates only unspent funds atomically, idempotently, without changing income', () => {
    let d = apply(fixture(), receive).data;
    d = upsertRecord(d, 'transactions', { id: 'spend', type: 'expense', description: 'Food', amountCents: 16000, date: '2026-11-11', accountId: 'checking', allocationId: 'food-a' }).data;
    expect(apply(d, reallocate).data).toBe(d);
    const result = apply(d, { ...reallocate, amountCents: 4000 });
    expect(result.error).toBeUndefined();
    const next = result.data;
    expect(next.allocations[0].amountCents).toBe(16000);
    expect(goalSaved(next, 'moving')).toBe(4000);
    expect(completedGoalSaved(next, 'moving')).toBe(0);
    expect(accountBalance(next, next.accounts[0])).toBe(accountBalance(d, d.accounts[0]));
    expect(allocatedForPaycheck(next, 'p')).toBe(allocatedForPaycheck(d, 'p'));
    expect(unallocatedForPaycheck(next, 'p')).toBe(unallocatedForPaycheck(d, 'p'));
    expect(apply(next, { ...reallocate, amountCents: 4000 }).data).toBe(next);
    expect(next.transactions).toEqual(d.transactions);
    expect(upsertRecord(next, 'allocations', { ...next.allocations[0], amountCents: 0 }).error).toMatch(/spending/);
  });
  it.each([0, -1, NaN, 0.5, 20001])('rejects invalid or unavailable reallocation %s with no partial state', amountCents => {
    const d = fixture();
    expect(apply(d, { ...reallocate, amountCents }).error).toBeTruthy();
    expect(apply(d, { ...reallocate, amountCents }).data).toBe(d);
  });
  it('supports received category edits and category-to-category moves without account changes', () => {
    const d = apply(fixture(), receive).data;
    const moved = apply(d, { ...reallocate, goalId: undefined, categoryId: 'rent' }).data;
    const edited = upsertRecord(moved, 'allocations', { ...moved.allocations[0], amountCents: 14000 }).data;
    expect(accountBalance(edited, edited.accounts[0])).toBe(115000);
    expect(edited.allocations).toHaveLength(2);
    expect(upsertRecord(edited, 'allocations', { ...edited.allocations[0], amountCents: 120000 }).error).toMatch(/exceed/);
    expect(upsertRecord(edited, 'paychecks', { ...edited.paychecks[0], amountCents: 200000 }).error).toMatch(/Confirmed/);
  });
  it('rejects invalid receipt accounts, amounts, dates and generic status transitions', () => {
    const d = fixture();
    for (const override of [{ accountId: 'missing' }, { amountCents: 0 }, { date: '2026-02-30' }]) expect(apply(d, { ...receive, ...override }).error).toBeTruthy();
    expect(upsertRecord(d, 'paychecks', { ...d.paychecks[0], status: 'received' }).error).toMatch(/Mark as Received/);
    expect(upsertRecord(d, 'paychecks', { ...d.paychecks[0], accountId: 'checking' }).error).toMatch(/cannot credit/);
  });
  it('retains legacy paycheck semantics across snapshot migration', () => {
    const d = fixture();
    delete d.paychecks[0].status;
    d.paychecks[0].accountId = 'checking';
    expect(accountBalance(migrateAppData(JSON.parse(JSON.stringify(d))), d.accounts[0])).toBe(120000);
  });
  it('round-trips plans, receipt history and goal allocations through snapshot storage', async () => {
    const storage = new MemoryStorage();
    const plan = apply(fixture(), reallocate).data;
    await storage.save(plan);
    expect(await storage.load()).toEqual(plan);
    const received = apply(plan, receive).data;
    await storage.save(JSON.parse(JSON.stringify(received)));
    expect(migrateAppData(await storage.load())).toMatchObject(JSON.parse(JSON.stringify(received)));
    expect(removeRecord(received, 'goals', 'moving').error).toBeTruthy();
    expect(removeRecord(received, 'paychecks', 'p').error).toBeTruthy();
  });
});
