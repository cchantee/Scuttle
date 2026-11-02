import { AppData, BudgetAllocation, Paycheck, SavingsGoal, SubscriptionFrequency, Transaction, VirtualAccount } from './models';
import { normalizeDateInput } from './date';

export const allocatedForPaycheck = (data: AppData, paycheckId: string) =>
  data.allocations.filter(x => x.paycheckId === paycheckId).reduce((sum, x) => sum + x.amountCents, 0) + data.contributions.filter(x => x.paycheckId === paycheckId).reduce((sum, x) => sum + x.amountCents, 0);
export const unallocatedForPaycheck = (data: AppData, paycheckId: string) =>
  (data.paychecks.find(x => x.id === paycheckId)?.amountCents ?? 0) - allocatedForPaycheck(data, paycheckId);
export const spentForPaycheck = (data: AppData, paycheckId: string) => {
  const allocationIds = new Set(data.allocations.filter(item => item.paycheckId === paycheckId).map(item => item.id));
  return data.transactions.filter(tx => tx.type === 'expense' && tx.allocationId && allocationIds.has(tx.allocationId)).reduce((sum, tx) => sum + tx.amountCents, 0);
};
export const remainingForPaycheck = (data: AppData, paycheckId: string) => Math.max(0, (data.paychecks.find(x => x.id === paycheckId)?.amountCents ?? 0) - spentForPaycheck(data, paycheckId));
export const spentForAllocation = (data: AppData, allocationId: string) =>
  data.transactions.filter(x => x.type === 'expense' && x.allocationId === allocationId).reduce((sum, x) => sum + x.amountCents, 0);
export const allocationSummary = (data: AppData, allocation: BudgetAllocation) => {
  const spentCents = spentForAllocation(data, allocation.id);
  return { allocatedCents: allocation.amountCents, spentCents, remainingCents: allocation.amountCents - spentCents };
};
/** All allocations belonging to paychecks whose budgets have not been archived. */
export const activeBudgetAllocations = (data: AppData) => {
  const activePaycheckIds = new Set(data.paychecks.filter(paycheck => !paycheck.budgetArchived && paycheck.status !== 'planned').map(paycheck => paycheck.id));
  return data.allocations.filter(allocation => activePaycheckIds.has(allocation.paycheckId));
};
export const goalSaved = (data: AppData, goalId: string) => {
  const goal = data.goals.find(x => x.id === goalId);
  return (goal?.initialSavedCents ?? 0) + data.contributions.filter(x => x.goalId === goalId && (!x.paycheckId || data.paychecks.find(p => p.id === x.paycheckId)?.status !== 'planned')).reduce((sum, x) => sum + x.amountCents, 0);
};
/** Goal savings excluding funds that are still reserved/pending in an account. */
export const completedGoalSaved = (data: AppData, goalId: string) => {
  const goal = data.goals.find(x => x.id === goalId);
  return (goal?.initialSavedCents ?? 0) + data.contributions
    .filter(item => item.goalId === goalId && item.status !== 'pending' && item.status !== 'allocated')
    .reduce((sum, item) => sum + item.amountCents, 0);
};
/** Dashboard account metrics include cash-like assets; card debt is reported separately. */
export const cashAccountSummary = (data: AppData) => {
  const cashAccounts = data.accounts.filter(account => account.type !== 'credit_card');
  const totalCashCents = cashAccounts.reduce((sum, account) => sum + accountBalance(data, account), 0);
  const availableCashCents = cashAccounts.reduce((sum, account) => sum + (availableAccountBalance(data, account) ?? 0), 0);
  const creditCardDebtCents = data.accounts
    .filter(account => account.type === 'credit_card')
    .reduce((sum, account) => sum + Math.max(0, accountBalance(data, account)), 0);
  return { totalCashCents, availableCashCents, creditCardDebtCents };
};
/** Savings quick view aggregates settled goal contributions, excluding pending reservations. */
export const savingsGoalSummary = (data: AppData) => {
  const savedCents = data.goals.reduce((sum, goal) => sum + completedGoalSaved(data, goal.id), 0);
  const targetCents = data.goals.reduce((sum, goal) => sum + goal.targetCents, 0);
  return {
    savedCents,
    targetCents,
    progressPercent: targetCents > 0 ? (savedCents / targetCents) * 100 : 0,
  };
};
export const pendingForAccount = (data: AppData, accountId: string) => data.contributions
  .filter(item => item.accountId === accountId && item.status === 'pending')
  .reduce((sum, item) => sum + item.amountCents, 0);
export const pendingForGoal = (data: AppData, goalId: string) => data.contributions
  .filter(item => item.goalId === goalId && item.status === 'pending')
  .reduce((sum, item) => sum + item.amountCents, 0);
/** Spendable balance after pending goal holds. Credit limits are not tracked. */
export const availableAccountBalance = (data: AppData, account: VirtualAccount) => account.type === 'credit_card'
  ? null
  : accountBalance(data, account) - pendingForAccount(data, account.id);
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
 * A paycheck linked to an account is itself one income ledger event; allocations never alter account balances.
 */
export function accountBalance(data: AppData, account: VirtualAccount): number {
  const paycheckIncome = data.paychecks.filter(paycheck => paycheck.status !== 'planned' && paycheck.accountId === account.id)
    .reduce((sum, paycheck) => {
      const credited = paycheck.accountCreditCents ?? paycheck.amountCents;
      return sum + (account.type === 'credit_card' ? -credited : credited);
    }, 0);
  return account.initialBalanceCents + paycheckIncome + data.transactions.reduce((sum, tx) => sum + accountEffect(tx, account), 0);
}
/** End-of-day posted balance for deterministic historical interest calculations. */
export function accountBalanceAt(data: AppData, account: VirtualAccount, date: string): number {
  const paycheckIncome = data.paychecks.filter(paycheck => paycheck.status !== 'planned' && paycheck.accountId === account.id && paycheck.receivedAt <= date)
    .reduce((sum, paycheck) => {
      const credited = paycheck.accountCreditCents ?? paycheck.amountCents;
      return sum + (account.type === 'credit_card' ? -credited : credited);
    }, 0);
  return account.initialBalanceCents + paycheckIncome + data.transactions
    .filter(transaction => transaction.date <= date)
    .reduce((sum, transaction) => sum + accountEffect(transaction, account), 0);
}
function accountEffect(tx: Transaction, account: VirtualAccount): number {
  // Scheduled subscription reminders are not ledger events until the user logs the actual charge.
  if (tx.type === 'subscription') return 0;
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
  if (tx.type === 'subscription') {
    if (!tx.subscriptionFrequency || !tx.nextDueDate || !validDate(tx.nextDueDate)) return 'Add a valid next charge date and repeat schedule for this subscription.';
    if (tx.subscriptionFrequency === 'custom' && (!Number.isInteger(tx.subscriptionIntervalDays) || (tx.subscriptionIntervalDays ?? 0) < 1 || (tx.subscriptionIntervalDays ?? 0) > 365)) return 'Choose a subscription interval from 1 to 365 days.';
  }
  if (tx.categoryId && !data.categories.some(x => x.id === tx.categoryId)) return 'Selected category does not exist.';
  if (tx.paycheckId && (tx.type !== 'transfer' || !data.paychecks.some(x => x.id === tx.paycheckId))) return 'The linked paycheck is invalid for this transaction.';
  if (tx.allocationId && tx.type !== 'expense') return 'Only expenses can be linked to a budget allocation.';
  if (tx.allocationId && !data.allocations.some(x => x.id === tx.allocationId)) return 'Selected allocation does not exist.';
  if (tx.type === 'expense' && tx.allocationId) {
    const allocation = data.allocations.find(x => x.id === tx.allocationId);
    if (!allocation) return 'Selected allocation does not exist.';
    if (data.paychecks.find(p => p.id === allocation.paycheckId)?.status === 'planned') return 'Planned funds cannot be spent.';
    if (tx.categoryId && allocation.categoryId !== tx.categoryId) return 'Transaction category must match its allocation.';
  }
  if (tx.accountId && !data.accounts.some(x => x.id === tx.accountId)) return 'Selected account does not exist.';
  if (tx.goalContributionId) {
    const contribution = data.contributions.find(item => item.id === tx.goalContributionId);
    if (!contribution || (contribution.status !== 'pending' && contribution.transactionId !== tx.id)) return 'This pending goal contribution is not available to settle.';
    if (tx.type !== 'transfer' && !(contribution.status === 'posted' && contribution.transactionId === tx.id && tx.type === 'expense')) return 'A pending goal contribution can only be completed in place or transferred to another account.';
    if (tx.amountCents !== contribution.amountCents || tx.accountId !== contribution.accountId) return 'The transaction amount and source account must match the pending goal contribution.';
  }
  if (tx.type === 'transfer') {
    if (!tx.accountId || !tx.toAccountId || tx.accountId === tx.toAccountId) return 'Choose two different accounts for a transfer.';
    if (!data.accounts.some(x => x.id === tx.toAccountId)) return 'Destination account does not exist.';
  }
  return null;
}

/** Returns the next occurrence on or after today for a scheduled subscription. */
export function nextSubscriptionDue(tx: Transaction, today: string): string | null {
  if (tx.type !== 'subscription' || !tx.nextDueDate || !tx.subscriptionFrequency) return null;
  const anchor = normalizeDateInput(tx.nextDueDate);
  const current = normalizeDateInput(today);
  if (!anchor || !current) return null;
  const frequency = tx.subscriptionFrequency;
  const interval = frequency === 'weekly' ? 7 : frequency === 'biweekly' ? 14 : frequency === 'annual' ? 365 : frequency === 'custom' ? tx.subscriptionIntervalDays : undefined;
  if (frequency === 'monthly' || frequency === 'annual') {
    const [year, month, day] = anchor.split('-').map(Number);
    const [currentYear, currentMonth] = current.split('-').map(Number);
    const period = frequency === 'monthly' ? 1 : 12;
    let periods = Math.max(0, Math.floor(((currentYear - year) * 12 + currentMonth - month) / period));
    let result = recurringMonthDate(year, month, day, periods * period);
    if (result < current) result = recurringMonthDate(year, month, day, (periods + 1) * period);
    return result;
  }
  if (!interval || !Number.isInteger(interval)) return null;
  const anchorOrdinal = toOrdinal(anchor);
  const currentOrdinal = toOrdinal(current);
  const steps = Math.max(0, Math.ceil((currentOrdinal - anchorOrdinal) / interval));
  return fromOrdinal(anchorOrdinal + steps * interval);
}

function toOrdinal(value: string) { const [y, m, d] = value.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 86400000); }
function fromOrdinal(value: number) { const date = new Date(value * 86400000); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`; }
function recurringMonthDate(year: number, month: number, day: number, offsetMonths: number) {
  const totalMonth = month - 1 + offsetMonths;
  const nextYear = year + Math.floor(totalMonth / 12);
  const nextMonth = totalMonth % 12 + 1;
  const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
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
  if (allocation.amountCents < spentForAllocation(data, allocation.id)) return 'Allocation cannot be less than its recorded spending.';
  if (unallocatedForPaycheck(data, allocation.paycheckId) < 0) return 'Allocations exceed paycheck income. Reduce another allocation first.';
  if (allocation.subscriptionId) {
    const subscription = data.transactions.find(x => x.id === allocation.subscriptionId && x.type === 'subscription');
    if (!subscription) return 'The linked subscription does not exist.';
    if (!subscription.categoryId || subscription.categoryId !== allocation.categoryId) return 'The allocation category must match the subscription budget category.';
    if (data.allocations.some(item => item.id !== allocation.id && item.paycheckId === allocation.paycheckId && item.subscriptionId === allocation.subscriptionId)) return 'This subscription is already planned for that paycheck.';
  }
  return null;
}

/** Latest date first; for equal dates the most recently added paycheck wins. */
export const newestPaychecks = (paychecks: Paycheck[]) => paychecks.map((paycheck, index) => ({ paycheck, index }))
  .sort((a, b) => b.paycheck.receivedAt.localeCompare(a.paycheck.receivedAt) || b.index - a.index).map(row => row.paycheck);
