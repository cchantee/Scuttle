import { AppData } from './models';
import { todayISODate } from './date';
import { CollectionName, StoreResult, upsertRecord } from './store';

const samplePrefix = 'sample:';

export function hasSampleData(data: AppData): boolean {
  return (['paychecks', 'categories', 'allocations', 'transactions', 'accounts', 'goals', 'contributions'] as CollectionName[])
    .some(collection => (data[collection] as { id: string }[]).some(record => record.id.startsWith(samplePrefix)));
}

/** Append one connected, visibly labeled sample scenario without replacing user records. */
export function addSampleData(data: AppData, today = todayISODate()): StoreResult {
  if (hasSampleData(data)) return { data, error: 'Sample records have already been added to this account.' };
  let next = data;
  const add = (collection: CollectionName, record: { id: string }): string | undefined => {
    const result = upsertRecord(next, collection, record as never);
    if (result.error) return result.error;
    next = result.data;
    return undefined;
  };
  const id = (name: string) => `${samplePrefix}${name}`;
  const report = (error?: string): StoreResult => error ? { data, error: `Sample data could not be added: ${error}` } : { data: next };

  const accountRecords = [
    { id: id('checking'), name: 'Sample Checking', type: 'checking' as const, initialBalanceCents: 135000 },
    { id: id('savings'), name: 'Sample High-Yield Savings', type: 'high_yield_savings' as const, initialBalanceCents: 120000, interestRatePercent: 3.75 },
    { id: id('cash'), name: 'Sample Cash', type: 'cash' as const, initialBalanceCents: 15000 },
    { id: id('card'), name: 'Sample Credit Card', type: 'credit_card' as const, initialBalanceCents: 28500, interestRatePercent: 18.99 },
  ];
  for (const record of accountRecords) { const error = add('accounts', record); if (error) return report(error); }

  const categories = [
    { id: id('category-housing'), name: 'Sample Housing' },
    { id: id('category-groceries'), name: 'Sample Groceries' },
    { id: id('category-gas'), name: 'Sample Gas' },
    { id: id('category-fun'), name: 'Sample Fun Money' },
    { id: id('category-emergency'), name: 'Sample Emergency Fund' },
    { id: id('category-subscriptions'), name: 'Sample Subscriptions' },
  ];
  for (const record of categories) { const error = add('categories', record); if (error) return report(error); }

  const goals = [
    { id: id('goal-vacation'), name: 'Sample Vacation', targetCents: 200000, initialSavedCents: 50000 },
    { id: id('goal-car'), name: 'Sample Car Repair', targetCents: 80000, initialSavedCents: 10000 },
  ];
  for (const record of goals) { const error = add('goals', record); if (error) return report(error); }

  const received = (daysAgo: number) => shiftDate(today, -daysAgo);
  const paychecks = [
    { id: id('paycheck-older'), amountCents: 152000, receivedAt: received(18), source: 'Sample Employer', accountId: id('checking'), accountCreditCents: 152000, remainingAccountId: id('checking'), budgetArchived: true },
    { id: id('paycheck-current'), amountCents: 184200, receivedAt: received(4), source: 'Sample Employer', accountId: id('checking'), accountCreditCents: 184200, remainingAccountId: id('checking') },
  ];
  for (const record of paychecks) { const error = add('paychecks', record); if (error) return report(error); }

  const subscription = {
    id: id('subscription-streaming'), description: 'Sample Streaming Subscription', amountCents: 1599,
    date: received(4), type: 'subscription' as const, categoryId: id('category-subscriptions'), accountId: id('checking'),
    subscriptionFrequency: 'monthly' as const, nextDueDate: shiftDate(today, 5), notes: 'Sample recurring bill reminder',
  };
  const errorSubscription = add('transactions', subscription);
  if (errorSubscription) return report(errorSubscription);

  const allocations = [
    { id: id('allocation-older-housing'), paycheckId: id('paycheck-older'), categoryId: id('category-housing'), amountCents: 65000 },
    { id: id('allocation-housing'), paycheckId: id('paycheck-current'), categoryId: id('category-housing'), amountCents: 65000 },
    { id: id('allocation-groceries'), paycheckId: id('paycheck-current'), categoryId: id('category-groceries'), amountCents: 25000 },
    { id: id('allocation-gas'), paycheckId: id('paycheck-current'), categoryId: id('category-gas'), amountCents: 8000 },
    { id: id('allocation-fun'), paycheckId: id('paycheck-current'), categoryId: id('category-fun'), amountCents: 10000 },
    { id: id('allocation-emergency'), paycheckId: id('paycheck-current'), categoryId: id('category-emergency'), amountCents: 20000 },
    { id: id('allocation-subscription'), paycheckId: id('paycheck-current'), categoryId: id('category-subscriptions'), amountCents: 1599, subscriptionId: subscription.id },
  ];
  for (const record of allocations) { const error = add('allocations', record); if (error) return report(error); }

  const transactions = [
    { id: id('expense-housing'), description: 'Sample Rent Payment', amountCents: 65000, date: received(17), type: 'expense' as const, categoryId: id('category-housing'), allocationId: id('allocation-older-housing'), accountId: id('checking') },
    { id: id('expense-groceries'), description: 'Sample Grocery Store', amountCents: 6300, date: received(2), type: 'expense' as const, categoryId: id('category-groceries'), allocationId: id('allocation-groceries'), accountId: id('checking') },
    { id: id('expense-gas'), description: 'Sample Fuel', amountCents: 3000, date: received(1), type: 'expense' as const, categoryId: id('category-gas'), allocationId: id('allocation-gas'), accountId: id('checking') },
    { id: id('expense-coffee'), description: 'Sample Coffee', amountCents: 750, date: received(1), type: 'expense' as const, accountId: id('cash') },
    { id: id('expense-card'), description: 'Sample Card Purchase', amountCents: 4599, date: received(1), type: 'expense' as const, accountId: id('card') },
  ];
  for (const record of transactions) { const error = add('transactions', record); if (error) return report(error); }

  const contributions = [
    { id: id('contribution-vacation'), goalId: id('goal-vacation'), amountCents: 35000, date: received(3), note: 'Sample completed contribution', accountId: id('savings'), status: 'designated' as const },
    { id: id('contribution-car-pending'), goalId: id('goal-car'), amountCents: 15000, date: received(1), note: 'Sample pending reservation', accountId: id('checking'), status: 'pending' as const },
  ];
  for (const record of contributions) { const error = add('contributions', record); if (error) return report(error); }

  // Adding demonstration records must not archive the user's existing budgets.
  next.paychecks = next.paychecks.map(p => data.paychecks.find(original => original.id === p.id) ?? p);
  return { data: next };
}

/** Remove sample fixtures atomically, preserving normal records that depend on them. */
export function removeSampleData(data: AppData): StoreResult {
  if (!hasSampleData(data)) return { data, error: 'There is no sample data to delete.' };
  const isSample = (id?: string) => Boolean(id?.startsWith(samplePrefix));
  const externalPaycheck = data.paychecks.find(item => !isSample(item.id) && (isSample(item.accountId) || isSample(item.remainingAccountId)));
  if (externalPaycheck) return { data, error: 'Cannot delete sample data: a regular paycheck uses a sample account. Move that paycheck to one of your own accounts first.' };
  const externalAllocation = data.allocations.find(item => !isSample(item.id) && (isSample(item.paycheckId) || isSample(item.categoryId) || isSample(item.subscriptionId)));
  if (externalAllocation) return { data, error: 'Cannot delete sample data: a regular budget allocation uses a sample paycheck, category, or subscription. Reassign or remove that allocation first.' };
  const externalTransaction = data.transactions.find(item => !isSample(item.id) && (
    isSample(item.categoryId) || isSample(item.allocationId) || isSample(item.accountId) || isSample(item.toAccountId)
    || isSample(item.paycheckId) || isSample(item.goalContributionId)
  ));
  if (externalTransaction) return { data, error: 'Cannot delete sample data: a regular transaction uses a sample record. Reassign or delete that transaction first.' };
  const externalContribution = data.contributions.find(item => !isSample(item.id) && (
    isSample(item.goalId) || isSample(item.accountId) || isSample(item.transactionId)
  ));
  if (externalContribution) return { data, error: 'Cannot delete sample data: a regular savings contribution uses a sample record. Reassign or delete that contribution first.' };

  const withoutSamples = <T extends { id: string }>(records: T[]) => records.filter(item => !isSample(item.id));
  return {
    data: {
      ...data,
      paychecks: withoutSamples(data.paychecks),
      categories: withoutSamples(data.categories),
      allocations: withoutSamples(data.allocations),
      transactions: withoutSamples(data.transactions),
      accounts: withoutSamples(data.accounts),
      goals: withoutSamples(data.goals),
      contributions: withoutSamples(data.contributions),
    },
  };
}

function shiftDate(date: string, amount: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + amount));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}
