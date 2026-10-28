import { accountBalanceAt } from './calculations';
import { AppData, Transaction, VirtualAccount } from './models';
import { normalizeDateInput } from './date';

export interface InterestPostingPreview {
  periodKey: string;
  periodEnd: string;
  amountCents: number;
  exactAmountCents: number;
}

export function interestDailyRate(account: VirtualAccount, date: string): number {
  if (!isInterestAccount(account)) return 0;
  const rate = rateForDate(account, date) / 100;
  if (account.type === 'credit_card') return rate / 365;
  return Math.pow(1 + rate, 1 / 365) - 1;
}

export function accruedInterestCents(data: AppData, account: VirtualAccount, throughDate: string): number {
  const through = normalizeDateInput(throughDate);
  if (!through || !isInterestAccount(account)) return 0;
  const start = nextUncreditedDate(data, account);
  if (start > through) return 0;
  return accrueBetween(data, account, start, through);
}

/** The next uncredited full calendar month; incomplete statement months cannot be posted. */
export function nextInterestPostingPreview(data: AppData, account: VirtualAccount, today: string): InterestPostingPreview | null {
  const currentDay = normalizeDateInput(today);
  if (!currentDay || !isInterestAccount(account)) return null;
  const start = nextUncreditedDate(data, account);
  if (start > currentDay) return null;
  let candidate = monthStart(start);
  const lastCompletedMonth = currentDay === monthEnd(currentDay) ? monthStart(currentDay) : monthStart(addDays(monthStart(currentDay), -1));
  while (candidate <= lastCompletedMonth) {
    const end = monthEnd(candidate);
    const exactAmountCents = accrueBetween(data, account, start, end);
    const amountCents = Math.round(exactAmountCents);
    if (amountCents > 0) return { periodKey: candidate.slice(0, 7), periodEnd: end, amountCents, exactAmountCents };
    candidate = monthStart(addDays(end, 1));
  }
  return null;
}

/** Daily compounding at EOD posted balance; holds are excluded from accountBalanceAt and remain interest-eligible. */
export function accrueBetween(data: AppData, account: VirtualAccount, startDate: string, endDate: string): number {
  const start = normalizeDateInput(startDate);
  const end = normalizeDateInput(endDate);
  if (!start || !end || start > end || !isInterestAccount(account)) return 0;
  const begins = account.interestStartDate && account.interestStartDate > start ? account.interestStartDate : start;
  if (begins > end) return 0;
  let accruedCents = 0;
  for (let day = begins; day <= end; day = addDays(day, 1)) {
    const eligibleBalanceCents = Math.max(0, accountBalanceAt(data, account, day) + accruedCents);
    accruedCents += eligibleBalanceCents * interestDailyRate(account, day);
  }
  return accruedCents;
}

export function nextInterestPostingTransaction(data: AppData, account: VirtualAccount, today: string, id: string): Transaction | null {
  const preview = nextInterestPostingPreview(data, account, today);
  if (!preview) return null;
  const credit = account.type !== 'credit_card';
  return {
    id,
    type: credit ? 'income' : 'expense',
    description: credit ? 'Monthly interest credit' : 'Estimated monthly interest charge',
    amountCents: preview.amountCents,
    date: preview.periodEnd,
    accountId: account.id,
    interestPosting: credit ? 'savings_credit' : 'credit_card_charge',
    interestPeriodKey: preview.periodKey,
  };
}

function nextUncreditedDate(data: AppData, account: VirtualAccount): string {
  const latestPosting = data.transactions
    .filter(item => item.accountId === account.id && item.interestPosting && item.interestPeriodKey)
    .map(item => `${item.interestPeriodKey}-01`)
    .sort()
    .at(-1);
  if (latestPosting) return addDays(monthEnd(latestPosting), 1);
  return account.interestStartDate ?? '9999-12-31';
}

function rateForDate(account: VirtualAccount, date: string): number {
  const history = [...(account.interestRateHistory ?? [])].filter(item => item.effectiveDate <= date).sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  return history.length ? history[history.length - 1].ratePercent : account.interestRatePercent ?? 0;
}
function isInterestAccount(account: VirtualAccount) { return account.type === 'savings' || account.type === 'high_yield_savings' || account.type === 'credit_card'; }
function monthStart(date: string) { return `${date.slice(0, 7)}-01`; }
function monthEnd(date: string) { const [year, month] = date.slice(0, 7).split('-').map(Number); return `${year}-${String(month).padStart(2, '0')}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, '0')}`; }
function addDays(date: string, days: number) { const [year, month, day] = date.split('-').map(Number); const next = new Date(Date.UTC(year, month - 1, day + days)); return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`; }
