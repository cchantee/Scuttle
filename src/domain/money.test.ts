import { expect, it } from 'vitest';
import { parseMoney } from './money';
it.each(['abc', '-5', '1.234', '', 'NaN'])('explains invalid money input %s in plain language', input => {
  expect(() => parseMoney(input)).toThrow('Enter a non-negative dollar amount with up to two decimal places.');
});
it('continues to parse normalized values into exact integer cents', () => {
  expect(parseMoney('$1,234.56')).toBe(123456);
  expect(parseMoney('0')).toBe(0);
  expect(parseMoney('0.01')).toBe(1);
});
