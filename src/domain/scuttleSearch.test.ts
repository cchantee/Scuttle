import { describe, expect, it } from 'vitest';
import { buildJordanTaylorSnapshot } from './jordanStudy';
import { searchScuttle } from './scuttleSearch';
const data=buildJordanTaylorSnapshot('search-user');
describe('human interface global search',()=>{
 it('finds each kind of record and the existing pages',()=>{
  expect(searchScuttle(data,'Cash').some(r=>r.key==='account:jordan:account:cash')).toBe(true);
  expect(searchScuttle(data,'Campus Bookstore').filter(r=>r.key.startsWith('pay:'))).toHaveLength(4);
  expect(searchScuttle(data,'Emergency Fund').some(r=>r.key.startsWith('goal:'))).toBe(true);
  expect(searchScuttle(data,'reserved 120').some(r=>r.key.startsWith('contribution:'))).toBe(true);
  expect(searchScuttle(data,'financial history').some(r=>r.destination.pathname==='/history')).toBe(true);
 });
 it('searches dollar amounts, formatted and ISO dates, categories, and account associations',()=>{
  expect(searchScuttle(data,'$760.00').some(r=>r.key.startsWith('pay:'))).toBe(true);
  expect(searchScuttle(data,'2026-09-11').some(r=>r.key.startsWith('pay:'))).toBe(true);
  expect(searchScuttle(data,'9/11/2026').some(r=>r.key.startsWith('pay:'))).toBe(true);
  expect(searchScuttle(data,'Walmart groceries checking').some(r=>r.key.startsWith('transaction:'))).toBe(true);
  expect(searchScuttle(data,'StreamFlix reminder').some(r=>r.key==='transaction:jordan:subscription:streaming')).toBe(true);
 });
 it('keeps results beyond eight, with stable unique keys and precise record destinations',()=>{
  const results=searchScuttle(data,'groceries');expect(results.length).toBeGreaterThan(8);
  expect(new Set(results.map(r=>r.key)).size).toBe(results.length);
  expect(results.find(r=>r.key.startsWith('allocation:'))?.destination).toMatchObject({pathname:'/allocation/[id]',params:{id:expect.any(String)}});
  expect(searchScuttle(data,'StreamFlix').find(r=>r.key.startsWith('transaction:'))?.destination.params?.editId).toBeTruthy();
 });
 it('handles empty, unmatched, and mixed case queries without changing financial data',()=>{
  const before=JSON.stringify(data);expect(searchScuttle(data,'  ')).toEqual([]);expect(searchScuttle(data,'no-such-thing-xyz')).toEqual([]);
  expect(searchScuttle(data,'  eMERGENCY   fUND ')).toEqual(searchScuttle(data,'Emergency Fund'));
  expect(JSON.stringify(data)).toBe(before);
 });
});
