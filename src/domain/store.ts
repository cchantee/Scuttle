import { applyPaycheckOperation } from './paycheckOperations';
import { committedForAccount, goalFundsHeld, goalHoldingAccount } from './goalFunds';
import { cashLedgerError } from './accountLedger';
import { expenseAllocation, payingAccountSelection } from './transactionAccounts';
import { startReceivedBudget } from './paycheckBudget';
import { AppData, BudgetAllocation, BudgetCategory, Id, Paycheck, SavingsContribution, SavingsGoal, Transaction, VirtualAccount } from './models';
import { allocatedForPaycheck, spentForAllocation, accountBalance, validateAllocation, validateTransaction } from './calculations';
import { newId } from './models';
import { todayISODate } from './date';

export interface StorageAdapter {
  load(): Promise<AppData | null>;
  save(data: AppData): Promise<void>;
}
export class MemoryStorage implements StorageAdapter {
  private data: AppData | null = null;
  async load() { return this.data; }
  async save(data: AppData) { this.data = data; }
}

export type CollectionName = 'paychecks' | 'categories' | 'allocations' | 'transactions' | 'accounts' | 'goals' | 'contributions';
type RecordOf<C extends CollectionName> = AppData[C][number];
export type StoreResult = { data: AppData; error?: string };

export function upsertRecord<C extends CollectionName>(data: AppData, collection: C, record: RecordOf<C>): StoreResult {
  const list = data[collection] as Array<RecordOf<C>>;
  const index = list.findIndex(x => x.id === record.id);
  const next = index < 0 ? [...list, record] : list.map((x, i) => i === index ? record : x);
  const updated = { ...data, [collection]: next } as AppData;
  if (collection === 'paychecks') {
    const p = record as Paycheck;
    const previous = data.paychecks.find(item => item.id === p.id);
    if (previous && previous.status !== 'planned' && p.status === 'planned') return { data, error: 'Received income cannot become planned income.' };
    if (previous?.status === 'planned' && p.status !== 'planned') return { data, error: 'Use Mark as Received to confirm planned income.' };
    if (p.status === 'planned' && (p.accountId || p.accountCreditCents || p.remainingAccountId)) return { data, error: 'Planned paychecks cannot credit an account.' };
    if (allocatedForPaycheck(updated, p.id) > p.amountCents) return { data, error: 'Allocations exceed paycheck income.' };
    if (previous?.actualAmountCents !== undefined && (p.actualAmountCents !== previous.actualAmountCents || p.amountCents !== previous.amountCents || p.accountId !== previous.accountId || p.accountCreditCents !== previous.accountCreditCents || JSON.stringify(p.originalPlan) !== JSON.stringify(previous.originalPlan))) return { data, error: 'Confirmed receipt and original plan cannot be changed. Edit allocations separately.' };

    if (!Number.isSafeInteger(p.amountCents) || p.amountCents <= 0) return { data, error: 'Paycheck amount must be greater than zero.' };
    if (!validDate(p.receivedAt)) return { data, error: 'Enter a valid paycheck date in YYYY-MM-DD format.' };
    if (p.accountId && !updated.accounts.some(account => account.id === p.accountId)) return { data, error: 'The selected deposit account does not exist.' };
    if (p.remainingAccountId && !updated.accounts.some(account => account.id === p.remainingAccountId)) return { data, error: 'The account holding the remaining paycheck funds does not exist.' };
    if (p.accountCreditCents !== undefined && (!Number.isSafeInteger(p.accountCreditCents) || p.accountCreditCents < 0)) return { data, error: 'Paycheck account credit must be a non-negative amount.' };
    if (p.status !== 'planned' && (!previous || previous.status === 'planned')) updated.paychecks = startReceivedBudget(updated.paychecks, p.id);
  }
  if (collection === 'categories' && !(record as BudgetCategory).name.trim()) return { data, error: 'Category name is required.' };
  if (collection === 'accounts') {
    const supplied = record as VirtualAccount;
    const previous = data.accounts.find(item => item.id === supplied.id);
    const rate = supplied.interestRatePercent ?? 0;
    const today = todayISODate(data.user);
    const interestStartDate = previous?.interestStartDate ?? supplied.interestStartDate ?? today;
    let history = previous?.interestRateHistory ?? supplied.interestRateHistory ?? [{ effectiveDate: interestStartDate, ratePercent: previous?.interestRatePercent ?? rate }];
    const previousRate = previous?.interestRatePercent ?? 0;
    if (previous && rate !== previousRate) {
      const change = { effectiveDate: today, ratePercent: rate };
      history = history.filter(item => item.effectiveDate !== today).concat(change).sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
    }
    const account: VirtualAccount = { ...supplied, interestRatePercent: rate, interestStartDate, interestRateHistory: history };
    updated.accounts = updated.accounts.map(item => item.id === account.id ? account : item);
    if (!account.name.trim()) return { data, error: 'Account name is required.' };
    if (!Number.isSafeInteger(account.initialBalanceCents) || account.initialBalanceCents < 0) return { data, error: 'Starting balance must be a non-negative amount.' };
    const supportsInterest = account.type === 'savings' || account.type === 'high_yield_savings' || account.type === 'credit_card';
    if (!Number.isFinite(account.interestRatePercent) || account.interestRatePercent! < 0 || account.interestRatePercent! > 100 || (!supportsInterest && account.interestRatePercent !== 0)) return { data, error: 'Enter an interest rate from 0% to 100% for a savings or credit card account.' };
    if (!validDate(account.interestStartDate ?? '')) return { data, error: 'Interest start date must be valid.' };
    if (account.interestRateHistory?.some(change => !validDate(change.effectiveDate) || !Number.isFinite(change.ratePercent) || change.ratePercent < 0 || change.ratePercent > 100)) return { data, error: 'Interest rate history contains an invalid rate or date.' };
  }
  if (collection === 'goals') {
    const goal = record as SavingsGoal;
    if (!goal.name.trim()) return { data, error: 'Goal name is required.' };
    if (!Number.isSafeInteger(goal.targetCents) || goal.targetCents <= 0) return { data, error: 'Goal target must be greater than zero.' };
    if (!Number.isSafeInteger(goal.initialSavedCents) || goal.initialSavedCents < 0) return { data, error: 'Initial saved amount must be non-negative.' };
  }
  if (collection === 'allocations') {
    const allocation = record as BudgetAllocation;
    const error = validateAllocation(updated, allocation);
    if (error) return { data, error };
    const old = data.allocations.find(x => x.id === allocation.id);
    if (old && old.paycheckId !== allocation.paycheckId) return { data, error: 'An allocation cannot move to another paycheck.' };
    if (old && old.categoryId !== allocation.categoryId) {
      updated.transactions = updated.transactions.map(tx => tx.allocationId === allocation.id ? { ...tx, categoryId: allocation.categoryId } : tx);
    }
  }
  if (collection === 'transactions') {
    let tx = record as Transaction;
    if (tx.type === 'expense' && tx.allocationId && !tx.categoryId) {
      const allocation = updated.allocations.find(x => x.id === tx.allocationId);
      if (allocation) { tx = { ...tx, categoryId: allocation.categoryId }; updated.transactions = updated.transactions.map(x => x.id === tx.id ? tx : x); }
    }
    if (tx.type === 'expense' && tx.categoryId && !tx.allocationId) {
      const previous = data.transactions.find(item => item.id === tx.id);
      const previousAllocation = previous?.categoryId === tx.categoryId && previous.allocationId
        ? updated.allocations.find(item => item.id === previous.allocationId)
        : undefined;
      const activeAllocation = expenseAllocation(updated, tx);
      const allocation = previousAllocation ?? activeAllocation;
      if (allocation) tx = { ...tx, allocationId: allocation.id };
    }
    if (tx.type === 'expense' && !tx.accountId && !data.transactions.some(item => item.id === tx.id)) {
      tx = { ...tx, accountId: payingAccountSelection(updated, tx, { accountId: '', manual: false }) || undefined };
    }
    updated.transactions = updated.transactions.map(item => item.id === tx.id ? tx : item);
    const error = validateTransaction(updated, tx);
    if (error) return { data, error };
    if (tx.type === 'transfer' && tx.goalContributionId && !data.transactions.some(t => t.id === tx.id)) updated.contributions = updated.contributions.map(c => c.id === tx.goalContributionId ? { ...c, accountId: tx.toAccountId, transactionId: tx.id } : c);
    if (tx.type === 'expense' || tx.type === 'transfer') {
      const previous = data.transactions.find(item => item.id === tx.id);
      const ledgerError = cashLedgerError(updated, [tx.accountId, tx.toAccountId, previous?.accountId, previous?.toAccountId]);
      if (ledgerError) return { data, error: ledgerError };
    }
    if (tx.interestPosting) {
      const account = updated.accounts.find(item => item.id === tx.accountId);
      const isSavingsCredit = tx.interestPosting === 'savings_credit' && tx.type === 'income' && (account?.type === 'savings' || account?.type === 'high_yield_savings');
      const isCardCharge = tx.interestPosting === 'credit_card_charge' && tx.type === 'expense' && account?.type === 'credit_card';
      if (!account || (!isSavingsCredit && !isCardCharge) || !/^\d{4}-\d{2}$/.test(tx.interestPeriodKey ?? '') || tx.date !== periodEnd(tx.interestPeriodKey!)) return { data, error: 'Interest posting must match an eligible account and a calendar month end.' };
      if (data.transactions.some(item => item.id !== tx.id && item.accountId === account.id && item.interestPeriodKey === tx.interestPeriodKey && item.interestPosting)) return { data, error: 'Interest has already been posted for this account and month.' };
    } else if (tx.interestPeriodKey) return { data, error: 'Interest period metadata requires an interest posting type.' };
    if (tx.type !== 'subscription' && data.allocations.some(allocation => allocation.subscriptionId === tx.id)) return { data, error: 'This subscription is linked to a paycheck plan. Remove that planned allocation before changing its type.' };
    if (tx.type === 'subscription' && updated.allocations.some(allocation => allocation.subscriptionId === tx.id && (allocation.categoryId !== tx.categoryId || allocation.amountCents !== tx.amountCents))) return { data, error: 'This subscription already has a planned allocation. Remove that allocation before changing its amount or category.' };
  }
  if (collection === 'contributions') {
    const contribution = record as SavingsContribution;
    const oldContribution = data.contributions.find(c => c.id === contribution.id);
    if (oldContribution?.paycheckId && (oldContribution.paycheckId !== contribution.paycheckId || oldContribution.status === 'allocated' && contribution.status !== 'allocated')) return { data, error: 'Edit this goal allocation from its paycheck.' };
    if (!data.goals.some(x => x.id === contribution.goalId)) return { data, error: 'Selected savings goal does not exist.' };
    if (!Number.isSafeInteger(contribution.amountCents) || contribution.amountCents <= 0) return { data, error: 'Contribution must be greater than zero.' };
    if (!validDate(contribution.date)) return { data, error: 'Enter a valid contribution date in YYYY-MM-DD format.' };
    if (contribution.accountId && !data.accounts.some(x => x.id === contribution.accountId)) return { data, error: 'Selected funding account does not exist.' };
    if (contribution.paycheckId) {
      if (!data.paychecks.some(p => p.id === contribution.paycheckId) || contribution.status === 'allocated' && (contribution.accountId || contribution.transactionId) || contribution.status !== 'allocated' && data.paychecks.find(p => p.id === contribution.paycheckId)?.status === 'planned') return { data, error: 'Invalid paycheck goal allocation.' };
      if (allocatedForPaycheck(updated, contribution.paycheckId) > (data.paychecks.find(p => p.id === contribution.paycheckId)?.amountCents ?? 0)) return { data, error: 'Allocations exceed paycheck income.' };
    } else if (contribution.status === 'allocated') return { data, error: 'Goal allocation requires a paycheck.' };
    if (contribution.status && contribution.status !== 'allocated' && !contribution.accountId) return { data, error: 'Choose a funding account for this contribution.' };
    if (contribution.status && data.accounts.find(x => x.id === contribution.accountId)?.type === 'credit_card') return { data, error: 'Savings goals must be funded from a cash or savings account, not credit card debt.' };
    if (contribution.status === 'posted') {
      const linkedTransaction = data.transactions.find(x => x.id === contribution.transactionId);
      if (!linkedTransaction || linkedTransaction.goalContributionId !== contribution.id || linkedTransaction.amountCents !== contribution.amountCents || (linkedTransaction.type === 'transfer' ? ![linkedTransaction.accountId, linkedTransaction.toAccountId].includes(contribution.accountId) : linkedTransaction.accountId !== contribution.accountId) || (linkedTransaction.type !== 'transfer' && linkedTransaction.type !== 'expense')) return { data, error: 'A posted contribution must be linked to its matching historical transaction.' };
    }
    if (goalFundsHeld(updated, contribution) && contribution.accountId) {
      const account = data.accounts.find(x => x.id === contribution.accountId)!;
      if (account.type !== 'credit_card') {
        const otherHolds = committedForAccount(data, account.id, contribution.id);
        const posted = accountBalance(data, account);
        if (contribution.amountCents > posted - otherHolds) return { data, error: 'The funding account does not have enough available balance for this pending amount.' };
      }
    }
    const previous = data.contributions.find(x => x.id === contribution.id);
    if (previous?.transactionId && contribution.transactionId !== previous.transactionId) return { data, error: 'A settled contribution cannot be unlinked from its transaction.' };
    if (previous?.transactionId && (previous.amountCents !== contribution.amountCents || previous.accountId !== contribution.accountId)) return { data, error: 'A contribution linked to a posted transaction cannot change its amount or funding account.' };
    if (contribution.status === 'designated' && contribution.transactionId && !data.transactions.some(t => t.id === contribution.transactionId && t.type === 'transfer' && t.goalContributionId === contribution.id)) return { data, error: 'Saved funds must remain linked to their valid goal move.' };
  }
  if (collection === 'allocations' || collection === 'contributions') {
    const entry = record as BudgetAllocation & SavingsContribution;
    if (entry.paycheckId) updated.paychecks = updated.paychecks.map(p => p.id === entry.paycheckId ? { ...p, allocationHistory: [...(p.allocationHistory ?? []), { id: newId(), date: todayISODate(data.user), description: `${index < 0 ? 'Added' : 'Edited'} ${collection === 'allocations' ? 'category' : 'goal'} allocation: ${entry.amountCents / 100}` }] } : p);
  }
  return { data: updated };
}
function validDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function removeRecord(data: AppData, collection: CollectionName, id: Id): StoreResult {
  if (collection === 'paychecks' && data.contributions.some(x => x.paycheckId === id)) return { data, error: 'Remove this paycheck’s goal allocations first.' };
  if (collection === 'paychecks' && data.allocations.some(x => x.paycheckId === id)) return { data, error: 'This paycheck has allocations. Remove its allocations first.' };
  if (collection === 'paychecks' && data.transactions.some(x => x.paycheckId === id)) return { data, error: 'This paycheck has account moves in its transaction history. Remove those transfers first.' };
  if (collection === 'allocations' && data.transactions.some(x => x.allocationId === id)) return { data, error: 'This allocation has expenses. Reassign or remove them first.' };
  if (collection === 'transactions' && data.allocations.some(x => x.subscriptionId === id)) return { data, error: 'This subscription has a planned paycheck allocation. Remove that allocation first.' };
  if (collection === 'categories' && (data.allocations.some(x => x.categoryId === id) || data.transactions.some(x => x.categoryId === id))) return { data, error: 'This category is in use. Reassign its records first.' };
  if (collection === 'accounts' && data.paychecks.some(x => x.accountId === id || x.remainingAccountId === id)) return { data, error: 'This account has paycheck deposits or remaining paycheck funds. Reassign those paychecks first.' };
  if (collection === 'accounts' && data.transactions.some(x => x.accountId === id || x.toAccountId === id)) return { data, error: 'This account has transaction history. Remove or reassign the transactions first.' };
  if (collection === 'accounts' && data.contributions.some(x => x.accountId === id)) return { data, error: 'This account is funding savings goal contributions. Remove or reassign those contributions first.' };
  if (collection === 'goals' && data.contributions.some(x => x.goalId === id)) return { data, error: 'This goal has contributions. Remove its contributions first.' };
  if (collection === 'contributions' && data.transactions.some(x => x.goalContributionId === id)) return { data, error: 'This contribution is linked to a transaction. Delete or reassign that transaction first.' };
  const next = (data[collection] as Array<{ id: string }>).filter(x => x.id !== id);
  let updated = { ...data, [collection]: next } as AppData;
  if (collection === 'transactions') {
    const removed = data.transactions.find(item => item.id === id);
    if (removed?.goalContributionId) updated = { ...updated, contributions: updated.contributions.map(item => item.id === removed.goalContributionId && item.transactionId === removed.id ? { ...item, accountId: removed.accountId, status: removed.type === 'transfer' ? item.status === 'posted' ? 'designated' : item.status : 'pending', transactionId: undefined } : item) };
    if (removed?.paycheckId && removed.toAccountId) updated = { ...updated, paychecks: updated.paychecks.map(paycheck => paycheck.id === removed.paycheckId && paycheck.remainingAccountId === removed.toAccountId ? { ...paycheck, remainingAccountId: removed.accountId } : paycheck) };
  }
  if (collection === 'allocations' || collection === 'contributions') {
    const removed = (data[collection] as Array<BudgetAllocation | SavingsContribution>).find(item => item.id === id);
    if (removed?.paycheckId) updated.paychecks = updated.paychecks.map(p => p.id === removed.paycheckId ? { ...p, allocationHistory: [...(p.allocationHistory ?? []), { id: newId(), date: todayISODate(data.user), description: `Removed ${collection === 'allocations' ? 'category' : 'goal'} allocation: ${removed.amountCents / 100}` }] } : p);
  }
  if (collection === 'transactions') { const removed = data.transactions.find(t => t.id === id); const error = cashLedgerError(updated,[removed?.accountId,removed?.toAccountId]); if (error) return {data,error}; }
  return { data: updated } as StoreResult;
}

export function completeGoalContributionInAccount(data: AppData, id: Id): StoreResult {
  const contribution = data.contributions.find(c => c.id === id);
  if (!contribution || !goalFundsHeld(data,contribution)) return {data,error:'This goal contribution is no longer available.'};
  if (contribution.status !== 'pending') return {data};
  return upsertRecord(data,'contributions',{...contribution,accountId:goalHoldingAccount(data,contribution),status:'designated'});
}

export function transferGoalContribution(data: AppData, id: Id, transaction: Transaction): StoreResult {
  const contribution = data.contributions.find(c => c.id === id);
  const existing = data.transactions.find(t => t.id === transaction.id);
  if (existing) return existing.goalContributionId === id && existing.type === 'transfer' && existing.accountId === transaction.accountId && existing.toAccountId === transaction.toAccountId && existing.amountCents === transaction.amountCents ? {data} : {data,error:'This transaction identifier is already in use.'};
  if (!contribution || !goalFundsHeld(data,contribution)) return {data,error:'This goal contribution is no longer available.'};
  if (transaction.type !== 'transfer' || transaction.accountId !== goalHoldingAccount(data,contribution) || transaction.amountCents !== contribution.amountCents) return {data,error:'Move the full contribution from the account currently holding it.'};
  if (!transaction.toAccountId || transaction.toAccountId === transaction.accountId || !data.accounts.some(a => a.id === transaction.toAccountId && a.type !== 'credit_card')) return {data,error:'Choose a different cash or savings account.'};
  return upsertRecord(data,'transactions',{...transaction,goalContributionId:id});
}

function periodEnd(period: string) {
  const [year, month] = period.split('-').map(Number);
  return `${year}-${String(month).padStart(2, '0')}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, '0')}`;
}

export function makeRecord<C extends CollectionName>(collection: C, fields: Omit<RecordOf<C>, 'id'>, id: Id): RecordOf<C> {
  return { ...fields, id } as RecordOf<C>;
}

export function receivePlannedPaycheck(data: AppData, id: string, amountCents: number, date: string, accountId: string): StoreResult {
  const paycheck = data.paychecks.find(p => p.id === id);
  if (!paycheck || paycheck.status !== 'planned') return { data, error: 'This paycheck has already been received or is no longer available.' };
  if (!data.accounts.some(a => a.id === accountId && a.type !== 'credit_card')) return { data, error: 'Choose a cash or savings account for your paycheck.' };
  if (allocatedForPaycheck(data, id) > amountCents) return { data, error: 'Adjust your allocations to fit the actual paycheck before receiving it.' };
  return applyPaycheckOperation(data, { type: 'receive', paycheckId: id, amountCents, date, accountId });
}

/** Change the plan in one snapshot; account balances and transactions are untouched. */
export function reallocateBudget(data: AppData, sourceId: string, targetCategoryId: string | undefined, goalId: string | undefined, amountCents: number, contributionId: string, date: string): StoreResult {
  const source = data.allocations.find(a => a.id === sourceId);
  if (!source || !Number.isSafeInteger(amountCents) || amountCents <= 0) return { data, error: 'Choose a source category and a positive amount.' };
  const paycheck = data.paychecks.find(p => p.id === source.paycheckId);
  if (!paycheck || paycheck.budgetArchived || paycheck.status === 'planned') return { data, error: 'Choose a received, active paycheck budget.' };
  if (source.subscriptionId) return { data, error: 'Edit this scheduled bill allocation directly before moving its money.' };
  if (amountCents > source.amountCents - spentForAllocation(data, source.id)) return { data, error: 'Only unspent category money can be moved.' };
  if (Boolean(targetCategoryId) === Boolean(goalId)) return { data, error: 'Choose one destination category or savings goal.' };
  const reduced = upsertRecord(data, 'allocations', { ...source, amountCents: source.amountCents - amountCents });
  if (reduced.error) return { data, error: reduced.error };
  if (goalId) {
    if (data.contributions.some(c => c.id === contributionId)) return { data, error: 'This contribution has already been recorded.' };
    const accountId = paycheck.remainingAccountId ?? paycheck.accountId;
    const result = upsertRecord(reduced.data, 'contributions', { id: contributionId, paycheckId: paycheck.id, goalId, amountCents, date, accountId, status: accountId ? 'pending' : undefined, note: `From ${data.categories.find(c => c.id === source.categoryId)?.name ?? 'budget category'}` });
    return result.error ? { data, error: result.error } : result;
  }
  if (targetCategoryId === source.categoryId) return { data, error: 'Choose a different destination category.' };
  const target = data.allocations.find(a => a.paycheckId === source.paycheckId && a.categoryId === targetCategoryId && !a.subscriptionId);
  const result = upsertRecord(reduced.data, 'allocations', { id: target?.id ?? contributionId, paycheckId: source.paycheckId, categoryId: targetCategoryId!, amountCents: (target?.amountCents ?? 0) + amountCents });
  return result.error ? { data, error: result.error } : result;
}
