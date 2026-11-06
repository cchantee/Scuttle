import { AppData, BudgetAllocation, Id } from './models';

export interface ExpenseContext { allocationId?: Id; categoryId?: Id; paycheckId?: Id }
export function expenseAllocation(data: AppData, context: ExpenseContext): BudgetAllocation | undefined {
  if (context.allocationId) return data.allocations.find(a => a.id === context.allocationId);
  return data.allocations.filter(a => a.categoryId === context.categoryId && (!context.paycheckId || a.paycheckId === context.paycheckId))
    .filter(a => data.paychecks.some(p => p.id === a.paycheckId && p.status !== 'planned' && !p.budgetArchived))
    .sort((a,b) => (data.paychecks.find(p => p.id === b.paycheckId)?.receivedAt ?? '').localeCompare(data.paychecks.find(p => p.id === a.paycheckId)?.receivedAt ?? '') || data.paychecks.findIndex(p => p.id === b.paycheckId) - data.paychecks.findIndex(p => p.id === a.paycheckId))[0];
}

/** An explicit selection (including clearing the field) always wins over defaults. */
export function payingAccountSelection(data: AppData, context: ExpenseContext, selection: { accountId: string; manual: boolean }) {
  if (selection.manual) return selection.accountId;
  const allocation = expenseAllocation(data,context);
  const paycheckId = allocation?.paycheckId ?? context.paycheckId;
  const paycheck = paycheckId ? data.paychecks.find(p => p.id === paycheckId) : [...data.paychecks].reverse()
    .filter(p => p.status !== 'planned' && !p.budgetArchived)
    .sort((a,b) => b.receivedAt.localeCompare(a.receivedAt))[0];
  const accountId = paycheck?.remainingAccountId ?? paycheck?.accountId;
  if (accountId && data.accounts.some(a => a.id === accountId)) return accountId;
  return data.accounts.find(a => a.type === 'checking')?.id ?? data.accounts.find(a => a.type === 'cash')?.id
    ?? data.accounts.find(a => a.type !== 'credit_card')?.id ?? '';
}
