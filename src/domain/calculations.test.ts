import { describe, expect, it } from 'vitest';
import { accountBalance, allocatedForPaycheck, allocationSummary, goalSummary, unallocatedForPaycheck, validateTransaction } from './calculations';
import { AppData, emptyData } from './models';
import { removeRecord, upsertRecord } from './store';

function scenario(): AppData {
  const d=emptyData();
  d.paychecks=[{id:'p',amountCents:120000,receivedAt:'2026-10-01'}];
  d.categories=[{id:'housing',name:'Housing'},{id:'groceries',name:'Groceries'},{id:'transport',name:'Transportation'},{id:'subscriptions',name:'Subscriptions'},{id:'personal',name:'Personal spending'},{id:'savings',name:'Savings allocation'}];
  d.allocations=[['housing',30000],['groceries',15000],['transport',7500],['subscriptions',5000],['personal',10000],['savings',12500]].map(([categoryId,amountCents])=>({id:`a-${categoryId}`,paycheckId:'p',categoryId:String(categoryId),amountCents:Number(amountCents)}));
  d.transactions=[{id:'grocery-expense',description:'Groceries',amountCents:4250,date:'2026-10-02',type:'expense',categoryId:'groceries',allocationId:'a-groceries'}];
  d.accounts=[{id:'checking',name:'Checking',type:'checking',initialBalanceCents:100000},{id:'card',name:'Card',type:'credit_card',initialBalanceCents:20000}];
  d.goals=[{id:'moving',name:'Moving expenses',targetCents:20000,initialSavedCents:0}];
  d.contributions=[{id:'contribution',goalId:'moving',amountCents:5000,date:'2026-10-03'}];
  return d;
}

describe('paycheck, allocation, and savings calculations',()=>{
  it('matches the $1,200 required scenario and keeps allocation separate from contribution',()=>{
    const d=scenario();
    expect(allocatedForPaycheck(d,'p')).toBe(80000);
    expect(unallocatedForPaycheck(d,'p')).toBe(40000);
    expect(allocationSummary(d,d.allocations[1])).toEqual({allocatedCents:15000,spentCents:4250,remainingCents:10750});
    expect(goalSummary(d,d.goals[0])).toEqual({savedCents:5000,remainingCents:15000,progressPercent:25});
  });
  it('allows overspending and preserves negative remaining',()=>{
    const d=scenario(); d.transactions.push({id:'overspend',description:'Large groceries',amountCents:20000,date:'2026-10-04',type:'expense',allocationId:'a-groceries'});
    expect(allocationSummary(d,d.allocations[1]).remainingCents).toBe(-9250);
  });
  it('recalculates allocation spending when an expense is edited or deleted',()=>{
    const d=scenario();
    const edited=upsertRecord(d,'transactions',{...d.transactions[0],amountCents:6000});
    expect(allocationSummary(edited.data,edited.data.allocations[1]).spentCents).toBe(6000);
    const removed=removeRecord(edited.data,'transactions','grocery-expense');
    expect(allocationSummary(removed.data,removed.data.allocations[1]).spentCents).toBe(0);
  });
  it('recalculates contributions after edit and deletion without changing accounts',()=>{
    const d=scenario(), before=accountBalance(d,d.accounts[0]);
    const edited=upsertRecord(d,'contributions',{...d.contributions[0],amountCents:8000});
    expect(edited.error).toBeUndefined();
    expect(goalSummary(edited.data,edited.data.goals[0]).savedCents).toBe(8000);
    const removed=removeRecord(edited.data,'contributions','contribution');
    expect(goalSummary(removed.data,removed.data.goals[0]).savedCents).toBe(0);
    expect(accountBalance(removed.data,removed.data.accounts[0])).toBe(before);
  });
});

describe('account balance convention',()=>{
  it('reduces cash for purchases and increases outstanding card debt',()=>{
    const d=scenario(); const tx={id:'purchase',description:'Purchase',amountCents:1250,date:'2026-10-05',type:'expense' as const,accountId:'checking'};
    d.transactions.push(tx);
    expect(accountBalance(d,d.accounts[0])).toBe(98750);
    d.transactions.push({...tx,id:'card-purchase',accountId:'card'});
    expect(accountBalance(d,d.accounts[1])).toBe(21250);
  });
  it('records card payments as transfers that reduce cash and card debt once',()=>{
    const d=scenario(); d.transactions.push({id:'payment',description:'Card payment',amountCents:5000,date:'2026-10-06',type:'transfer',accountId:'checking',toAccountId:'card'});
    expect(accountBalance(d,d.accounts[0])).toBe(95000);
    expect(accountBalance(d,d.accounts[1])).toBe(15000);
  });
  it('applies both transfer sides and accurately reverses edits and deletes',()=>{
    const d=scenario(); const transfer={id:'move',description:'Transfer',amountCents:4000,date:'2026-10-07',type:'transfer' as const,accountId:'checking',toAccountId:'card'};
    const first=upsertRecord(d,'transactions',transfer).data;
    expect(accountBalance(first,first.accounts[0])).toBe(96000); expect(accountBalance(first,first.accounts[1])).toBe(16000);
    const edited=upsertRecord(first,'transactions',{...transfer,amountCents:6000}).data;
    expect(accountBalance(edited,edited.accounts[0])).toBe(94000); expect(accountBalance(edited,edited.accounts[1])).toBe(14000);
    const removed=removeRecord(edited,'transactions','move').data;
    expect(accountBalance(removed,removed.accounts[0])).toBe(100000); expect(accountBalance(removed,removed.accounts[1])).toBe(20000);
  });
  it('keeps transactions applied once when an account starting balance changes',()=>{
    const d=scenario(); d.transactions.push({id:'purchase',description:'Purchase',amountCents:2000,date:'2026-10-08',type:'expense',accountId:'checking'});
    const account=d.accounts[0];
    expect(accountBalance(d,account)).toBe(98000);
    expect(accountBalance(d,{...account,initialBalanceCents:90000})).toBe(88000);
  });
  it('rejects nonexistent and mismatched transaction associations',()=>{
    const d=scenario();
    expect(validateTransaction(d,{id:'x',description:'Invalid',amountCents:100,date:'2026-10-09',type:'expense',categoryId:'missing'})).toMatch(/category/);
    expect(validateTransaction(d,{id:'x',description:'Invalid',amountCents:100,date:'2026-10-09',type:'income',allocationId:'a-groceries'})).toMatch(/Only expenses/);
    expect(validateTransaction(d,{id:'x',description:'Invalid',amountCents:100,date:'2026-02-31',type:'income'})).toMatch(/date/);
  });
});

describe('dependency-safe deletion and reassignment',()=>{
  it('blocks paycheck, allocation, and category deletion while linked records exist',()=>{
    const d=scenario();
    expect(removeRecord(d,'paychecks','p').error).toMatch(/allocations/);
    expect(removeRecord(d,'allocations','a-groceries').error).toMatch(/expenses/);
    expect(removeRecord(d,'categories','groceries').error).toMatch(/in use/);
  });
  it('allows deletion after dependent records are removed',()=>{
    let d=scenario();
    d=removeRecord(d,'transactions','grocery-expense').data;
    d=removeRecord(d,'allocations','a-groceries').data;
    expect(allocationSummary(d,d.allocations[0]).spentCents).toBe(0);
    expect(removeRecord(d,'categories','groceries').error).toBeUndefined();
    d=removeRecord(d,'categories','groceries').data;
    for (const allocation of [...d.allocations]) d=removeRecord(d,'allocations',allocation.id).data;
    expect(unallocatedForPaycheck(d,'p')).toBe(120000);
    expect(removeRecord(d,'paychecks','p').error).toBeUndefined();
  });
  it('preserves spending when allocation is reassigned to a different category',()=>{
    const d=scenario(); d.categories.push({id:'food',name:'Food'});
    const result=upsertRecord(d,'allocations',{...d.allocations[1],categoryId:'food'});
    expect(result.error).toBeUndefined(); expect(result.data.transactions[0].categoryId).toBe('food');
    expect(allocationSummary(result.data,result.data.allocations[1]).spentCents).toBe(4250);
  });
});
