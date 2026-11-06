import { describe, expect, it } from 'vitest';
import { buildJordanTaylorSnapshot } from './jordanStudy';
import { defaultActivityDate, newlyReceivedPaychecks, paycheckPeriodEnd, remindersForPaycheck, transactionInPaycheck } from './paycheckActivity';
import { currentPaycheck } from './navigation';
import { upsertRecord, receivePlannedPaycheck } from './store';
import { accountBalance } from './calculations';
function fixture(){return buildJordanTaylorSnapshot('paycheck-activity-test');}
describe('focused paycheck activity and reminders',()=>{
 it('shows linked spending and unbudgeted activity in the current period, not archived periods or reminders',()=>{
  const d=fixture(),p=currentPaycheck(d)!;
  const visible=d.transactions.filter(t=>transactionInPaycheck(d,t,p));
  expect(visible.some(t=>t.description==='Unexpected Car Repair')).toBe(true);
  expect(visible.some(t=>t.description==='Groceries and Household Food')).toBe(true);
  expect(visible.some(t=>t.description==='School Supplies')).toBe(false);
  expect(visible.some(t=>t.type==='subscription')).toBe(false);
  expect(transactionInPaycheck(d,d.transactions[0],undefined)).toBe(false);
 });
 it('uses explicit budget associations before dates and excludes the next payday boundary',()=>{
  const d=fixture(),p=d.paychecks[0];
  expect(paycheckPeriodEnd(d,p)).toBe('2026-09-25');
  const tx={id:'unbudgeted',type:'expense' as const,description:'Cash purchase',amountCents:100,date:'2026-09-25'};
  expect(transactionInPaycheck(d,tx,p)).toBe(false);
  expect(transactionInPaycheck(d,{...tx,date:'2026-09-24'},p)).toBe(true);
  expect(transactionInPaycheck(d,{...tx,date:'2026-09-24',allocationId:d.allocations.find(a=>a.paycheckId===d.paychecks[3].id)!.id},p)).toBe(false);
 });
 it('finds StreamFlix and bills due from the new $850 paycheck without posting charges',()=>{
  const before=fixture(),original=JSON.stringify(before);
  const r=upsertRecord(before,'paychecks',{id:'new',source:'Campus Bookstore',amountCents:85000,receivedAt:'2026-11-06',status:'received',accountId:before.accounts[0].id,accountCreditCents:85000});
  expect(r.error).toBeUndefined();const d=r.data,p=d.paychecks.find(p=>p.id==='new')!;
  expect(paycheckPeriodEnd(d,p)).toBe('2026-11-20');
  expect(defaultActivityDate(d)).toBe('2026-11-06');
  expect(d.user.studySnapshotDate).toBe('2026-11-05');
  const reminders=remindersForPaycheck(d,p);
  expect(reminders.map(r=>r.transaction.description)).toEqual(['Electric + Water','Car Insurance','StreamFlix','Phone']);
  expect(reminders.find(r=>r.transaction.description==='StreamFlix')?.dueDate).toBe('2026-11-14');
  expect(reminders.reduce((sum,r)=>sum+r.transaction.amountCents,0)).toBe(30500);
  expect(accountBalance(d,d.accounts[0])).toBe(109500);
  expect(d.transactions).toEqual(before.transactions);expect(JSON.stringify(before)).toBe(original);
  expect(newlyReceivedPaychecks(before,d).map(p=>p.id)).toEqual(['new']);
  expect(newlyReceivedPaychecks(d,fixture())).toEqual([]);
 });
 it('notifies only when income is newly received, including a planned paycheck becoming received',()=>{
  const before=fixture(),planned=upsertRecord(before,'paychecks',{id:'planned',source:'Job',amountCents:85000,receivedAt:'2026-11-06',status:'planned'}).data;
  expect(newlyReceivedPaychecks(before,planned)).toEqual([]);
  const received=receivePlannedPaycheck(planned,'planned',85000,'2026-11-06',before.accounts[0].id);
  expect(received.error).toBeUndefined();expect(newlyReceivedPaychecks(planned,received.data).map(p=>p.id)).toEqual(['planned']);
  expect(newlyReceivedPaychecks(received.data,{...received.data,paychecks:received.data.paychecks.map(p=>({...p,notes:'Edited note'}))})).toEqual([]);
 });
 it('supports monthly schedules and recurrence without counting bills on the next payday',()=>{
  const d=fixture();d.user.paydayFrequency='monthly';const p={id:'monthly',receivedAt:'2026-11-01',amountCents:100000,status:'received' as const};
  d.paychecks=[p];expect(paycheckPeriodEnd(d,p)).toBe('2026-12-01');
  expect(remindersForPaycheck(d,p).some(r=>r.transaction.description==='Apartment Rent')).toBe(false);
  const repeat={id:'weekly',type:'subscription' as const,description:'Weekly reminder',amountCents:100,date:'2026-11-01',nextDueDate:'2026-11-01',subscriptionFrequency:'weekly' as const};
  d.transactions=[repeat];expect(remindersForPaycheck(d,p)).toHaveLength(5);
 });
});
