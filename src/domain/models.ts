export type Id = string;
export type AccountType = 'checking' | 'savings' | 'high_yield_savings' | 'cash' | 'credit_card';
export type TransactionType = 'expense' | 'income' | 'transfer';

export interface User { id: Id; displayName: string }
export interface Paycheck { id: Id; amountCents: number; receivedAt: string; source?: string; notes?: string }
export interface BudgetCategory { id: Id; name: string }
export interface BudgetAllocation { id: Id; paycheckId: Id; categoryId: Id; amountCents: number }
export interface Transaction {
  id: Id; description: string; amountCents: number; date: string; type: TransactionType;
  categoryId?: Id; allocationId?: Id; accountId?: Id; notes?: string;
  /** Transfer is represented once and applies opposite signed effects to both accounts. */
  toAccountId?: Id;
}
export interface VirtualAccount { id: Id; name: string; type: AccountType; initialBalanceCents: number; notes?: string }
export interface SavingsGoal { id: Id; name: string; targetCents: number; initialSavedCents: number; targetDate?: string }
export interface SavingsContribution { id: Id; goalId: Id; amountCents: number; date: string; note?: string }
export interface AppData {
  version: 1; user: User; paychecks: Paycheck[]; categories: BudgetCategory[]; allocations: BudgetAllocation[];
  transactions: Transaction[]; accounts: VirtualAccount[]; goals: SavingsGoal[]; contributions: SavingsContribution[];
}

export const emptyData = (): AppData => ({
  version: 1, user: { id: 'local-user', displayName: 'Local user' }, paychecks: [], categories: [],
  allocations: [], transactions: [], accounts: [], goals: [], contributions: [],
});

export const newId = (): Id => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
