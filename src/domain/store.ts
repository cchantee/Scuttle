import { AppData, BudgetAllocation, BudgetCategory, Id, Paycheck, SavingsContribution, SavingsGoal, Transaction, VirtualAccount } from './models';
import { validateAllocation, validateTransaction } from './calculations';

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
    if (!Number.isSafeInteger(p.amountCents) || p.amountCents <= 0) return { data, error: 'Paycheck amount must be greater than zero.' };
    if (!validDate(p.receivedAt)) return { data, error: 'Enter a valid paycheck date in YYYY-MM-DD format.' };
  }
  if (collection === 'categories' && !(record as BudgetCategory).name.trim()) return { data, error: 'Category name is required.' };
  if (collection === 'accounts') {
    const account = record as VirtualAccount;
    if (!account.name.trim()) return { data, error: 'Account name is required.' };
    if (!Number.isSafeInteger(account.initialBalanceCents) || account.initialBalanceCents < 0) return { data, error: 'Starting balance must be a non-negative amount.' };
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
    const error = validateTransaction(updated, tx);
    if (error) return { data, error };
  }
  if (collection === 'contributions') {
    const contribution = record as SavingsContribution;
    if (!data.goals.some(x => x.id === contribution.goalId)) return { data, error: 'Selected savings goal does not exist.' };
    if (!Number.isSafeInteger(contribution.amountCents) || contribution.amountCents <= 0) return { data, error: 'Contribution must be greater than zero.' };
    if (!validDate(contribution.date)) return { data, error: 'Enter a valid contribution date in YYYY-MM-DD format.' };
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
  if (collection === 'paychecks' && data.allocations.some(x => x.paycheckId === id)) return { data, error: 'This paycheck has allocations. Remove its allocations first.' };
  if (collection === 'allocations' && data.transactions.some(x => x.allocationId === id)) return { data, error: 'This allocation has expenses. Reassign or remove them first.' };
  if (collection === 'categories' && (data.allocations.some(x => x.categoryId === id) || data.transactions.some(x => x.categoryId === id))) return { data, error: 'This category is in use. Reassign its records first.' };
  if (collection === 'accounts' && data.transactions.some(x => x.accountId === id || x.toAccountId === id)) return { data, error: 'This account has transaction history. Remove or reassign the transactions first.' };
  if (collection === 'goals' && data.contributions.some(x => x.goalId === id)) return { data, error: 'This goal has contributions. Remove its contributions first.' };
  const next = (data[collection] as Array<{ id: string }>).filter(x => x.id !== id);
  return { data: { ...data, [collection]: next } } as StoreResult;
}

export function makeRecord<C extends CollectionName>(collection: C, fields: Omit<RecordOf<C>, 'id'>, id: Id): RecordOf<C> {
  return { ...fields, id } as RecordOf<C>;
}
