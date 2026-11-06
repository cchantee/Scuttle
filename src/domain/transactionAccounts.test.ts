import { expect, it } from 'vitest';
import { payingAccountSelection, expenseAllocation } from './transactionAccounts';
import { buildJordanTaylorSnapshot, verifyJordanTaylorStartingData } from './jordanStudy';
import { accountBalance, allocationSummary } from './calculations';
import { upsertRecord } from './store';

const auto = {accountId:'',manual:false};
function fixture() {
  let data=buildJordanTaylorSnapshot('id');
  data=upsertRecord(data,'paychecks',{id:'new',amountCents:85000,receivedAt:'2026-11-06',accountId:'jordan:checking'}).data;
  return upsertRecord(data,'allocations',{id:'food',paycheckId:'new',categoryId:'jordan:category:groceries',amountCents:12000}).data;
}
it('defaults to the associated paycheck account and follows paycheck/holding-account changes',()=>{
  const data=fixture();
  expect(payingAccountSelection(data,{allocationId:'food'},auto)).toBe('jordan:checking');
  data.paychecks.push({id:'other',amountCents:10000,receivedAt:'2026-11-06',accountId:'jordan:savings'});
  data.allocations.push({id:'other-food',paycheckId:'other',categoryId:'jordan:category:groceries',amountCents:10000});
  expect(payingAccountSelection(data,{allocationId:'other-food'},auto)).toBe('jordan:savings');
  data.paychecks.find(p=>p.id==='new')!.remainingAccountId='jordan:savings';
  expect(payingAccountSelection(data,{allocationId:'food'},auto)).toBe('jordan:savings');
});
it('keeps an explicit account override, or a cleared account, when paycheck/category changes',()=>{
  const data=fixture();
  expect(payingAccountSelection(data,{allocationId:'food'},{accountId:'jordan:savings',manual:true})).toBe('jordan:savings');
  expect(payingAccountSelection(data,{paycheckId:'new'},{accountId:'',manual:true})).toBe('');
});
it('defaults uncategorized expenses to checking and leaves selection empty if no cash account exists',()=>{
  const data=fixture();
  expect(payingAccountSelection({...data,paychecks:[]},{},auto)).toBe('jordan:checking');
  expect(payingAccountSelection({...data,paychecks:[],accounts:[]},{},auto)).toBe('');
  expect(expenseAllocation(data,{categoryId:'jordan:category:groceries'})!.id).toBe('food');
});
it('uses one expense for the account and budget, preserves the paycheck, and permits budget overspending',()=>{
  const data=fixture();
  const result=upsertRecord(data,'transactions',{id:'purchase',type:'expense',description:'Groceries',amountCents:2800,date:'2026-11-06',categoryId:'jordan:category:groceries'});
  expect(result.error).toBeUndefined();
  expect(result.data.transactions.filter(t=>t.id==='purchase')).toHaveLength(1);
  expect(result.data.transactions.at(-1)).toMatchObject({accountId:'jordan:checking',allocationId:'food'});
  expect(accountBalance(result.data,data.accounts[0])).toBe(106700);
  expect(allocationSummary(result.data,result.data.allocations.find(a=>a.id==='food')!).remainingCents).toBe(9200);
  expect(result.data.paychecks.find(p=>p.id==='new')!.amountCents).toBe(85000);
  const overspent=upsertRecord(result.data,'transactions',{id:'more',type:'expense',description:'More groceries',amountCents:10000,date:'2026-11-06',allocationId:'food'});
  expect(overspent.error).toBeUndefined();
  expect(allocationSummary(overspent.data,overspent.data.allocations.find(a=>a.id==='food')!).remainingCents).toBe(-800);
  expect(accountBalance(overspent.data,data.accounts[0])).toBe(96700);
});
it('honors a manually selected account in the saved expense and preserves old transactions',()=>{
  const data=fixture();
  const result=upsertRecord(data,'transactions',{id:'manual',type:'expense',description:'Food',amountCents:2800,date:'2026-11-06',allocationId:'food',accountId:'jordan:savings'});
  expect(result.error).toBeUndefined();
  expect(accountBalance(result.data,data.accounts[0])).toBe(109500);
  expect(accountBalance(result.data,data.accounts[1])).toBe(65200);
  expect(result.data.transactions.slice(0,data.transactions.length)).toEqual(data.transactions);
});
it('rejects a negative checking balance atomically, allows exact-zero, and prevents overdrawing savings on transfers',()=>{
  const data=buildJordanTaylorSnapshot('id');
  const invalid=upsertRecord(data,'transactions',{id:'overdraw',type:'expense',description:'Too much',amountCents:24501,date:'2026-11-05',accountId:'jordan:checking'});
  expect(invalid.error).toMatch(/overdraw/);expect(invalid.data).toBe(data);
  const exact=upsertRecord(data,'transactions',{id:'zero',type:'expense',description:'All checking',amountCents:24500,date:'2026-11-05',accountId:'jordan:checking'});
  expect(exact.error).toBeUndefined();expect(accountBalance(exact.data,data.accounts[0])).toBe(0);
  const transfer=upsertRecord(data,'transactions',{id:'bad-transfer',type:'transfer',description:'Too much',amountCents:68001,date:'2026-11-05',accountId:'jordan:savings',toAccountId:'jordan:checking'});
  expect(transfer.error).toMatch(/overdraw/);expect(transfer.data).toBe(data);
});
it('validates both sides of a transfer and catches backdated deficits even when final funds are sufficient',()=>{
  const data=buildJordanTaylorSnapshot('id');
  const backdated=upsertRecord(data,'transactions',{id:'earlier',type:'expense',description:'Early purchase',amountCents:10300,date:'2026-09-10',accountId:'jordan:checking'});
  expect(backdated.error).toMatch(/2026-09-10/);expect(backdated.data).toBe(data);
  const transferred=upsertRecord(data,'transactions',{id:'valid-transfer',type:'transfer',description:'Move cash',amountCents:1000,date:'2026-11-05',accountId:'jordan:checking',toAccountId:'jordan:savings'});
  expect(transferred.error).toBeUndefined();
  expect(accountBalance(transferred.data,data.accounts[0])).toBe(23500);
  expect(accountBalance(transferred.data,data.accounts[1])).toBe(69000);
  verifyJordanTaylorStartingData(data);
});
it('checks an expense edit against the replaced record rather than charging it twice',()=>{
  const data=fixture();
  const tx={id:'edit',type:'expense' as const,description:'Food',amountCents:2800,date:'2026-11-06',allocationId:'food',accountId:'jordan:checking'};
  const once=upsertRecord(data,'transactions',tx).data;
  const edited=upsertRecord(once,'transactions',{...tx,amountCents:3500});
  expect(edited.error).toBeUndefined();expect(accountBalance(edited.data,data.accounts[0])).toBe(106000);
  const tooMuch=upsertRecord(once,'transactions',{...tx,amountCents:200000});
  expect(tooMuch.error).toMatch(/overdraw/);expect(tooMuch.data).toBe(once);
});
