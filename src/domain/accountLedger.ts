import { committedForAccount } from './goalFunds';
import { AppData } from './models';
import { accountBalance } from './calculations';

/** Guard the complete affected cash ledger, including backdated edits and both transfer sides.
 * Date-only records settle deposits before expenses and transfers on the same date.
 */
export function cashLedgerError(data: AppData, ids: (string | undefined)[]): string | undefined {
  const accounts = data.accounts.filter(a => a.type !== 'credit_card' && ids.includes(a.id));
  if (!accounts.length) return;
  const prefix: AppData = { ...data, paychecks: [], transactions: [] };
  const events = [
    ...data.paychecks.filter(p => p.status !== 'planned').map(p => ({ date:p.receivedAt, order:0, post:()=>{prefix.paychecks.push(p);} })),
    ...data.transactions.filter(t => t.type !== 'subscription').map(t => ({ date:t.date, order:t.type==='income'?0:t.type==='expense'?1:2, post:()=>{prefix.transactions.push(t);} })),
  ].sort((a,b)=>a.date.localeCompare(b.date)||a.order-b.order);
  for (const event of events) {
    event.post();
    for (const account of accounts) {
      const balance = accountBalance(prefix,account);
      if (balance < 0) return `This transaction would overdraw ${account.name} on ${event.date} by $${(-balance/100).toFixed(2)}. Choose another account or adjust the amount or date.`;
    }
  }
  for (const account of accounts) if (accountBalance(data,account) < committedForAccount(data,account.id)) return `This money is committed to savings goals in ${account.name}. Choose uncommitted funds instead.`;
}
