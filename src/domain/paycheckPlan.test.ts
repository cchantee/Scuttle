import { describe, expect, it } from 'vitest';
import { AppData, emptyData } from './models';
import { applyPaycheckOperation as apply } from './paycheckOperations';
import { paycheckPlanFingerprint, SavePlanOperation } from './paycheckPlan';
import { accountBalance, allocatedForPaycheck, unallocatedForPaycheck } from './calculations';
import { migrateAppData } from './migrations';

function fixture(): AppData {
  const d = emptyData();
  d.paychecks = [{ id: 'p', amountCents: 120000, status: 'received', receivedAt: '2026-11-02', accountId: 'a', accountCreditCents: 120000 }];
  d.accounts = [{ id: 'a', type: 'checking', name: 'Checking', initialBalanceCents: 0 }];
  d.categories = [{ id: 'food', name: 'Food' }, { id: 'rent', name: 'Rent' }];
  d.allocations = [{ id: 'food-a', paycheckId: 'p', categoryId: 'food', amountCents: 30000 }, { id: 'rent-a', paycheckId: 'p', categoryId: 'rent', amountCents: 90000 }];
  d.goals = [{ id: 'g', name: 'Moving', targetCents: 200000, initialSavedCents: 0 }];
  d.transactions = [{ id: 'spent', description: 'Groceries', type: 'expense', amountCents: 5000, date: '2026-11-02', allocationId: 'food-a', categoryId: 'food', accountId: 'a' }];
  return d;
}
function operation(d: AppData): SavePlanOperation { return { type: 'savePlan', id: 'save', paycheckId: 'p', expectedPlan: paycheckPlanFingerprint(d, 'p'), allocations: d.allocations.map(a => ({ ...a })), goals: d.contributions.filter(c => c.paycheckId === 'p').map(c => ({ ...c })) }; }
describe('atomic paycheck plan editing', () => {
  it('rebalances a fully allocated paycheck in one save, without transient over-allocation or account changes', () => {
    const d = fixture(); const op = operation(d);
    op.allocations[0].amountCents = 40000; op.allocations[1].amountCents = 80000;
    const saved = apply(d, op);
    expect(saved.error).toBeUndefined();
    expect(saved.data.allocations.map(a => a.amountCents)).toEqual([40000, 80000]);
    expect(accountBalance(saved.data, d.accounts[0])).toBe(115000);
    expect(saved.data.transactions).toEqual(d.transactions);
    expect(allocatedForPaycheck(saved.data, 'p')).toBe(120000);
  });
  it('allocates category funds to a goal and returns a zeroed goal to unassigned funds', () => {
    const d = fixture(); const op = operation(d);
    op.allocations[0].amountCents = 25000;
    op.goals = [{ id: 'goal-a', paycheckId: 'p', goalId: 'g', status: 'allocated', amountCents: 5000, date: '2026-11-02' }];
    const next = apply(d, op).data;
    expect(unallocatedForPaycheck(next, 'p')).toBe(0);
    expect(next.contributions[0].amountCents).toBe(5000);
    const remove = operation(next); remove.id = 'second'; remove.goals[0].amountCents = 0;
    const cleared = apply(next, remove);
    expect(cleared.error).toBeUndefined();
    expect(cleared.data.contributions).toHaveLength(0);
    expect(unallocatedForPaycheck(cleared.data, 'p')).toBe(5000);
    expect(accountBalance(cleared.data, d.accounts[0])).toBe(115000);
  });
  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])('rejects invalid/overallocated category amount %s without partial changes', amountCents => {
    const d = fixture(); const op = operation(d); op.allocations[0].amountCents = amountCents;
    const failed = apply(d, op);
    expect(failed.error).toBeTruthy(); expect(failed.data).toBe(d);
  });
  it('protects recorded spending and rejects stale editor snapshots', () => {
    const d = fixture(); const op = operation(d); op.allocations[0].amountCents = 4000;
    expect(apply(d, op).error).toMatch(/spending/);
    const stale = operation(d);
    const changed = { ...d, transactions: [...d.transactions, { ...d.transactions[0], id: 'other', amountCents: 1000 }] };
    expect(apply(changed, stale).error).toMatch(/changed while/);
    expect(apply(changed, stale).data).toBe(changed);
  });
  it('retains original planned distribution while adjusting and receiving lower income atomically', () => {
    const d = fixture(); d.paychecks[0] = { id: 'p', status: 'planned', amountCents: 120000, receivedAt: '2026-11-10' }; d.transactions = [];
    const op = operation(d); op.allocations[1].amountCents = 85000;
    op.receipt = { amountCents: 115000, accountId: 'a', date: '2026-11-11' };
    const saved = apply(d, op);
    expect(saved.error).toBeUndefined();
    expect(saved.data.paychecks[0]).toMatchObject({ plannedAmountCents: 120000, actualAmountCents: 115000, status: 'received' });
    expect(saved.data.paychecks[0].originalPlan?.allocations[1].amountCents).toBe(90000);
    expect(saved.data.allocations[1].amountCents).toBe(85000);
    expect(accountBalance(saved.data, d.accounts[0])).toBe(115000);
    expect(apply(saved.data, op).data).toBe(saved.data);
  });
  it('supports higher actual income and rejects bad receipt data without saving the allocation edits', () => {
    const d = fixture(); d.paychecks[0] = { id: 'p', status: 'planned', amountCents: 120000, receivedAt: '2026-11-10' }; d.transactions = [];
    const op = operation(d); op.allocations[0].amountCents = 35000;
    op.receipt = { amountCents: 125000, accountId: 'a', date: '2026-11-11' };
    const saved = apply(d, op);
    expect(saved.error).toBeUndefined(); expect(accountBalance(saved.data, d.accounts[0])).toBe(125000);
    expect(saved.data.paychecks[0].plannedAmountCents).toBe(120000);
    for (const receipt of [{ ...op.receipt, accountId: 'missing' }, { ...op.receipt, date: '2026-02-30' }, { ...op.receipt, amountCents: 100000 }]) {
      const failed = apply(d, { ...op, receipt }); expect(failed.error).toBeTruthy(); expect(failed.data).toBe(d);
    }
  });
  it('makes repeated submissions idempotent and survives persisted snapshot migration', () => {
    const d = fixture(); const op = operation(d);
    const saved = apply(d, op).data;
    expect(apply(saved, op).data).toBe(saved);
    const reloaded = migrateAppData(JSON.parse(JSON.stringify(saved)));
    expect(reloaded.allocations).toEqual(saved.allocations);
    expect(reloaded.paychecks).toEqual(saved.paychecks);
    expect(accountBalance(reloaded, d.accounts[0])).toBe(115000);
  });
  it('rejects omitted rows, duplicate identifiers, changed references, and settled contribution hijacking', () => {
    const d = fixture();
    const omitted = operation(d); omitted.allocations.pop(); expect(apply(d, omitted).error).toBeTruthy();
    const duplicate = operation(d); duplicate.allocations.push(duplicate.allocations[0]); expect(apply(d, duplicate).error).toMatch(/identifier/);
    const moved = operation(d); moved.allocations[0].categoryId = 'rent'; expect(apply(d, moved).error).toMatch(/relationships/);
    d.contributions = [{ id: 'settled', goalId: 'g', status: 'designated', accountId: 'a', amountCents: 100, date: '2026-11-02' }];
    const hijack = operation(d); hijack.allocations[0].amountCents -= 100;
    hijack.goals = [{ id: 'settled', goalId: 'g', status: 'allocated', paycheckId: 'p', amountCents: 100, date: '2026-11-02' }];
    expect(apply(d, hijack).error).toMatch(/Only paycheck/);
  });
  it('locks recurring allocations to the existing bill planning workflow', () => {
    const d = fixture(); d.allocations[0].subscriptionId = 's';
    d.transactions.push({ id: 's', description: 'Bill', type: 'subscription', categoryId: 'food', amountCents: 30000, date: '2026-11-02' });
    const op = operation(d); op.allocations[0].amountCents = 25000;
    expect(apply(d, op).error).toMatch(/recurring/);
  });
});
