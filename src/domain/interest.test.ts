import { describe, expect, it } from 'vitest';
import { accountBalance, availableAccountBalance, pendingForAccount } from './calculations';
import { accrueBetween, accruedInterestCents, interestDailyRate, nextInterestPostingPreview, nextInterestPostingTransaction } from './interest';
import { AppData, emptyData, VirtualAccount } from './models';
import { removeRecord, upsertRecord } from './store';
import { todayISODate } from './date';

function account(type: VirtualAccount['type'], rate: number, start = '2025-01-01'): VirtualAccount {
  return { id: 'a', name: 'Account', type, initialBalanceCents: 100000, interestRatePercent: rate,
    interestStartDate: start, interestRateHistory: [{ effectiveDate: start, ratePercent: rate }] };
}

describe('interest simulation', () => {
  it('uses effective APY for savings and high-yield savings with a fixed 365-day year', () => {
    const data = emptyData();
    const savings = account('savings', 100);
    const highYield = { ...account('high_yield_savings', 3.75), id: 'hy' };
    expect(accrueBetween(data, savings, '2025-01-01', '2025-12-31')).toBeCloseTo(100000, 4);
    expect(accrueBetween(data, highYield, '2025-01-01', '2025-12-31')).toBeCloseTo(3750, 4);
    expect(interestDailyRate(savings, '2025-01-01')).toBeCloseTo(Math.pow(2, 1 / 365) - 1, 12);
  });

  it('estimates credit card daily interest using APR divided by 365', () => {
    const card = account('credit_card', 36.5);
    expect(interestDailyRate(card, '2025-01-01')).toBeCloseTo(0.001, 12);
    expect(accrueBetween(emptyData(), card, '2025-01-01', '2025-01-01')).toBeCloseTo(100, 10);
  });

  it('handles zero rates and effective-dated rate changes', () => {
    const data = emptyData();
    const zero = account('savings', 0);
    const changed = { ...account('savings', 36.5), interestRatePercent: 36.5, interestRateHistory: [
      { effectiveDate: '2025-01-01', ratePercent: 0 }, { effectiveDate: '2025-01-02', ratePercent: 36.5 },
    ] };
    expect(accrueBetween(data, zero, '2025-01-01', '2025-12-31')).toBe(0);
    expect(accrueBetween(data, changed, '2025-01-01', '2025-01-02')).toBeCloseTo(100000 * (Math.pow(1 + 0.365, 1 / 365) - 1), 10);
  });

  it('uses each end-of-day balance when multiple transactions occur in the same period', () => {
    const data = emptyData();
    const savings = account('savings', 44.025788);
    data.accounts = [savings];
    data.transactions = [
      { id: 'one', description: 'First purchase', amountCents: 50000, date: '2025-01-10', type: 'expense', accountId: 'a' },
      { id: 'two', description: 'Second purchase', amountCents: 10000, date: '2025-01-20', type: 'expense', accountId: 'a' },
    ];
    let expected = 0;
    for (let day = 1; day <= 31; day++) {
      const balance = day < 10 ? 100000 : day < 20 ? 50000 : 40000;
      expected += (balance + expected) * interestDailyRate(savings, `2025-01-${String(day).padStart(2, '0')}`);
    }
    expect(accrueBetween(data, savings, '2025-01-01', '2025-01-31')).toBeCloseTo(expected, 8);
  });

  it('calculates completed-month interest and prevents duplicate postings', () => {
    const data = emptyData();
    const savings = account('savings', 36.5, '2026-09-01');
    data.accounts = [savings];
    const preview = nextInterestPostingPreview(data, savings, '2026-10-27');
    expect(preview?.periodKey).toBe('2026-09');
    expect(preview?.periodEnd).toBe('2026-09-30');
    expect(preview?.amountCents).toBeGreaterThan(0);
    const posting = nextInterestPostingTransaction(data, savings, '2026-10-27', 'interest-sep');
    expect(posting?.type).toBe('income');
    const saved = upsertRecord(data, 'transactions', posting!);
    expect(saved.error).toBeUndefined();
    expect(accountBalance(saved.data, savings)).toBe(100000 + preview!.amountCents);
    const duplicate = upsertRecord(saved.data, 'transactions', { ...posting!, id: 'duplicate' });
    expect(duplicate.error).toMatch(/already been posted/);
    expect(nextInterestPostingPreview(saved.data, savings, '2026-10-27')).toBeNull();
  });

  it('accrues on held funds while showing pending, actual, and available balances separately', () => {
    const data = emptyData();
    const savings = account('savings', 36.5);
    data.accounts = [savings];
    data.goals = [{ id: 'g', name: 'Goal', targetCents: 100000, initialSavedCents: 0 }];
    const result = upsertRecord(data, 'contributions', { id: 'c', goalId: 'g', amountCents: 20000, date: '2025-01-01', accountId: 'a', status: 'pending' });
    expect(result.error).toBeUndefined();
    expect(accountBalance(result.data, savings)).toBe(100000);
    expect(pendingForAccount(result.data, 'a')).toBe(20000);
    expect(availableAccountBalance(result.data, savings)).toBe(80000);
    expect(accruedInterestCents(result.data, savings, '2025-01-01')).toBeCloseTo(100000 * (Math.pow(1 + 0.365, 1 / 365) - 1), 10);
  });

  it('preserves previous rates when the user changes an account rate', () => {
    const data = emptyData();
    const original = account('high_yield_savings', 0.5);
    data.accounts = [original];
    const result = upsertRecord(data, 'accounts', { ...original, interestRatePercent: 3.75 });
    expect(result.error).toBeUndefined();
    const updated = result.data.accounts[0];
    expect(updated.interestRatePercent).toBe(3.75);
    expect(updated.interestRateHistory).toContainEqual({ effectiveDate: '2025-01-01', ratePercent: 0.5 });
    expect(updated.interestRateHistory).toContainEqual({ effectiveDate: todayISODate(), ratePercent: 3.75 });
  });
});

describe('savings goal reservation lifecycle', () => {
  function setup(): AppData {
    const data = emptyData();
    data.accounts = [
      { id: 'checking', name: 'Checking', type: 'checking', initialBalanceCents: 100000 },
      { id: 'savings', name: 'Savings', type: 'savings', initialBalanceCents: 0 },
    ];
    data.goals = [{ id: 'g', name: 'Goal', targetCents: 50000, initialSavedCents: 0 }];
    return data;
  }

  it('cancels a pending reservation and releases available funds', () => {
    const data = setup();
    const reserved = upsertRecord(data, 'contributions', { id: 'c', goalId: 'g', amountCents: 20000, date: '2025-01-01', accountId: 'checking', status: 'pending' }).data;
    expect(availableAccountBalance(reserved, reserved.accounts[0])).toBe(80000);
    const canceled = removeRecord(reserved, 'contributions', 'c').data;
    expect(accountBalance(canceled, canceled.accounts[0])).toBe(100000);
    expect(availableAccountBalance(canceled, canceled.accounts[0])).toBe(100000);
  });

  it('completes in the same account without a fictitious withdrawal or duplicate progress', async () => {
    const { completeGoalContributionInAccount } = await import('./store');
    const data = setup();
    const reserved = upsertRecord(data, 'contributions', { id: 'c', goalId: 'g', amountCents: 20000, date: '2025-01-01', accountId: 'checking', status: 'pending' }).data;
    const completed = completeGoalContributionInAccount(reserved, 'c');
    expect(completed.error).toBeUndefined();
    expect(accountBalance(completed.data, completed.data.accounts[0])).toBe(100000);
    expect(availableAccountBalance(completed.data, completed.data.accounts[0])).toBe(100000);
    expect(completed.data.transactions).toHaveLength(0);
    expect(completed.data.contributions).toHaveLength(1);
    expect(completed.data.contributions[0].status).toBe('designated');
  });

  it('transfers funds once to another account and releases the source reservation', async () => {
    const { transferGoalContribution } = await import('./store');
    const data = setup();
    const reserved = upsertRecord(data, 'contributions', { id: 'c', goalId: 'g', amountCents: 20000, date: '2025-01-01', accountId: 'checking', status: 'pending' }).data;
    const completed = transferGoalContribution(reserved, 'c', { id: 't', type: 'transfer', description: 'Move to savings', amountCents: 20000, date: '2025-01-02', accountId: 'checking', toAccountId: 'savings' });
    expect(completed.error).toBeUndefined();
    expect(accountBalance(completed.data, completed.data.accounts[0])).toBe(80000);
    expect(accountBalance(completed.data, completed.data.accounts[1])).toBe(20000);
    expect(pendingForAccount(completed.data, 'checking')).toBe(0);
    expect(completed.data.contributions).toHaveLength(1);
    expect(completed.data.contributions[0].status).toBe('posted');
    expect(transferGoalContribution(completed.data, 'c', { id: 't2', type: 'transfer', description: 'Duplicate', amountCents: 20000, date: '2025-01-02', accountId: 'checking', toAccountId: 'savings' }).error).toMatch(/no longer pending/);
  });

  it('rejects reservations above cash available after other pending holds', () => {
    const data = setup();
    const first = upsertRecord(data, 'contributions', { id: 'c1', goalId: 'g', amountCents: 70000, date: '2025-01-01', accountId: 'checking', status: 'pending' }).data;
    const tooMuch = upsertRecord(first, 'contributions', { id: 'c2', goalId: 'g', amountCents: 40000, date: '2025-01-01', accountId: 'checking', status: 'pending' });
    expect(tooMuch.error).toMatch(/enough available balance/);
  });
});
