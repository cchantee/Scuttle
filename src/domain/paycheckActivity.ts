import { AppData, Paycheck, Transaction } from './models';
import { currentPaycheck } from './navigation';
import { todayISODate } from './date';
import { calculateNextPayday } from './date';
import { nextSubscriptionDue } from './calculations';
export function dayAfter(date: string): string { return new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0,10); }
/** End-exclusive paycheck period; a bill due on the next payday belongs to that next paycheck. */
export function paycheckPeriodEnd(data: AppData, paycheck: Paycheck): string {
  const next = data.paychecks.filter(p => p.id !== paycheck.id && p.receivedAt > paycheck.receivedAt).sort((a,b)=>a.receivedAt.localeCompare(b.receivedAt))[0];
  return next?.receivedAt ?? calculateNextPayday(paycheck.receivedAt,dayAfter(paycheck.receivedAt),data.user.paydayFrequency ?? 'biweekly',data.user.paydayIntervalDays) ?? new Date(Date.parse(`${paycheck.receivedAt}T00:00:00Z`)+14*86400000).toISOString().slice(0,10);
}
export function transactionInPaycheck(data: AppData, tx: Transaction, paycheck?: Paycheck): boolean {
  if (!paycheck || tx.type === 'subscription') return false;
  const linked = tx.paycheckId ?? data.allocations.find(a=>a.id===tx.allocationId)?.paycheckId;
  if (linked) return linked === paycheck.id;
  return tx.date >= paycheck.receivedAt && tx.date < paycheckPeriodEnd(data,paycheck);
}
export function remindersForPaycheck(data: AppData, paycheck: Paycheck) {
  const end = paycheckPeriodEnd(data,paycheck);
  return data.transactions.filter(t=>t.type==='subscription').flatMap(transaction=>{
    const dueDates: string[]=[];
    let due=nextSubscriptionDue(transaction,paycheck.receivedAt);
    while(due && due<end && dueDates.length<366){dueDates.push(due);due=nextSubscriptionDue(transaction,dayAfter(due));}
    return dueDates.map(dueDate=>({transaction,dueDate}));
  }).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
}
export function newlyReceivedPaychecks(before: AppData, after: AppData): Paycheck[] {
  // A researcher reset replaces history; it is not a participant receipt event.
  if(before.paychecks.some(p=>!after.paychecks.some(a=>a.id===p.id)))return [];
  return after.paychecks.filter(p=>p.status!=='planned' && (!before.paychecks.some(b=>b.id===p.id) || before.paychecks.find(b=>b.id===p.id)?.status==='planned'));
}

/** The fixed snapshot stays fixed; a newly received scenario paycheck supplies the earliest draft date. */
export function defaultActivityDate(data: AppData): string {
  const today=todayISODate(data.user), received=currentPaycheck(data)?.receivedAt;
  return received && received>today ? received : today;
}
