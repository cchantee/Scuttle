import { AppData, Transaction } from './models';
import { accountBalance, availableAccountBalance, goalSummary, unallocatedForPaycheck, validateTransaction } from './calculations';

export const STUDY_DATE = '2026-11-05';
export const SCENARIO_PAYDAY = '2026-11-06';
const checking = 'jordan:checking', savings = 'jordan:savings';
const categoryId = (name: string) => `jordan:category:${name.toLowerCase().replace(/[^a-z]+/g, '-')}`;
const paycheckId = (index: number) => `jordan:paycheck:${index + 1}`;
const allocationId = (index: number, name: string) => `jordan:allocation:${index + 1}:${categoryId(name).split(':').pop()}`;
export const historicalPaychecks = [
  ['2026-09-11', 76000], ['2026-09-25', 89000], ['2026-10-09', 71000], ['2026-10-23', 92000],
] as const;
export const allocationRows: [string, number, number, number, number][] = [
  ['Rent',325,325,325,325], ['Utilities',45,55,50,55], ['Groceries',85,110,75,100],
  ['Gas',40,45,35,45], ['Phone',28,28,28,28], ['Subscriptions',15,15,15,15],
  ['Dining/Coffee',30,40,20,40], ['Clothing',0,35,0,25], ['Car Insurance',65,70,65,70],
  ['School/Other',30,40,20,40], ['Savings',40,65,0,50],
];
export const historicalExpenses: [string, string, string, number][] = [
  ['2026-09-25', 'Campus Apartment Rent', 'Rent', 65000],
  ['2026-09-10', 'Walmart Groceries', 'Groceries', 7800],
  ['2026-09-12', 'Electric + Water Share', 'Utilities', 9200],
  ['2026-09-13', 'Shell Gas', 'Gas', 4200],
  ['2026-09-14', 'Car Insurance', 'Car Insurance', 13500],
  ['2026-09-15', 'Phone Bill', 'Phone', 5500],
  ['2026-09-16', 'StreamFlix', 'Subscriptions', 1500],
  ['2026-09-18', 'Aldi Groceries', 'Groceries', 6400],
  ['2026-09-20', 'Lunch Between Classes', 'Dining/Coffee', 2400],
  ['2026-09-22', 'Laundry', 'Household/Other', 1800],
  ['2026-09-23', 'Chevron Gas', 'Gas', 3800],
  ['2026-09-26', 'Dinner With Friends', 'Dining/Coffee', 3100],
  ['2026-09-28', 'Walmart Groceries', 'Groceries', 9100],
  ['2026-09-29', 'Coffee Before Class', 'Dining/Coffee', 1300],
  ['2026-09-30', 'School Supplies', 'School/Other', 6700],
  ['2026-10-23', 'Campus Apartment Rent', 'Rent', 65000],
  ['2026-10-03', 'Thrift Store Clothes', 'Clothing', 4800],
  ['2026-10-04', 'Aldi Groceries', 'Groceries', 5500],
  ['2026-10-06', 'Campus Parking', 'Transportation/Other', 2200],
  ['2026-10-08', 'Shell Gas', 'Gas', 4500],
  ['2026-10-10', 'Household Essentials', 'Household/Other', 3900],
  ['2026-10-11', 'Takeout Dinner', 'Dining/Coffee', 1900],
  ['2026-10-12', 'Electric + Water Share', 'Utilities', 10500],
  ['2026-10-14', 'Walmart Groceries', 'Groceries', 7200],
  ['2026-10-14', 'Car Insurance', 'Car Insurance', 13500],
  ['2026-10-15', 'Phone Bill', 'Phone', 5500],
  ['2026-10-16', 'StreamFlix', 'Subscriptions', 1500],
  ['2026-10-19', 'Textbooks/Course Materials', 'School/Other', 12500],
  ['2026-10-21', 'Chevron Gas', 'Gas', 3600],
  ['2026-10-24', 'Restaurants and Coffee', 'Dining/Coffee', 8500],
  ['2026-10-27', 'Groceries and Household Food', 'Groceries', 14000],
  ['2026-10-28', 'Medical Copay', 'Health/Other', 3500],
  ['2026-11-02', 'Unexpected Car Repair', 'Transportation/Other', 14600],
];
export const recurringBills: [string, string, number, string][] = [
  ['Apartment Rent','Rent',65000,'2026-12-01'], ['Electric + Water','Utilities',10000,'2026-11-12'],
  ['Car Insurance','Car Insurance',13500,'2026-11-14'], ['Phone','Phone',5500,'2026-11-15'],
  ['StreamFlix','Subscriptions',1500,'2026-11-16'],
];

/** Fresh, deterministic snapshot: never merge participant activity into a reset. */
export function buildJordanTaylorSnapshot(userId: string): AppData {
  const categories = [...new Set([...allocationRows.map(row => row[0]), ...historicalExpenses.map(row => row[2])])]
    .map(name => ({ id: categoryId(name), name }));
  const paychecks = historicalPaychecks.map(([receivedAt, amountCents], index) => ({
    id: paycheckId(index), receivedAt, amountCents, status: 'received' as const, source: 'Campus Bookstore',
    notes: 'Part-time student job', accountId: checking, accountCreditCents: amountCents,
    remainingAccountId: checking, budgetArchived: index < 3,
  }));
  const allocations = paychecks.flatMap((paycheck, index) => allocationRows.filter(row => row[index + 1] !== 0).map(row => ({
    id: allocationId(index, row[0]), paycheckId: paycheck.id, categoryId: categoryId(row[0]), amountCents: Number(row[index + 1]) * 100,
  })));
  const expenses: Transaction[] = historicalExpenses.map(([date, description, category, amountCents], index) => {
    // Match the most recent received paycheck; pre-first-payday expenses use opening cash.
    // Categories without a plan remain unbudgeted. Overspending stays visible, never clamped.
    const payIndex = historicalPaychecks.findLastIndex(([payday]) => payday <= date);
    const planned = allocations.find(item => item.id === allocationId(payIndex, category));
    return { id: `jordan:expense:${index + 1}`, date, description, amountCents, type: 'expense',
      accountId: checking, categoryId: categoryId(category), ...(description === 'Campus Apartment Rent' ? { notes: 'Late monthly rent payment after the same-day Campus Bookstore deposit.' } : {}), ...(planned ? { allocationId: planned.id } : {}) };
  });
  const gigs: Transaction[] = ([['2026-09-19','Tutoring',6500],['2026-10-17','Delivery gig',8500],['2026-10-31','Tutoring',5500]] as const)
    .map(([date, description, amountCents], index) => ({ id: `jordan:gig:${index + 1}`, date, description, amountCents, type: 'income', accountId: checking }));
  const transfers: Transaction[] = ([['2026-09-25',7500],['2026-10-23',6500],['2026-10-31',4000]] as const)
    .map(([date, amountCents], index) => ({ id: `jordan:transfer:${index + 1}`, date, amountCents, description: 'Transfer to Capital One 360 Performance Savings', type: 'transfer', accountId: checking, toAccountId: savings }));
  const reminders: Transaction[] = recurringBills.map(([description, category, amountCents, nextDueDate], index) => ({
    id: description === 'StreamFlix' ? 'jordan:subscription:streaming' : `jordan:bill:${index + 1}`,
    description, categoryId: categoryId(category), amountCents, date: STUDY_DATE, nextDueDate,
    type: 'subscription', subscriptionFrequency: 'monthly', accountId: checking,
    ...(category === 'Utilities' ? { notes: 'Estimated monthly amount' } : {}),
  }));
  return {
    version: 2, user: { id: userId, displayName: 'Jordan Taylor', paydayFrequency: 'biweekly', nextPayday: SCENARIO_PAYDAY, studySnapshotDate: STUDY_DATE },
    accounts: [
      { id: checking, name: 'Capital One 360 Checking', type: 'checking', initialBalanceCents: 18000, interestRatePercent: 0, interestStartDate: '2026-09-06', interestRateHistory: [{ effectiveDate: '2026-09-06', ratePercent: 0 }], notes: 'Opening balance on 2026-09-06' },
      { id: savings, name: 'Capital One 360 Performance Savings', type: 'high_yield_savings', initialBalanceCents: 50000, interestRatePercent: 3.5,
        interestStartDate: '2026-09-06', interestRateHistory: [{ effectiveDate: '2026-09-06', ratePercent: 3.5 }], notes: 'Opening balance on 2026-09-06; simulated 3.5% APY for fictional study data, not a current bank rate; no historical interest credits supplied' },
      { id: 'jordan:account:cash', name: 'Cash', type: 'cash', initialBalanceCents: 30000, interestRatePercent: 0, interestStartDate: '2026-09-06', interestRateHistory: [{ effectiveDate: '2026-09-06', ratePercent: 0 }], notes: 'Cash on hand at the study opening; no bank transfer or income entry.' },
    ], categories, paychecks, allocations, transactions: [...expenses, ...gigs, ...transfers, ...reminders],
    goals: [{ id: 'jordan:goal:emergency', name: 'Emergency Fund', targetCents: 100000, initialSavedCents: 0 }],
    contributions: [{ id: 'jordan:reservation:emergency', goalId: 'jordan:goal:emergency', accountId: savings, amountCents: 12000, date: STUDY_DATE, status: 'pending', note: 'Reserved from existing savings; no bank transfer' }],
  };
}

export interface StudyLedgerRow {
  date: string;
  eventId: string;
  description: string;
  balances: Record<string, number>;
}

/** Date-only records: deposits settle before spending, then transfers on the same day.
 * Recalculate each prefix with the app's real ledger rules, never a clamped balance.
 */
export function auditJordanAccountHistory(data: AppData): StudyLedgerRow[] {
  const prefix: AppData = { ...data, paychecks: [], transactions: [] };
  const row = (date: string, eventId: string, description: string): StudyLedgerRow => ({
    date, eventId, description,
    balances: Object.fromEntries(data.accounts.map(account => [account.id, accountBalance(prefix, account)])),
  });
  const events = [
    ...data.paychecks.map(paycheck => ({ date: paycheck.receivedAt, order: 0, id: paycheck.id,
      description: paycheck.source ?? 'Paycheck', post: () => { prefix.paychecks.push(paycheck); } })),
    ...data.transactions.map(transaction => ({ date: transaction.date,
      order: transaction.type === 'income' ? 0 : transaction.type === 'expense' ? 1 : transaction.type === 'transfer' ? 2 : 3,
      id: transaction.id, description: transaction.description, post: () => { prefix.transactions.push(transaction); } })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
  const rows = [row('2026-09-06', 'opening', 'Opening balances')];
  for (const event of events) {
    if (event.date < '2026-09-06' || event.date > STUDY_DATE) throw new Error(`Jordan fixture: event outside study history: ${event.id}`);
    event.post();
    rows.push(row(event.date, event.id, event.description));
  }
  return rows;
}

export function assertJordanHasNoOverdrafts(data: AppData): void {
  const deficits = auditJordanAccountHistory(data).flatMap(row => data.accounts
    .filter(account => row.balances[account.id] < 0)
    .map(account => `${row.date} ${account.name} after ${row.description}: ${(row.balances[account.id] / 100).toFixed(2)}`));
  if (deficits.length) throw new Error(`Jordan fixture overdrafts:\n${deficits.join('\n')}`);
}

/** Run before every write, using the application's financial calculations. */
export function verifyJordanTaylorStartingData(data: AppData): void {
  const require = (ok: boolean, message: string) => { if (!ok) throw new Error(`Jordan fixture: ${message}`); };
  const sum = (type: Transaction['type']) => data.transactions.filter(t => t.type === type).reduce((total, t) => total + t.amountCents, 0);
  require(data.user.studySnapshotDate === STUDY_DATE && data.user.nextPayday === SCENARIO_PAYDAY, 'study dates must stay fixed');
  require(data.paychecks.length === 4 && data.paychecks.every(p => p.status === 'received') && data.paychecks.reduce((n,p) => n+p.amountCents,0) === 328000, 'historical paychecks');
  require(data.transactions.filter(t => t.type === 'expense').length === 33 && sum('expense') === 324000, 'expense count/total');
  require(data.transactions.filter(t => t.type === 'income').length === 3 && sum('income') === 20500, 'gig income');
  require(data.transactions.filter(t => t.type === 'transfer').length === 3 && sum('transfer') === 18000, 'internal transfers');
  require(data.transactions.filter(t => t.type === 'subscription').length === 5, 'recurring reminders');
  require(data.transactions.every(t => !t.interestPosting && !validateTransaction(data, t)), 'invalid transaction or invented interest');
  assertJordanHasNoOverdrafts(data);
  require(data.accounts.length === 3 && accountBalance(data, data.accounts[0]) === 24500 && accountBalance(data, data.accounts[1]) === 68000 && data.accounts[2].name === 'Cash' && data.accounts[2].type === 'cash' && accountBalance(data, data.accounts[2]) === 30000 && availableAccountBalance(data, data.accounts[2]) === 30000, 'account reconciliation');
  require(data.accounts[1].interestRatePercent === 3.5 && availableAccountBalance(data, data.accounts[1]) === 56000, 'savings reservation/APY');
  require(data.goals.length === 1 && data.goals[0].name === 'Emergency Fund' && goalSummary(data, data.goals[0]).progressPercent === 12, 'Emergency Fund');
  require(data.paychecks.every((p,i) => unallocatedForPaycheck(data,p.id) === [5700,6200,7700,12700][i]), 'unallocated amounts');
  require(!data.paychecks.some(p => p.amountCents === 85000) && !data.categories.some(c => c.name === 'Friend Outings') && !data.goals.some(g => g.name === 'Moving Fund') && !data.transactions.some(t => t.type === 'expense' && t.categoryId === categoryId('Groceries') && t.amountCents === 2800), 'participant tasks must remain incomplete');
}
