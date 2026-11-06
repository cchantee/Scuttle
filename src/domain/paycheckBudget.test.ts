import { expect, it } from 'vitest';
import { buildJordanTaylorSnapshot } from './jordanStudy';
import { accountBalance, activeBudgetAllocations, allocationSummary } from './calculations';
import { upsertRecord } from './store';
import { startReceivedBudget } from './paycheckBudget';

it('archives the previous budget on received income, preserving history, holds and bank accounting', () => {
  const baseline = buildJordanTaylorSnapshot('id');
  const result = upsertRecord(baseline,'paychecks',{ id:'new-pay', amountCents:85000, status:'received', receivedAt:'2026-11-06', accountId:'jordan:checking', accountCreditCents:85000 });
  expect(result.error).toBeUndefined();
  expect(result.data.paychecks.filter(p => p.status !== 'planned' && !p.budgetArchived).map(p => p.id)).toEqual(['new-pay']);
  expect(activeBudgetAllocations(result.data)).toEqual([]);
  expect(result.data.allocations).toEqual(baseline.allocations);
  expect(result.data.transactions).toEqual(baseline.transactions);
  expect(result.data.contributions).toEqual(baseline.contributions);
  expect(accountBalance(result.data,baseline.accounts[0])).toBe(109500);
  expect(accountBalance(result.data,baseline.accounts[1])).toBe(68000);
  const groceries = baseline.allocations.find(a => a.paycheckId==='jordan:paycheck:4' && a.categoryId==='jordan:category:groceries')!;
  expect(allocationSummary(result.data,groceries).remainingCents).toBe(-4000);
  expect(baseline.paychecks.at(-1)!.budgetArchived).toBe(false);
});

it('does not archive on planned income, paycheck edits, or failed writes', () => {
  const baseline = buildJordanTaylorSnapshot('id');
  const planned = upsertRecord(baseline,'paychecks',{id:'future',status:'planned',amountCents:85000,receivedAt:'2026-11-06'});
  expect(planned.data.paychecks.find(p=>p.id==='jordan:paycheck:4')!.budgetArchived).toBe(false);
  const edited = upsertRecord(baseline,'paychecks',{...baseline.paychecks[3],notes:'Updated note'});
  expect(edited.data.paychecks.map(p=>p.budgetArchived)).toEqual(baseline.paychecks.map(p=>p.budgetArchived));
  const invalid = upsertRecord(baseline,'paychecks',{id:'invalid',amountCents:-1,receivedAt:'2026-11-06'});
  expect(invalid.error).toBeDefined();
  expect(invalid.data).toBe(baseline);
});

it('keeps the current budget when older income is entered and activates same-day new income', () => {
  const baseline = buildJordanTaylorSnapshot('id');
  const old = upsertRecord(baseline,'paychecks',{id:'old',amountCents:10000,receivedAt:'2026-09-01'}).data;
  expect(old.paychecks.find(p=>p.id==='old')!.budgetArchived).toBe(true);
  expect(old.paychecks.find(p=>p.id==='jordan:paycheck:4')!.budgetArchived).toBe(false);
  const sameDay = upsertRecord(baseline,'paychecks',{id:'same-day',amountCents:10000,receivedAt:'2026-10-23'}).data;
  expect(sameDay.paychecks.filter(p=>!p.budgetArchived).map(p=>p.id)).toEqual(['same-day']);
  expect(startReceivedBudget(sameDay.paychecks,'same-day')).toEqual(sameDay.paychecks);
});

it('a single categorized expense reduces its paycheck budget and selected account exactly once', () => {
  const baseline = buildJordanTaylorSnapshot('id');
  const next = upsertRecord(baseline,'paychecks',{ id:'new-pay', amountCents:85000, receivedAt:'2026-11-06', accountId:'jordan:checking' }).data;
  const allocated = upsertRecord(next,'allocations',{id:'new-food',paycheckId:'new-pay',categoryId:'jordan:category:groceries',amountCents:12000}).data;
  const result = upsertRecord(allocated,'transactions',{id:'purchase',type:'expense',description:'Groceries',categoryId:'jordan:category:groceries',amountCents:2800,date:'2026-11-06',accountId:'jordan:checking'});
  expect(result.error).toBeUndefined();
  expect(result.data.transactions.find(t=>t.id==='purchase')!.allocationId).toBe('new-food');
  expect(accountBalance(result.data,baseline.accounts[0])).toBe(106700);
  expect(allocationSummary(result.data,result.data.allocations.find(a=>a.id==='new-food')!).remainingCents).toBe(9200);
});
