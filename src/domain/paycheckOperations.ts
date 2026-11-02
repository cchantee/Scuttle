import { paycheckPlanFingerprint, savePaycheckPlan, SavePlanOperation } from './paycheckPlan';
import { AppData, BudgetAllocation, Id, SavingsContribution } from './models';
import { allocatedForPaycheck, spentForAllocation } from './calculations';
import { StoreResult, upsertRecord } from './store';
import { todayISODate } from './date';

export type PaycheckOperation = SavePlanOperation
  | { type: 'reviewReceipt'; paycheckId: Id }
  | { type: 'receive'; paycheckId: Id; amountCents: number; accountId: Id; date: string }
  | { type: 'reallocate'; paycheckId: Id; sourceId: Id; goalId?: Id; categoryId?: Id; amountCents: number; id: Id };

/** Pure atomic transition. The provider serializes calls and commits one complete snapshot. */
export function applyPaycheckOperation(data: AppData, operation: PaycheckOperation): StoreResult {
  const p = data.paychecks.find(p => p.id === operation.paycheckId);
  const fail = (error: string) => ({ data, error });
  if (!p) return fail('Paycheck not found.');
  if (operation.type === 'savePlan') {
    if (p.allocationHistory?.some(h => h.id === operation.id)) return { data };
    if (paycheckPlanFingerprint(data, p.id) !== operation.expectedPlan) return fail('This paycheck changed while you were editing. Reopen the plan to use the latest amounts.');
    let base = data;
    if (operation.receipt) {
      if (p.status !== 'planned') return fail('This paycheck has already been received.');
      const review = applyPaycheckOperation(data, { type: 'reviewReceipt', paycheckId: p.id });
      if (review.error) return fail(review.error);
      base = review.data;
    }
    const saved = savePaycheckPlan(base, operation);
    if (saved.error) return fail(saved.error);
    if (operation.receipt) {
      const received = applyPaycheckOperation(saved.data, { type: 'receive', paycheckId: p.id, ...operation.receipt });
      return received.error ? fail(received.error) : received;
    }
    return saved;
  }
  if (operation.type === 'reviewReceipt') {
    if (p.status !== 'planned') return fail('Only planned paychecks can be reviewed for receipt.');
    if (p.originalPlan) return { data };
    return { data: { ...data, paychecks: data.paychecks.map(item => item.id === p.id ? { ...p, originalPlan: { amountCents: p.amountCents, date: p.receivedAt, source: p.source, notes: p.notes, allocations: data.allocations.filter(a => a.paycheckId === p.id), goals: data.contributions.filter(c => c.paycheckId === p.id) } } : item) } };
  }
  if (operation.type === 'receive') {
    if (p.status !== 'planned') return fail('This paycheck has already been received.');
    const account = data.accounts.find(a => a.id === operation.accountId && a.type !== 'credit_card');
    if (!account) return fail('Choose a cash or savings account for receipt.');
    if (!Number.isSafeInteger(operation.amountCents) || operation.amountCents <= 0) return fail('Actual income must be greater than zero.');
    if (allocatedForPaycheck(data, p.id) > operation.amountCents) return fail('Allocations exceed actual income. Adjust the paycheck allocations before confirming receipt.');
    // Validate calendar date through the existing paycheck validator, without transitioning yet.
    const checked = upsertRecord(data, 'paychecks', { ...p, amountCents: operation.amountCents, receivedAt: operation.date });
    if (checked.error) return fail(checked.error);
    return { data: { ...data, paychecks: data.paychecks.map(item => item.id === p.id ? {
      ...p, status: 'received', plannedAmountCents: p.originalPlan?.amountCents ?? p.amountCents, expectedAt: p.originalPlan?.date ?? p.receivedAt,
      originalPlan: p.originalPlan ?? { amountCents: p.amountCents, date: p.receivedAt, source: p.source, notes: p.notes,
        allocations: data.allocations.filter(a => a.paycheckId === p.id).map(a => ({ ...a })),
        goals: data.contributions.filter(c => c.paycheckId === p.id).map(c => ({ ...c })) },
      actualAmountCents: operation.amountCents, amountCents: operation.amountCents,
      receivedAt: operation.date, accountId: account.id, accountCreditCents: operation.amountCents, remainingAccountId: account.id,
    } : item) } };
  }
  if (p.allocationHistory?.some(h => h.id === operation.id)) return { data };
  if (!Number.isSafeInteger(operation.amountCents) || operation.amountCents <= 0) return fail('Reallocation must be greater than zero.');
  const source = data.allocations.find(a => a.id === operation.sourceId && a.paycheckId === p.id);
  if (!source || source.subscriptionId) return fail('Choose an eligible category allocation without a linked subscription.');
  if (operation.amountCents > source.amountCents - spentForAllocation(data, source.id)) return fail('Reallocation exceeds available, unspent funds.');
  if (!!operation.goalId === !!operation.categoryId) return fail('Choose one destination.');
  let next = { ...data, allocations: data.allocations.map(a => a.id === source.id ? { ...a, amountCents: a.amountCents - operation.amountCents } : a) };
  if (operation.goalId) {
    const c: SavingsContribution = { id: operation.id, paycheckId: p.id, goalId: operation.goalId, amountCents: operation.amountCents, date: todayISODate(), status: 'allocated', note: 'Allocated from paycheck; no account transfer.' };
    if (data.contributions.some(c => c.id === operation.id)) return fail('Operation identifier is already in use.');
    const result = upsertRecord(next, 'contributions', c);
    if (result.error) return fail(result.error);
    next = result.data;
  } else {
    const a: BudgetAllocation = { id: operation.id, paycheckId: p.id, categoryId: operation.categoryId!, amountCents: operation.amountCents };
    if (a.categoryId === source.categoryId || data.allocations.some(a => a.id === operation.id)) return fail('Choose a different category.');
    const result = upsertRecord(next, 'allocations', a);
    if (result.error) return fail(result.error);
    next = result.data;
  }
  return { data: { ...next, paychecks: next.paychecks.map(item => item.id === p.id ? { ...item, allocationHistory: [...(item.allocationHistory ?? []), { id: operation.id, date: todayISODate(), description: `${operation.amountCents / 100} from ${data.categories.find(c => c.id === source.categoryId)?.name} to ${data.goals.find(g => g.id === operation.goalId)?.name ?? data.categories.find(c => c.id === operation.categoryId)?.name}` }] } : item) } };
}
