import { describe, expect, it } from 'vitest';
import { emptyData } from '../domain/models';
import { activityRows, filterActivity, ActivityFilters } from './activity';
const filters: ActivityFilters = { search: '', from: '', to: '', categoryId: '', paycheckId: '', accountId: '', kind: '' };
function fixture() {
  const d = emptyData();
  d.accounts = [{ id: 'a', name: 'Checking', type: 'checking', initialBalanceCents: 0 }, { id: 'b', name: 'Savings', type: 'savings', initialBalanceCents: 0 }];
  d.paychecks = [{ id: 'p', status: 'planned', amountCents: 120000, receivedAt: '2026-11-10', source: 'Work' }];
  d.categories = [{ id: 'food', name: 'Groceries' }];
  d.allocations = [{ id: 'al', paycheckId: 'p', categoryId: 'food', amountCents: 20000 }];
  d.goals = [{ id: 'g', name: 'Moving', targetCents: 100000, initialSavedCents: 0 }];
  d.contributions = [{ id: 'c', paycheckId: 'p', goalId: 'g', amountCents: 5000, date: '2026-11-02', status: 'allocated' }];
  d.transactions = [{ id: 't', description: 'Save some', type: 'transfer', accountId: 'a', toAccountId: 'b', amountCents: 10000, date: '2026-11-01' }];
  return d;
}
describe('activity presentation', () => {
  it('labels plans, goal allocations and transfers without presenting them as completed income or expenses', () => {
    const d = fixture();
    const original = JSON.stringify(d);
    const rows = activityRows(d);
    expect(rows.find(r => r.kind === 'paycheck')).toMatchObject({ sign: '', detail: 'Planned paycheck · not received' });
    expect(rows.find(r => r.kind === 'contribution')).toMatchObject({ sign: '', paycheckId: 'p', detail: 'Planned goal allocation · not transferred' });
    expect(rows.find(r => r.kind === 'transfer')).toMatchObject({ sign: '', detail: 'Transfer · Checking → Savings' });
    expect(JSON.stringify(d)).toBe(original);
  });
  it('signs actual income and spending and keeps reminders neutral', () => {
    const d = fixture();
    d.paychecks[0].status = 'received';
    for (const type of ['income', 'expense', 'subscription'] as const) d.transactions.push({ id: type, type, description: type, amountCents: 100, date: '2026-11-02' });
    const rows = activityRows(d);
    expect(rows.find(r => r.kind === 'paycheck')?.sign).toBe('+');
    expect(rows.find(r => r.kind === 'income')?.sign).toBe('+');
    expect(rows.find(r => r.kind === 'expense')?.sign).toBe('−');
    expect(rows.find(r => r.kind === 'subscription')?.sign).toBe('');
  });
  it('matches a transfer on either account, and combines date and text filters', () => {
    const rows = activityRows(fixture());
    expect(filterActivity(rows, { ...filters, accountId: 'b', search: 'checking', from: '2026-11-01', to: '2026-11-01' })).toHaveLength(1);
    expect(filterActivity(rows, { ...filters, accountId: 'b', from: '2026-11-02' })).toHaveLength(0);
  });
  it('retains paycheck and category filtering and direct record routes', () => {
    const rows = activityRows(fixture());
    expect(filterActivity(rows, { ...filters, paycheckId: 'p' })).toHaveLength(3);
    expect(filterActivity(rows, { ...filters, categoryId: 'food' })).toHaveLength(1);
    expect(filterActivity(rows, { ...filters, kind: 'transfer' })[0]).toMatchObject({ route: '/transactions', params: { editId: 't' }, collection: 'transactions', recordId: 't' });
  });
  it('handles empty data and sorts by date without mutating financial records', () => {
    expect(activityRows(emptyData())).toEqual([]);
    expect(activityRows(fixture()).map(r => r.date)).toEqual(['2026-11-10', '2026-11-10', '2026-11-02', '2026-11-01']);
  });
});
