export type Id = string;
export type AccountType = 'checking' | 'savings' | 'high_yield_savings' | 'cash' | 'credit_card';
export type TransactionType = 'expense' | 'income' | 'transfer' | 'subscription';
export type SubscriptionFrequency = 'weekly' | 'biweekly' | 'monthly' | 'annual' | 'custom';
export interface InterestRateChange { effectiveDate: string; ratePercent: number }

export type PaydayFrequency = 'monthly' | 'weekly' | 'biweekly' | 'custom';
export interface User {
  id: Id; displayName: string; nextPayday?: string; paydayFrequency?: PaydayFrequency; paydayIntervalDays?: number;
}
/** A paycheck can be kept standalone or linked directly as income to a virtual account. */
export interface Paycheck { status?: 'planned' | 'received'; id: Id; amountCents: number; receivedAt: string; source?: string; notes?: string; accountId?: Id; accountCreditCents?: number; remainingAccountId?: Id; budgetArchived?: boolean }
export interface BudgetCategory { id: Id; name: string }
export interface BudgetAllocation { id: Id; paycheckId: Id; categoryId: Id; amountCents: number; subscriptionId?: Id }
export interface Transaction {
  id: Id; description: string; amountCents: number; date: string; type: TransactionType;
  categoryId?: Id; allocationId?: Id; accountId?: Id; paycheckId?: Id; notes?: string;
  goalContributionId?: Id;
  /** Transfer is represented once and applies opposite signed effects to both accounts. */
  toAccountId?: Id;
  /** A subscription is a scheduled reminder; it does not affect balances until its charge is logged as an expense. */
  subscriptionFrequency?: SubscriptionFrequency;
  subscriptionIntervalDays?: number;
  nextDueDate?: string;
  /** System-posted month-end interest, distinct from user-entered activity. */
  interestPosting?: 'savings_credit' | 'credit_card_charge';
  interestPeriodKey?: string;
}
export interface VirtualAccount {
  id: Id; name: string; type: AccountType; initialBalanceCents: number;
  /** Savings APY or credit card APR, stored as a percentage. */ interestRatePercent?: number;
  /** Effective-dated rates preserve accrued history when a user changes a rate. */ interestRateHistory?: InterestRateChange[];
  /** First date from which this account's balance can accrue simulated interest. */ interestStartDate?: string;
  notes?: string;
}
export interface SavingsGoal { id: Id; name: string; targetCents: number; initialSavedCents: number; targetDate?: string }
export interface SavingsContribution { paycheckId?: Id; id: Id; goalId: Id; amountCents: number; date: string; note?: string; accountId?: Id; status?: 'pending' | 'designated' | 'posted'; transactionId?: Id }
export interface AppData {
  version: 2; user: User; paychecks: Paycheck[]; categories: BudgetCategory[]; allocations: BudgetAllocation[];
  transactions: Transaction[]; accounts: VirtualAccount[]; goals: SavingsGoal[]; contributions: SavingsContribution[];
}

export const emptyData = (): AppData => ({
  version: 2, user: { id: 'local-user', displayName: 'Local user' }, paychecks: [], categories: [],
  allocations: [], transactions: [], accounts: [], goals: [], contributions: [],
});

export const newId = (): Id => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
