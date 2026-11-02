import { describe, expect, it } from 'vitest';
import { calculateNextPayday, formatDateInput, normalizeDateInput } from './date';

describe('user date input', () => {
  it('accepts single digit month and day in month/day/year form', () => {
    expect(normalizeDateInput('8/4/2026')).toBe('2026-08-04');
  });

  it('accepts single digit month and day in existing ISO-style form', () => {
    expect(normalizeDateInput('2026-8-4')).toBe('2026-08-04');
  });

  it('rejects impossible calendar dates', () => {
    expect(normalizeDateInput('2/30/2026')).toBeNull();
  });

  it('formats saved ISO dates as month/day/year', () => {
    expect(formatDateInput('2026-08-04')).toBe('8/4/2026');
  });

  it('calculates weekly and biweekly dates from the upcoming payday anchor', () => {
    expect(calculateNextPayday('10/30/2026', '11/2/2026', 'weekly')).toBe('2026-11-06');
    expect(calculateNextPayday('10/30/2026', '11/2/2026', 'biweekly')).toBe('2026-11-13');
  });

  it('calculates a custom interval without drifting from the original payday', () => {
    expect(calculateNextPayday('10/30/2026', '11/2/2026', 'custom', 10)).toBe('2026-11-09');
    expect(calculateNextPayday('10/30/2026', '11/2/2026', 'custom', 0)).toBeNull();
  });

  it('anchors monthly schedules to the original day and clamps short months', () => {
    expect(calculateNextPayday('1/31/2026', '2/1/2026', 'monthly')).toBe('2026-02-28');
    expect(calculateNextPayday('1/31/2026', '3/1/2026', 'monthly')).toBe('2026-03-31');
  });
});
