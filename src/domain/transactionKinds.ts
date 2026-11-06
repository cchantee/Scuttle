import { AppData, Transaction, TransactionType } from './models';
export type TransactionFormKind = TransactionType | 'bill';
export function isBill(data: AppData, transaction: Transaction): boolean {
  if (transaction.purpose === 'bill') return true;
  const category = data.categories.find(c => c.id === transaction.categoryId)?.name ?? '';
  return (transaction.type === 'expense' || transaction.type === 'subscription') && /rent|utilities|insurance|phone|electric|water/i.test(category);
}
export function transactionKind(data: AppData, transaction: Transaction): TransactionFormKind {
  return isBill(data, transaction) ? 'bill' : transaction.type;
}
export function ledgerType(kind: TransactionFormKind, scheduledBill: boolean): TransactionType {
  return kind === 'bill' ? scheduledBill ? 'subscription' : 'expense' : kind;
}
export function transactionTypeLabel(data: AppData, transaction: Transaction): string {
  if (isBill(data, transaction)) return transaction.type === 'subscription' ? 'Scheduled bill' : 'Bill payment';
  return transaction.type === 'subscription' ? 'Subscription reminder' : transaction.type === 'transfer' ? 'Transfer' : transaction.type === 'income' ? 'Income' : 'Expense';
}

/** A paid record is separate from its neutral reminder and uses that reminder's active allocation. */
export function billPaymentDraft(data: AppData, reminder: Transaction, date: string): Omit<Transaction, 'id'> {
  if (reminder.type !== 'subscription') throw new Error('Choose a scheduled bill to record its payment.');
  const allocation = data.allocations.filter(a => a.subscriptionId === reminder.id && data.paychecks.some(p => p.id === a.paycheckId && p.status !== 'planned' && !p.budgetArchived))
    .sort((a,b) => (data.paychecks.find(p => p.id === b.paycheckId)?.receivedAt ?? '').localeCompare(data.paychecks.find(p => p.id === a.paycheckId)?.receivedAt ?? ''))[0];
  return { type: 'expense', purpose: 'bill', description: reminder.description, amountCents: reminder.amountCents, date, categoryId: reminder.categoryId, allocationId: allocation?.id, accountId: reminder.accountId, notes: reminder.notes };
}
