import { AppData } from './models';
import { accountBalance, allocationSummary, goalSaved } from './calculations';
import { goalHoldingAccount } from './goalFunds';
import { formatMoney } from './money';
import { formatDateDisplay } from './date';
import { transactionTypeLabel } from './transactionKinds';

export interface ScuttleSearchResult {
  key: string; label: string; detail: string;
  destination: { pathname: string; params?: Record<string, string> };
}
const normalize = (value: string) => value.toLowerCase().replace(/[$,]/g, '').replace(/[_\s]+/g, ' ').trim();
/** Human interface search only: a read-only index of records and existing destinations. */
export function searchScuttle(data: AppData, input: string): ScuttleSearchResult[] {
  const words = normalize(input).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const rows: (ScuttleSearchResult & { terms: string })[] = [];
  const account = (id?: string) => data.accounts.find(a => a.id === id)?.name ?? '';
  const category = (id?: string) => data.categories.find(c => c.id === id)?.name ?? '';
  const paycheck = (id?: string) => data.paychecks.find(p => p.id === id);
  const dates = (date?: string) => date ? `${date} ${formatDateDisplay(date)}` : '';
  const add = (key: string, label: string, detail: string, pathname: string, params?: Record<string,string>, terms = '') => rows.push({key,label,detail,destination:{pathname, ...(params ? {params} : {})},terms});
  for (const p of data.paychecks) add(`pay:${p.id}`, p.source?.trim() || 'Paycheck', `Paycheck · ${formatDateDisplay(p.receivedAt)} · ${formatMoney(p.amountCents)}`, '/paycheck/[id]', {id:p.id}, `${dates(p.receivedAt)} ${dates(p.expectedAt)} ${p.notes ?? ''} ${p.status === 'planned' ? 'planned expected' : 'received income'} ${account(p.accountId)} ${account(p.remainingAccountId)}`);
  for (const a of data.accounts) add(`account:${a.id}`,a.name,`Account · ${formatMoney(accountBalance(data,a))}`,'/account/[id]',{id:a.id},`${a.type} ${a.notes ?? ''} ${a.interestRatePercent ?? 0}% APY`);
  for (const g of data.goals) add(`goal:${g.id}`,g.name,`Savings goal · ${formatMoney(goalSaved(data,g.id))} of ${formatMoney(g.targetCents)}`,'/goal/[id]',{id:g.id},dates(g.targetDate));
  for (const c of data.categories) add(`category:${c.id}`,c.name,'Budget category','/budget');
  for (const a of data.allocations) {
    const p=paycheck(a.paycheckId), summary=allocationSummary(data,a);
    add(`allocation:${a.id}`,category(a.categoryId),`Budget allocation · ${formatMoney(a.amountCents)} · ${formatDateDisplay(p?.receivedAt ?? '')}`,'/allocation/[id]',{id:a.id},`${p?.source ?? ''} ${dates(p?.receivedAt)} ${account(p?.remainingAccountId ?? p?.accountId)} ${formatMoney(summary.remainingCents)} remaining`);
  }
  for (const t of data.transactions) {
    const allocation=data.allocations.find(a=>a.id===t.allocationId), p=paycheck(t.paycheckId ?? allocation?.paycheckId);
    const date=t.type==='subscription'?t.nextDueDate ?? t.date:t.date;
    add(`transaction:${t.id}`,t.description,`${transactionTypeLabel(data,t)} · ${formatDateDisplay(date)} · ${formatMoney(t.amountCents)}`,'/transactions',{editId:t.id},`${t.type} ${t.type==='subscription'?'recurring reminder subscription bill':''} ${dates(t.date)} ${dates(t.nextDueDate)} ${category(t.categoryId ?? allocation?.categoryId)} ${account(t.accountId)} ${account(t.toAccountId)} ${t.notes ?? ''} ${p?.source ?? ''}`);
  }
  for (const c of data.contributions) {
    const name=data.goals.find(g=>g.id===c.goalId)?.name ?? 'Savings goal';
    const status=c.status==='pending'?'Reserved':c.status==='allocated'?'Allocated':'Saved';
    add(`contribution:${c.id}`,name,`${status} contribution · ${formatMoney(c.amountCents)} · ${formatDateDisplay(c.date)}`,'/goal/[id]',{id:c.goalId},`${dates(c.date)} ${account(goalHoldingAccount(data,c))} ${c.note ?? ''} savings`);
  }
  for(const [label,path,aliases] of [
    ['Accounts','/accounts','balances cash checking savings'],['Paychecks','/paychecks','income salary payday'],
    ['Budget categories','/budget','budgets allocations'],['Savings goals','/goals','goals saving'],
    ['Transactions','/transactions','expenses income bills recurring subscriptions'],['Financial history','/history','activity records past'],
    ['Profile','/profile','name personal details'],['More and settings','/more','settings preferences'],
    ['Add transaction','/transaction/new','record expense purchase bill'],['Add to goal','/add-to-goal','reserve contribution save'],
    ['Create savings goal','/goal/new','new goal'],['Move money','/move-money','transfer accounts'],
  ]) add(`page:${path}`,label,'Page',path,undefined,aliases);
  return rows.filter(r=>words.every(word=>normalize(`${r.label} ${r.detail} ${r.terms}`).includes(word))).map(({terms,...result})=>result);
}
