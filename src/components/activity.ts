import { AppData } from '../domain/models';

export interface ActivityRow {
  id: string; recordId: string; date: string; title: string; detail: string; amountCents: number;
  kind: 'paycheck' | 'allocation' | 'expense' | 'income' | 'transfer' | 'subscription' | 'contribution';
  sign: '+' | '−' | ''; categoryId?: string; paycheckId?: string; accountId?: string; toAccountId?: string;
  collection: 'paychecks' | 'allocations' | 'transactions' | 'contributions';
  route: '/paycheck/[id]' | '/allocation/[id]' | '/transactions' | '/goal/[id]';
  params: { id: string } | { editId: string };
}
/** Presentation only: never combines transfers, allocations, or plans into income/spending. */
export function activityRows(data: AppData): ActivityRow[] {
  const accounts = (id?: string) => data.accounts.find(a => a.id === id)?.name;
  const rows: ActivityRow[] = data.paychecks.map(p => ({
    id: `p-${p.id}`, recordId: p.id, date: p.receivedAt, title: p.source || 'Paycheck',
    detail: `${p.status === 'planned' ? 'Planned paycheck · not received' : 'Paycheck received'}${p.accountId ? ` · ${accounts(p.accountId) || 'Account'}` : ''}`,
    amountCents: p.amountCents, kind: 'paycheck', sign: p.status === 'planned' ? '' : '+',
    paycheckId: p.id, accountId: p.accountId, collection: 'paychecks', route: '/paycheck/[id]', params: { id: p.id },
  }));
  for (const a of data.allocations) rows.push({
    id: `a-${a.id}`, recordId: a.id, date: data.paychecks.find(p => p.id === a.paycheckId)?.receivedAt || '',
    title: data.categories.find(c => c.id === a.categoryId)?.name || 'Category', detail: `Budget allocation · ${data.paychecks.find(p => p.id === a.paycheckId)?.source || 'Paycheck'} · no account movement`,
    amountCents: a.amountCents, kind: 'allocation', sign: '', categoryId: a.categoryId, paycheckId: a.paycheckId,
    collection: 'allocations', route: '/allocation/[id]', params: { id: a.id },
  });
  for (const t of data.transactions) rows.push({
    id: `t-${t.id}`, recordId: t.id, date: t.date, title: t.description,
    detail: `${t.type === 'subscription' ? 'Scheduled reminder' : t.type[0].toUpperCase() + t.type.slice(1)}${accounts(t.accountId) ? ` · ${accounts(t.accountId)}` : ''}${t.toAccountId ? ` → ${accounts(t.toAccountId) || 'Account'}` : ''}${t.categoryId ? ` · ${data.categories.find(c => c.id === t.categoryId)?.name || 'Category'}` : ''}`,
    amountCents: t.amountCents, kind: t.type, sign: t.type === 'expense' ? '−' : t.type === 'income' ? '+' : '',
    categoryId: t.categoryId, accountId: t.accountId, toAccountId: t.toAccountId,
    paycheckId: t.paycheckId || data.allocations.find(a => a.id === t.allocationId)?.paycheckId,
    collection: 'transactions', route: '/transactions', params: { editId: t.id },
  });
  for (const c of data.contributions) rows.push({
    id: `c-${c.id}`, recordId: c.id, date: c.date, title: data.goals.find(g => g.id === c.goalId)?.name || 'Savings goal',
    detail: c.paycheckId ? `${data.paychecks.find(p => p.id === c.paycheckId)?.status === 'planned' ? 'Planned' : 'Paycheck'} goal allocation · ${data.paychecks.find(p => p.id === c.paycheckId)?.source || 'Paycheck'} · not transferred` : `${c.status === 'pending' ? 'Pending reservation' : c.status === 'posted' ? 'Posted contribution' : 'Goal designation'}${c.note ? ` · ${c.note}` : ''}`,
    amountCents: c.amountCents, kind: 'contribution', sign: '', paycheckId: c.paycheckId, accountId: c.accountId,
    collection: 'contributions', route: '/goal/[id]', params: { id: c.goalId },
  });
  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
export interface ActivityFilters { search: string; from: string; to: string; categoryId: string; paycheckId: string; accountId: string; kind: string }
export function filterActivity(rows: ActivityRow[], filters: ActivityFilters) {
  const query = filters.search.trim().toLowerCase();
  return rows.filter(row => (!query || `${row.title} ${row.detail} ${row.date}`.toLowerCase().includes(query)) &&
    (!filters.from || row.date >= filters.from) && (!filters.to || row.date <= filters.to) &&
    (!filters.categoryId || row.categoryId === filters.categoryId) && (!filters.paycheckId || row.paycheckId === filters.paycheckId) &&
    (!filters.accountId || row.accountId === filters.accountId || row.toAccountId === filters.accountId) && (!filters.kind || filters.kind === 'all' || (filters.kind === 'money' ? ['income', 'expense', 'transfer'].includes(row.kind) || (row.kind === 'paycheck' && row.sign === '+') : row.kind === filters.kind)));
}
