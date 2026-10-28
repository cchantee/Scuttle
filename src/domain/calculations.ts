import { AppData, BudgetAllocation, SavingsGoal, Transaction, VirtualAccount } from './models';

export const allocatedForPaycheck = (data: AppData, paycheckId: string) =>
  data.allocations.filter(x => x.paycheckId === paycheckId).reduce((sum, x) => sum + x.amountCents, 0);
export const unallocatedForPaycheck = (data: AppData, paycheckId: string) =>
  (data.paychecks.find(x => x.id === paycheckId)?.amountCents ?? 0) - allocatedForPaycheck(data, paycheckId);
export const spentForAllocation = (data: AppData, allocationId: string) =>
  data.transactions.filter(x => x.type === 'expense' && x.allocationId === allocationId).reduce((sum, x) => sum + x.amountCents, 0);
export const allocationSummary = (data: AppData, allocation: BudgetAllocation) => {
  const spentCents = spentForAllocation(data, allocation.id);
  return { allocatedCents: allocation.amountCents, spentCents, remainingCents: allocation.amountCents - spentCents };
};
export const goalSaved = (data: AppData, goalId: string) => {
  const goal = data.goals.find(x => x.id === goalId);
  return (goal?.initialSavedCents ?? 0) + data.contributions.filter(x => x.goalId === goalId).reduce((sum, x) => sum + x.amountCents, 0);
};
export const goalSummary = (data: AppData, goal: SavingsGoal) => {
  const savedCents = goalSaved(data, goal.id);
  return {
    savedCents,
    remainingCents: goal.targetCents - savedCents,
    progressPercent: goal.targetCents > 0 ? Math.min(100, (savedCents / goal.targetCents) * 100) : 0,
  };
};

/** Cash-like accounts are assets (positive = owned); credit cards are liabilities (positive = owed).
 * Expenses reduce cash and increase card debt; income does the reverse. Transfers apply both sides once.
 */
export function accountBalance(data: AppData, account: VirtualAccount): number {
  return account.initialBalanceCents + data.transactions.reduce((sum, tx) => sum + accountEffect(tx, account), 0);
}
function accountEffect(tx: Transaction, account: VirtualAccount): number {
  if (tx.type === 'transfer') {
    if (tx.accountId === account.id) return account.type === 'credit_card' ? tx.amountCents : -tx.amountCents;
    if (tx.toAccountId === account.id) return account.type === 'credit_card' ? -tx.amountCents : tx.amountCents;
    return 0;
  }
  if (tx.accountId !== account.id) return 0;
  if (account.type === 'credit_card') return tx.type === 'expense' ? tx.amountCents : -tx.amountCents;
  return tx.type === 'expense' ? -tx.amountCents : tx.amountCents;
}

export function validateTransaction(data: AppData, tx: Transaction): string | null {
  if (!tx.description.trim()) return 'Enter a description.';
  if (!Number.isSafeInteger(tx.amountCents) || tx.amountCents <= 0) return 'Amount must be greater than zero.';
  if (!validDate(tx.date)) return 'Enter a valid transaction date in YYYY-MM-DD format.';
  if (tx.categoryId && !data.categories.some(x => x.id === tx.categoryId)) return 'Selected category does not exist.';
  if (tx.allocationId && tx.type !== 'expense') return 'Only expenses can be linked to a budget allocation.';
  if (tx.allocationId && !data.allocations.some(x => x.id === tx.allocationId)) return 'Selected allocation does not exist.';
  if (tx.type === 'expense' && tx.allocationId) {
    const allocation = data.allocations.find(x => x.id === tx.allocationId);
    if (!allocation) return 'Selected allocation does not exist.';
    if (tx.categoryId && allocation.categoryId !== tx.categoryId) return 'Transaction category must match its allocation.';
  }
  if (tx.accountId && !data.accounts.some(x => x.id === tx.accountId)) return 'Selected account does not exist.';
  if (tx.type === 'transfer') {
    if (!tx.accountId || !tx.toAccountId || tx.accountId === tx.toAccountId) return 'Choose two different accounts for a transfer.';
    if (!data.accounts.some(x => x.id === tx.toAccountId)) return 'Destination account does not exist.';
  }
  return null;
}

function validDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function validateAllocation(data: AppData, allocation: BudgetAllocation): string | null {
  if (!data.paychecks.some(x => x.id === allocation.paycheckId)) return 'Selected paycheck does not exist.';
  if (!data.categories.some(x => x.id === allocation.categoryId)) return 'Selected category does not exist.';
  if (!Number.isSafeInteger(allocation.amountCents) || allocation.amountCents < 0) return 'Allocation must be a non-negative amount.';
  return null;
}
