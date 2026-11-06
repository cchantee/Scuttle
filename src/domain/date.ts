/** Parse dates users type as M/D/YYYY (including single-digit month/day) or YYYY-M-D. */
export function normalizeDateInput(value: string): string | null {
  const input = value.trim();
  let year: number, month: number, day: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(input);
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input);
  if (iso) [, year, month, day] = iso.map(Number);
  else if (us) [, month, day, year] = us.map(Number);
  else return null;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return null;
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

export function formatDateInput(value: string): string {
  const iso = normalizeDateInput(value);
  if (!iso) return value;
  const [year, month, day] = iso.split('-');
  return `${Number(month)}/${Number(day)}/${year}`;
}

export function formatDateDisplay(value: string): string {
  const iso = normalizeDateInput(value);
  return iso ? formatDateInput(iso) : value;
}

export function todayISODate(user?: { studySnapshotDate?: string }): string {
  if (user?.studySnapshotDate && normalizeDateInput(user.studySnapshotDate)) return normalizeDateInput(user.studySnapshotDate)!;
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
}

export function todayDateInput(user?: { studySnapshotDate?: string }): string { return formatDateInput(todayISODate(user)); }

/** Return the next scheduled paycheck date on or after today, anchored to the user's first entered payday. */
export function calculateNextPayday(anchorDate: string, today: string, frequency: 'monthly' | 'weekly' | 'biweekly' | 'custom', intervalDays?: number): string | null {
  const anchor = normalizeDateInput(anchorDate);
  const current = normalizeDateInput(today);
  if (!anchor || !current) return null;
  const anchorDay = dateOrdinal(anchor);
  const currentDay = dateOrdinal(current);

  if (frequency === 'monthly') {
    const [anchorYear, anchorMonth, anchorDateOfMonth] = anchor.split('-').map(Number);
    const [currentYear, currentMonth] = current.split('-').map(Number);
    const monthsElapsed = Math.max(0, (currentYear - anchorYear) * 12 + currentMonth - anchorMonth);
    let occurrence = monthlyOccurrence(anchorYear, anchorMonth, anchorDateOfMonth, monthsElapsed);
    if (occurrence < current) occurrence = monthlyOccurrence(anchorYear, anchorMonth, anchorDateOfMonth, monthsElapsed + 1);
    return occurrence;
  }

  const interval = frequency === 'weekly' ? 7 : frequency === 'biweekly' ? 14 : intervalDays;
  if (!Number.isInteger(interval) || !interval || interval < 1 || interval > 365) return null;
  const jumps = Math.max(0, Math.ceil((currentDay - anchorDay) / interval));
  return ordinalDate(anchorDay + jumps * interval);
}

function dateOrdinal(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function ordinalDate(ordinal: number): string {
  const date = new Date(ordinal * 86400000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function monthlyOccurrence(anchorYear: number, anchorMonth: number, anchorDay: number, monthsAfterAnchor: number): string {
  const zeroBasedMonth = anchorMonth - 1 + monthsAfterAnchor;
  const year = anchorYear + Math.floor(zeroBasedMonth / 12);
  const month = zeroBasedMonth % 12 + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(anchorDay, lastDay)).padStart(2, '0')}`;
}
