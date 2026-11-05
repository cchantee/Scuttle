import { AppData, BudgetAllocation, BudgetCategory, Id, Paycheck, SavingsContribution, SavingsGoal, Transaction, VirtualAccount } from './models';
import { accountBalance, allocatedForPaycheck, spentForAllocation, validateAllocation, validateTransaction } from './calculations';
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
    if (p.status && p.status !== 'planned' && p.status !== 'received') return { data, error: 'Choose a valid paycheck status.' };
    if (p.status === 'planned' && (p.accountId || p.remainingAccountId || p.accountCreditCents)) return { data, error: 'Planned income cannot be deposited before it is received.' };
    const previous = data.paychecks.find(item => item.id === p.id);
    if (previous && previous.status !== 'planned' && p.status === 'planned') return { data, error: 'A received paycheck cannot become planned income.' };
    if (!Number.isSafeInteger(p.amountCents) || p.amountCents <= 0) return { data, error: 'Paycheck amount must be greater than zero.' };
    if (!validDate(p.receivedAt)) return { data, error: 'Enter a valid paycheck date in YYYY-MM-DD format.' };
    if (p.accountId && !updated.accounts.some(account => account.id === p.accountId)) return { data, error: 'The selected deposit account does not exist.' };
    if (p.remainingAccountId && !updated.accounts.some(account => account.id === p.remainingAccountId)) return { data, error: 'The account holding the remaining paycheck funds does not exist.' };
    if (p.accountCreditCents !== undefined && (!Number.isSafeInteger(p.accountCreditCents) || p.accountCreditCents < 0)) return { data, error: 'Paycheck account credit must be a non-negative amount.' };
  }
  if (collection === 'categories' && !(record as BudgetCategory).name.trim()) return { data, error: 'Category name is required.' };
  if (collection === 'accounts') {
    const supplied = record as VirtualAccount;
    const previous = data.accounts.find(item => item.id === supplied.id);
    const rate = supplied.interestRatePercent ?? 0;
    const today = todayISODate();
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
      const activeAllocation = updated.allocations
        .filter(item => item.categoryId === tx.categoryId && !updated.paychecks.find(paycheck => paycheck.id === item.paycheckId)?.budgetArchived && updated.paychecks.find(paycheck => paycheck.id === item.paycheckId)?.status !== 'planned')
        .sort((a, b) => (updated.paychecks.find(p => p.id === b.paycheckId)?.receivedAt ?? '').localeCompare(updated.paychecks.find(p => p.id === a.paycheckId)?.receivedAt ?? ''))[0];
      const allocation = previousAllocation ?? activeAllocation;
      if (allocation) tx = { ...tx, allocationId: allocation.id };
    }
    updated.transactions = updated.transactions.map(item => item.id === tx.id ? tx : item);
    const error = validateTransaction(updated, tx);
    if (error) return { data, error };
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
    if (contribution.paycheckId && !data.paychecks.some(p => p.id === contribution.paycheckId)) return { data, error: 'The funding paycheck does not exist.' };
    if (contribution.paycheckId && data.paychecks.find(p => p.id === contribution.paycheckId)?.status === 'planned') return { data, error: 'Receive the paycheck before contributing its money to a goal.' };
    if (contribution.paycheckId && allocatedForPaycheck(updated, contribution.paycheckId) > updated.paychecks.find(p => p.id === contribution.paycheckId)!.amountCents) return { data, error: 'This goal amount exceeds the paycheck left to assign.' };
    if (!data.goals.some(x => x.id === contribution.goalId)) return { data, error: 'Selected savings goal does not exist.' };
    if (!Number.isSafeInteger(contribution.amountCents) || contribution.amountCents <= 0) return { data, error: 'Contribution must be greater than zero.' };
    if (!validDate(contribution.date)) return { data, error: 'Enter a valid contribution date in YYYY-MM-DD format.' };
    if (contribution.accountId && !data.accounts.some(x => x.id === contribution.accountId)) return { data, error: 'Selected funding account does not exist.' };
    if (contribution.status && !contribution.accountId) return { data, error: 'Choose a funding account for this contribution.' };
    if (contribution.status && data.accounts.find(x => x.id === contribution.accountId)?.type === 'credit_card') return { data, error: 'Savings goals must be funded from a cash or savings account, not credit card debt.' };
    if (contribution.status === 'posted') {
      const linkedTransaction = data.transactions.find(x => x.id === contribution.transactionId);
      if (!linkedTransaction || linkedTransaction.goalContributionId !== contribution.id || linkedTransaction.amountCents !== contribution.amountCents || linkedTransaction.accountId !== contribution.accountId || (linkedTransaction.type !== 'transfer' && linkedTransaction.type !== 'expense')) return { data, error: 'A posted contribution must be linked to its matching historical transaction.' };
    }
    if (contribution.status === 'pending' && contribution.accountId) {
      const account = data.accounts.find(x => x.id === contribution.accountId)!;
      if (account.type !== 'credit_card') {
        const otherHolds = data.contributions.filter(x => x.accountId === account.id && x.status === 'pending' && x.id !== contribution.id).reduce((sum, x) => sum + x.amountCents, 0);
        const posted = accountBalance(data, account);
        if (contribution.amountCents > posted - otherHolds) return { data, error: 'The funding account does not have enough available balance for this pending amount.' };
      }
    }
    const previous = data.contributions.find(x => x.id === contribution.id);
    if (previous?.transactionId && contribution.transactionId !== previous.transactionId) return { data, error: 'A settled contribution cannot be unlinked from its transaction.' };
    if (previous?.transactionId && (previous.amountCents !== contribution.amountCents || previous.accountId !== contribution.accountId)) return { data, error: 'A contribution linked to a posted transaction cannot change its amount or funding account.' };
    if (contribution.status === 'designated' && contribution.transactionId) return { data, error: 'A completed same-account designation cannot have a transfer transaction.' };
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
  if (collection === 'paychecks' && data.contributions.some(x => x.paycheckId === id)) return { data, error: 'This paycheck funds savings contributions. Remove or reassign them first.' };
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
    if (removed?.goalContributionId) updated = { ...updated, contributions: updated.contributions.map(item => item.id === removed.goalContributionId ? { ...item, status: 'pending', transactionId: undefined } : item) };
    if (removed?.paycheckId && removed.toAccountId) updated = { ...updated, paychecks: updated.paychecks.map(paycheck => paycheck.id === removed.paycheckId && paycheck.remainingAccountId === removed.toAccountId ? { ...paycheck, remainingAccountId: removed.accountId } : paycheck) };
  }
  return { data: updated } as StoreResult;
}

export function completeGoalContributionInAccount(data: AppData, id: Id): StoreResult {
  const contribution = data.contributions.find(item => item.id === id);
  if (!contribution || contribution.status !== 'pending') return { data, error: 'This contribution is no longer pending.' };
  return upsertRecord(data, 'contributions', { ...contribution, status: 'designated' });
}

export function transferGoalContribution(data: AppData, id: Id, transaction: Transaction): StoreResult {
  const contribution = data.contributions.find(item => item.id === id);
  if (!contribution || contribution.status !== 'pending') return { data, error: 'This contribution is no longer pending.' };
  if (transaction.type !== 'transfer' || transaction.accountId !== contribution.accountId || transaction.amountCents !== contribution.amountCents) return { data, error: 'Transfer amount and source account must match the pending contribution.' };
  const txResult = upsertRecord(data, 'transactions', { ...transaction, goalContributionId: contribution.id });
  if (txResult.error) return txResult;
  return upsertRecord(txResult.data, 'contributions', { ...contribution, status: 'posted', transactionId: transaction.id });
}

function periodEnd(period: string) {
  const [year, month] = period.split('-').map(Number);
  return `${year}-${String(month).padStart(2, '0')}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, '0')}`;
}

export function makeRecord<C extends CollectionName>(collection: C, fields: Omit<RecordOf<C>, 'id'>, id: Id): RecordOf<C> {
  return { ...fields, id } as RecordOf<C>;
}


/** Receive a plan once, preserving category assignments without a duplicate income event. */
export function receivePlannedPaycheck(data: AppData, id: string, amountCents: number, date: string, accountId: string): StoreResult {
  const paycheck = data.paychecks.find(p => p.id === id);
  if (!paycheck || paycheck.status !== 'planned') return { data, error: 'This paycheck has already been received or is no longer available.' };
  if (!data.accounts.some(a => a.id === accountId && a.type !== 'credit_card')) return { data, error: 'Choose a cash or savings account for your paycheck.' };
  if (allocatedForPaycheck(data, id) > amountCents) return { data, error: 'Adjust your allocations to fit the actual paycheck before receiving it.' };
  return upsertRecord(data, 'paychecks', { ...paycheck, status: 'received', amountCents, receivedAt: date, accountId, accountCreditCents: amountCents, remainingAccountId: accountId });
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
