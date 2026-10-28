import { AppData, emptyData, InterestRateChange, VirtualAccount } from './models';
import { todayISODate } from './date';

/** Upgrade stored snapshots without discarding financial history. */
export function migrateAppData(value: unknown, today = todayISODate()): AppData {
  if (!value || typeof value !== 'object') throw new Error('Saved Scuttle data is invalid.');
  const raw = value as Omit<Partial<AppData>, 'version'> & { version?: number };
  if (raw.version !== 1 && raw.version !== 2) throw new Error('Saved Scuttle data is invalid or from an unsupported version.');
  const defaults = emptyData();
  const accounts = (Array.isArray(raw.accounts) ? raw.accounts : []).map(account => normalizeAccount(account as VirtualAccount, today));
  return {
    ...defaults, ...raw, version: 2,
    user: { ...defaults.user, ...(raw.user ?? {}) },
    paychecks: Array.isArray(raw.paychecks) ? raw.paychecks : [],
    categories: Array.isArray(raw.categories) ? raw.categories : [],
    allocations: Array.isArray(raw.allocations) ? raw.allocations : [],
    transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
    accounts,
    goals: Array.isArray(raw.goals) ? raw.goals : [],
    contributions: Array.isArray(raw.contributions) ? raw.contributions : [],
  };
}

function normalizeAccount(account: VirtualAccount, today: string): VirtualAccount {
  const rate = typeof account.interestRatePercent === 'number' && Number.isFinite(account.interestRatePercent)
    ? account.interestRatePercent : 0;
  const effectiveDate = account.interestStartDate ?? today;
  const history: InterestRateChange[] = Array.isArray(account.interestRateHistory) && account.interestRateHistory.length
    ? account.interestRateHistory : [{ effectiveDate, ratePercent: rate }];
  return { ...account, interestRatePercent: rate, interestStartDate: effectiveDate, interestRateHistory: history };
}
