import { goalOverview } from './goalOverview';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { parseMoney } from './money';
import { currentPaycheck, paycheckDestination } from './navigation';
import { buildJordanTaylorSnapshot, verifyJordanTaylorStartingData } from './jordanStudy';
import { billPaymentDraft, ledgerType, transactionKind, transactionTypeLabel } from './transactionKinds';
import { upsertRecord } from './store';
import { accountBalance, allocationSummary } from './calculations';
import { filterHistory, historyRows, historyTotals } from './history';

describe('amount validation without render-time parsing',()=>{
  it('rejects empty and intermediate input with a friendly Error instead of a Zod stack',()=>{
    for(const value of ['','.','-','abc','1.234','-12','1e3']){
      try{parseMoney(value);throw new Error('Expected invalid input');}catch(error){expect(error).toBeInstanceOf(Error);expect(error).not.toBeInstanceOf(ZodError);expect((error as Error).message).toContain('Enter a valid');}
    }
  });
  it('parses ordinary currency and leading decimal input without rounding away precision',()=>{
    expect(parseMoney('$1,234.50')).toBe(123450);expect(parseMoney('.50')).toBe(50);expect(parseMoney('12.')).toBe(1200);expect(parseMoney('0')).toBe(0);
  });
});

describe('consistent primary paycheck destination',()=>{
  it('resolves the active paycheck for both Home and the navigation bar',()=>{
    const data=buildJordanTaylorSnapshot('id');
    expect(currentPaycheck(data)!.id).toBe('jordan:paycheck:4');
    expect(paycheckDestination(data)).toEqual({pathname:'/paycheck/[id]',params:{id:'jordan:paycheck:4'}});
  });
  it('skips planned/archived pay and uses the newest insertion when dates match',()=>{
    const data=buildJordanTaylorSnapshot('id');
    data.paychecks.push({id:'same-date',receivedAt:'2026-10-23',amountCents:10000});
    data.paychecks.push({id:'planned',status:'planned',receivedAt:'2026-11-06',amountCents:85000});
    expect(currentPaycheck(data)!.id).toBe('same-date');
    expect(paycheckDestination({...data,paychecks:[]})).toBe('/paychecks');
  });
});

describe('Bill entries preserve existing ledger rules',()=>{
  it('records a paid bill once against its account and budget while permitting category overspending',()=>{
    const data=buildJordanTaylorSnapshot('id');
    const result=upsertRecord(data,'transactions',{id:'bill',type:ledgerType('bill',false),purpose:'bill',description:'Rent payment',amountCents:10000,date:'2026-11-05',categoryId:'jordan:category:rent'});
    expect(result.error).toBeUndefined();expect(result.data.transactions).toHaveLength(data.transactions.length+1);
    const bill=result.data.transactions.find(t=>t.id==='bill')!;
    expect(bill.accountId).toBe('jordan:checking');expect(transactionKind(result.data,bill)).toBe('bill');
    expect(accountBalance(result.data,data.accounts[0])).toBe(14500);expect(accountBalance(result.data,data.accounts[1])).toBe(68000);
    const allocation=result.data.allocations.find(a=>a.id===bill.allocationId)!;
    expect(allocationSummary(result.data,allocation).remainingCents).toBe(-42500);
  });
  it('keeps a scheduled bill neutral and distinguishes rent from a subscription',()=>{
    const data=buildJordanTaylorSnapshot('id');
    const result=upsertRecord(data,'transactions',{id:'bill-reminder',type:ledgerType('bill',true),purpose:'bill',description:'Rent',amountCents:65000,date:'2026-11-05',subscriptionFrequency:'monthly',nextDueDate:'2026-12-01',accountId:'jordan:checking',categoryId:'jordan:category:rent'});
    expect(result.error).toBeUndefined();expect(accountBalance(result.data,data.accounts[0])).toBe(24500);
    expect(transactionTypeLabel(result.data,result.data.transactions.at(-1)!)).toBe('Scheduled bill');
    expect(transactionKind(data,data.transactions.find(t=>t.description==='StreamFlix'&&t.type==='subscription')!)).toBe('subscription');
    expect(transactionKind(data,data.transactions.find(t=>t.description==='Campus Apartment Rent')!)).toBe('bill');
    verifyJordanTaylorStartingData(data);
  });
  it('records a scheduled bill payment against its existing planned allocation without charging the reminder',()=>{
    let data=buildJordanTaylorSnapshot('id');
    const reminder={id:'rent-reminder',type:'subscription' as const,purpose:'bill' as const,description:'Rent share',amountCents:10000,date:'2026-11-05',nextDueDate:'2026-12-01',subscriptionFrequency:'monthly' as const,categoryId:'jordan:category:rent',accountId:'jordan:checking'};
    data=upsertRecord(data,'transactions',reminder).data;
    data=upsertRecord(data,'allocations',{id:'planned-rent',paycheckId:'jordan:paycheck:4',categoryId:'jordan:category:rent',amountCents:10000,subscriptionId:reminder.id}).data;
    const draft=billPaymentDraft(data,reminder,'2026-11-05');
    expect(draft.allocationId).toBe('planned-rent');
    const saved=upsertRecord(data,'transactions',{id:'rent-payment',...draft});
    expect(saved.error).toBeUndefined();expect(accountBalance(saved.data,data.accounts[0])).toBe(14500);
    expect(saved.data.transactions.find(t=>t.id===reminder.id)).toEqual(reminder);
    expect(allocationSummary(saved.data,saved.data.allocations.find(a=>a.id==='planned-rent')!).remainingCents).toBe(0);
  });
  it('still blocks an unaffordable bill without mutating any financial records',()=>{
    const data=buildJordanTaylorSnapshot('id');const result=upsertRecord(data,'transactions',{id:'too-much',type:'expense',purpose:'bill',description:'Bill',amountCents:24501,date:'2026-11-05',accountId:'jordan:checking'});
    expect(result.error).toMatch(/overdraw/);expect(result.data).toBe(data);
  });
});

describe('financial history stays distinct from planning',()=>{
  it('counts each actual paycheck/expense once, excluding transfers, allocations, goals and reminders',()=>{
    const data=buildJordanTaylorSnapshot('id'),rows=historyRows(data);
    expect(historyTotals(rows)).toEqual({income:348500,spending:324000});
    expect(rows.filter(r=>r.kind==='transfer')).toHaveLength(3);
    expect(rows.filter(r=>r.kind==='planning').every(r=>r.cashEffect===null)).toBe(true);
    expect(rows.some(r=>r.detail==='Budget allocation · no money moved')).toBe(true);
  });
  it('opens the exact record rather than a generic list and filters transfer destination accounts',()=>{
    const data=buildJordanTaylorSnapshot('id'),rows=historyRows(data);
    expect(rows.find(r=>r.id==='pay:jordan:paycheck:4')!.destination).toEqual(paycheckDestination(data));
    expect(rows.find(r=>r.id==='transaction:jordan:expense:1')!.destination.params).toEqual({editId:'jordan:expense:1'});
    expect(filterHistory(rows,{accountId:'jordan:savings',kind:'transfer'})).toHaveLength(3);
    expect(filterHistory(rows,{search:'streamflix'}).every(r=>/StreamFlix/.test(r.title))).toBe(true);
  });
  it('filters inclusive dates and excludes planned pay from received-income totals',()=>{
    const data=buildJordanTaylorSnapshot('id');data.paychecks.push({id:'future',status:'planned',receivedAt:'2026-11-06',amountCents:85000});
    const rows=historyRows(data),today=filterHistory(rows,{from:'2026-11-02',to:'2026-11-02',kind:'expense'});
    expect(today).toHaveLength(1);expect(today[0].title).toBe('Unexpected Car Repair');
    expect(historyTotals(rows)).toEqual({income:348500,spending:324000});
  });
});

it('shows identical set-aside/reserved goal totals on Home and Goals without changing account balances',()=>{
  const data=buildJordanTaylorSnapshot('id');
  expect(goalOverview(data)).toEqual({setAsideCents:12000,reservedCents:12000,targetCents:100000,progressPercent:12});
  expect(accountBalance(data,data.accounts[1])).toBe(68000);
});
