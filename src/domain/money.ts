import { z } from 'zod';

const moneyInput = z.string().trim().regex(/^(?:\d+)(?:\.\d{0,2})?$/, 'Enter a valid non-negative amount with up to two decimal places.');
export function parseMoney(input: string): number {
  const normalized = input.trim().replace(/[$,\s]/g, '');
  if (!moneyInput.safeParse(normalized).success) throw new Error('Enter a non-negative dollar amount with up to two decimal places.');
  const [whole, fraction = ''] = normalized.split('.');
  const cents = Number(whole) * 100 + Number((fraction + '00').slice(0, 2));
  if (!Number.isSafeInteger(cents)) throw new Error('Amount is too large.');
  return cents;
}

export const formatMoney = (cents: number): string => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
export const formatInputMoney = (cents: number): string => (cents / 100).toFixed(2);
