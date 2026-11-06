import { AppData, BudgetAllocation, Id, SavingsContribution } from './models';
import { allocatedForPaycheck, validateAllocation } from './calculations';
import { StoreResult, upsertRecord } from './store';
import { todayISODate } from './date';

export interface SavePlanOperation {
  type: 'savePlan'; paycheckId: Id; id: Id; expectedPlan: string;
  allocations: BudgetAllocation[]; goals: SavingsContribution[];
  receipt?: { amountCents: number; accountId: Id; date: string };
}
/** Detect edits/expenses since this editor opened, even within the provider's serialized queue. */
export function paycheckPlanFingerprint(data: AppData, paycheckId: Id): string {
  const allocations = data.allocations.filter(a => a.paycheckId === paycheckId);
  const ids = new Set(allocations.map(a => a.id));
  return JSON.stringify({ paycheck: data.paychecks.find(p => p.id === paycheckId), allocations,
    goals: data.contributions.filter(c => c.paycheckId === paycheckId),
    spending: data.transactions.filter(t => t.allocationId && ids.has(t.allocationId)) });
}
/** Build and validate the final plan before returning any state. Never posts account activity. */
export function savePaycheckPlan(data: AppData, op: SavePlanOperation): StoreResult {
  const fail = (error: string) => ({ data, error });
  const p = data.paychecks.find(p => p.id === op.paycheckId);
  if (!p) return fail('This paycheck no longer exists.');
  const oldAllocations = data.allocations.filter(a => a.paycheckId === p.id);
  const oldGoals = data.contributions.filter(c => c.paycheckId === p.id);
  if (oldAllocations.some(a => !op.allocations.some(row => row.id === a.id)) || oldGoals.some(c => !op.goals.some(row => row.id === c.id))) return fail('The plan changed. Reopen it before saving.');
  const ids = [...op.allocations, ...op.goals].map(r => r.id);
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) return fail('Each plan row must have its own identifier.');
  for (const a of op.allocations) {
    const old = data.allocations.find(row => row.id === a.id);
    if (a.paycheckId !== p.id || (old && (old.paycheckId !== p.id || old.categoryId !== a.categoryId || old.subscriptionId !== a.subscriptionId))) return fail('Existing category relationships cannot change in the plan editor.');
    if (old?.subscriptionId && old.amountCents !== a.amountCents) return fail('A recurring allocation must match its bill. Manage it from Budget.');
    if (!old && a.subscriptionId) return fail('Add recurring bills using the existing bill planning action.');
  }
  for (const c of op.goals) {
    const old = data.contributions.find(row => row.id === c.id);
    if (c.paycheckId !== p.id || c.status !== 'allocated' || c.accountId || c.transactionId || (old && (old.paycheckId !== p.id || old.goalId !== c.goalId || old.status !== 'allocated'))) return fail('Only paycheck goal allocations can be edited here.');
    if (!Number.isSafeInteger(c.amountCents) || c.amountCents < 0) return fail('Goal amounts must be zero or greater.');
    if (!data.goals.some(g => g.id === c.goalId)) return fail('A selected goal no longer exists.');
  }
  const limit = op.receipt?.amountCents ?? p.amountCents;
  if (!Number.isSafeInteger(limit) || limit <= 0) return fail('Paycheck income must be greater than zero.');
  const candidate: AppData = { ...data,
    allocations: [...data.allocations.filter(a => a.paycheckId !== p.id), ...op.allocations],
    contributions: [...data.contributions.filter(c => c.paycheckId !== p.id), ...op.goals.filter(c => c.amountCents > 0)],
  };
  if (!Number.isSafeInteger(allocatedForPaycheck(candidate, p.id)) || allocatedForPaycheck(candidate, p.id) > limit) return fail('This plan exceeds the paycheck. Reduce an amount before saving.');
  const validationData = { ...candidate, paychecks: candidate.paychecks.map(row => row.id === p.id ? { ...row, amountCents: limit } : row) };
  for (const a of op.allocations) {
    const error = validateAllocation(validationData, a);
    if (error) return fail(error);
  }
  for (const c of op.goals.filter(c => c.amountCents > 0)) {
    const result = upsertRecord(validationData, 'contributions', c);
    if (result.error) return fail(result.error);
  }
  return { data: { ...candidate, paychecks: candidate.paychecks.map(row => row.id === p.id ? { ...row,
    allocationHistory: [...(row.allocationHistory ?? []), { id: op.id, date: todayISODate(data.user), description: `Saved paycheck plan: ${allocatedForPaycheck(candidate, p.id) / 100} assigned across categories and goals. Account balances unchanged by allocation edits.` }],
  } : row) } };
}
