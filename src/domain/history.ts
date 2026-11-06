import { AppData } from './models';
import { transactionTypeLabel } from './transactionKinds';
export type HistoryKind='income'|'expense'|'transfer'|'planning';
export interface HistoryRow {
  id:string;date:string;title:string;detail:string;amountCents:number;kind:HistoryKind;cashEffect:number|null;
  categoryId?:string;accountId?:string;toAccountId?:string;paycheckId?:string;
  destination:{pathname:string;params?:Record<string,string>};
}
export interface HistoryFilters {from?:string;to?:string;categoryId?:string;accountId?:string;paycheckId?:string;kind?:HistoryKind|'all';search?:string}
export function historyRows(data:AppData):HistoryRow[]{
  const rows:HistoryRow[]=[];
  for(const p of data.paychecks)rows.push({id:`pay:${p.id}`,date:p.receivedAt,title:p.source||'Paycheck',detail:`${p.status==='planned'?'Planned paycheck · no deposit':'Paycheck received'}${p.accountId?` · ${data.accounts.find(a=>a.id===p.accountId)?.name??'Account'}`:''}`,amountCents:p.amountCents,kind:p.status==='planned'?'planning':'income',cashEffect:p.status==='planned'?null:p.amountCents,paycheckId:p.id,accountId:p.accountId,destination:{pathname:'/paycheck/[id]',params:{id:p.id}}});
  for(const a of data.allocations){const p=data.paychecks.find(p=>p.id===a.paycheckId);rows.push({id:`allocation:${a.id}`,date:p?.receivedAt??'',title:data.categories.find(c=>c.id===a.categoryId)?.name??'Category',detail:'Budget allocation · no money moved',amountCents:a.amountCents,kind:'planning',cashEffect:null,categoryId:a.categoryId,paycheckId:a.paycheckId,accountId:p?.remainingAccountId??p?.accountId,destination:{pathname:'/allocation/[id]',params:{id:a.id}}});}
  for(const tx of data.transactions){const allocation=data.allocations.find(a=>a.id===tx.allocationId);rows.push({id:`transaction:${tx.id}`,date:tx.type==='subscription'?tx.nextDueDate??tx.date:tx.date,title:tx.description,detail:`${transactionTypeLabel(data,tx)}${tx.accountId?` · ${data.accounts.find(a=>a.id===tx.accountId)?.name??'Account'}`:''}${tx.type==='subscription'?' · no money moved':''}`,amountCents:tx.amountCents,kind:tx.type==='expense'?'expense':tx.type==='income'?'income':tx.type==='transfer'?'transfer':'planning',cashEffect:tx.type==='expense'?-tx.amountCents:tx.type==='income'?tx.amountCents:null,categoryId:tx.categoryId,paycheckId:tx.paycheckId??allocation?.paycheckId,accountId:tx.accountId,toAccountId:tx.toAccountId,destination:{pathname:'/transactions',params:{editId:tx.id}}});}
  for(const c of data.contributions)rows.push({id:`goal:${c.id}`,date:c.date,title:data.goals.find(g=>g.id===c.goalId)?.name??'Savings goal',detail:c.status==='pending'?'Goal reservation · money stays in your account':'Goal contribution · account activity recorded separately',amountCents:c.amountCents,kind:'planning',cashEffect:null,paycheckId:c.paycheckId,accountId:c.accountId,destination:{pathname:'/goal/[id]',params:{id:c.goalId}}});
  return rows.sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
}
export function filterHistory(rows:HistoryRow[],filters:HistoryFilters){
  const query=filters.search?.trim().toLowerCase();
  return rows.filter(row=>(!filters.from||row.date>=filters.from)&&(!filters.to||row.date<=filters.to)&&(!filters.categoryId||row.categoryId===filters.categoryId)&&(!filters.accountId||row.accountId===filters.accountId||row.toAccountId===filters.accountId)&&(!filters.paycheckId||row.paycheckId===filters.paycheckId)&&(!filters.kind||filters.kind==='all'||row.kind===filters.kind)&&(!query||`${row.title} ${row.detail} ${row.date}`.toLowerCase().includes(query)));
}
export function historyTotals(rows:HistoryRow[]){
  return {income:rows.filter(r=>r.kind==='income').reduce((n,r)=>n+r.amountCents,0),spending:rows.filter(r=>r.kind==='expense').reduce((n,r)=>n+r.amountCents,0)};
}
