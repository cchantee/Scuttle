import { describe, expect, it } from 'vitest';
import { accountBalance, cashAccountSummary, nextSubscriptionDue, savingsGoalSummary, validateTransaction } from './calculations';
import { AppData, emptyData, Transaction } from './models';
import { removeRecord, upsertRecord } from './store';

function baseData(): AppData {
  const data = emptyData();
  data.paychecks = [{ id: 'p', amountCents: 120000, receivedAt: '2026-10-01' }];
  data.categories = [{ id: 'food', name: 'Food' }];
  data.allocations = [{ id: 'al', paycheckId: 'p', categoryId: 'food', amountCents: 30000 }];
  data.accounts = [
    { id: 'checking', name: 'Checking', type: 'checking', initialBalanceCents: 200000 },
    { id: 'savings', name: 'Savings', type: 'savings', initialBalanceCents: 50000 },
    { id: 'card', name: 'Card', type: 'credit_card', initialBalanceCents: 40000 },
  ];
  data.goals = [
    { id: 'trip', name: 'Trip', targetCents: 100000, initialSavedCents: 10000 },
    { id: 'car', name: 'Car', targetCents: 100000, initialSavedCents: 0 },
  ];
  return data;
}

describe('Scuttle backend QA persona: record validation and integrity', () => {
  it('rejects invalid paycheck amounts, impossible dates, and missing accounts', () => {
    const data = baseData();
    expect(upsertRecord(data, 'paychecks', { id: 'bad', amountCents: 0, receivedAt: '2026-10-01' }).error).toMatch(/greater than zero/);
    expect(upsertRecord(data, 'paychecks', { id: 'bad', amountCents: 100, receivedAt: '2026-02-30' }).error).toMatch(/valid paycheck date/);
    expect(upsertRecord(data, 'paychecks', { id: 'bad', amountCents: 100, receivedAt: '2026-10-01', accountId: 'missing' }).error).toMatch(/deposit account/);
  });

  it('rejects blank names and invalid allocation references or amounts', () => {
    const data = baseData();
    expect(upsertRecord(data, 'categories', { id: 'blank', name: '  ' }).error).toMatch(/required/);
    expect(upsertRecord(data, 'allocations', { id: 'bad', paycheckId: 'missing', categoryId: 'food', amountCents: 100 }).error).toMatch(/paycheck/);
    expect(upsertRecord(data, 'allocations', { id: 'bad', paycheckId: 'p', categoryId: 'food', amountCents: -1 }).error).toMatch(/non-negative/);
    expect(upsertRecord(data, 'goals', { id: 'bad', name: 'Trip', targetCents: 0, initialSavedCents: 0 }).error).toMatch(/greater than zero/);
  });

  it('validates subscription schedules, keeps reminders out of balances, and blocks duplicate paycheck plans', () => {
    const data = baseData();
    const subscription: Transaction = {
      id: 'streaming', description: 'Streaming', amountCents: 1599, date: '2026-10-01', type: 'subscription',
      categoryId: 'food', subscriptionFrequency: 'monthly', nextDueDate: '2026-10-18', accountId: 'checking',
    };
    expect(validateTransaction(data, { ...subscription, nextDueDate: '2026-02-30' })).toMatch(/next charge date/);
    const saved = upsertRecord(data, 'transactions', subscription);
    expect(saved.error).toBeUndefined();
    expect(accountBalance(saved.data, saved.data.accounts[0])).toBe(200000);
    const planned = upsertRecord(saved.data, 'allocations', { id: 'sub-plan', paycheckId: 'p', categoryId: 'food', amountCents: 1599, subscriptionId: 'streaming' });
    expect(planned.error).toBeUndefined();
    expect(upsertRecord(planned.data, 'allocations', { id: 'duplicate-plan', paycheckId: 'p', categoryId: 'food', amountCents: 1599, subscriptionId: 'streaming' }).error).toMatch(/already planned/);
    expect(upsertRecord(planned.data, 'transactions', { ...subscription, amountCents: 1700 }).error).toMatch(/planned allocation/);
    expect(nextSubscriptionDue(subscription, '2026-10-19')).toBe('2026-11-18');
  });

  it('keeps savings goal savings separate from account balances and excludes pending holds from settled progress', () => {
    const data = baseData();
    data.contributions = [
      { id: 'posted', goalId: 'trip', amountCents: 20000, date: '2026-10-01', status: 'designated', accountId: 'savings' },
      { id: 'pending', goalId: 'car', amountCents: 40000, date: '2026-10-02', status: 'pending', accountId: 'checking' },
    ];
    const before = data.accounts.map(account => accountBalance(data, account));
    const summary = savingsGoalSummary(data);
    expect(summary).toEqual({ savedCents: 30000, targetCents: 200000, progressPercent: 15 });
    expect(data.accounts.map(account => accountBalance(data, account))).toEqual(before);
    expect(cashAccountSummary(data)).toEqual({ totalCashCents: 250000, availableCashCents: 190000, creditCardDebtCents: 40000 });
  });

  it('blocks deletion of accounts, goals, and contributions with dependent history', () => {
    const data = baseData();
    data.contributions = [{ id: 'pending', goalId: 'trip', amountCents: 1000, date: '2026-10-02', status: 'pending', accountId: 'checking' }];
    data.transactions = [{ id: 'expense', description: 'Groceries', amountCents: 500, date: '2026-10-02', type: 'expense', allocationId: 'al', accountId: 'checking' }];
    expect(removeRecord(data, 'accounts', 'checking').error).toMatch(/transaction history/);
    expect(removeRecord(data, 'goals', 'trip').error).toMatch(/contributions/);
    expect(removeRecord(data, 'allocations', 'al').error).toMatch(/expenses/);
    expect(removeRecord(data, 'paychecks', 'p').error).toMatch(/allocations/);
    expect(removeRecord(data, 'categories', 'food').error).toMatch(/in use/);
  });
});
