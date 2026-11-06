import { describe, expect, it, vi } from 'vitest';
import { auditJordanAccountHistory, assertJordanHasNoOverdrafts, buildJordanTaylorSnapshot, historicalExpenses, allocationRows, recurringBills, verifyJordanTaylorStartingData, STUDY_DATE } from './jordanStudy';
import { accountBalance, accountBalanceAt, allocationSummary, availableAccountBalance, goalSummary, unallocatedForPaycheck } from './calculations';
import { calculateNextPayday, todayISODate } from './date';
import { migrateAppData } from './migrations';
import { upsertRecord } from './store';
import { confirmAndResetJordan, resetJordan, RESET_SUCCESS, RESET_TITLE, RESET_WARNING, verifyLiveJordan } from '../../scripts/jordan-reset';
import { SupabaseClient } from '@supabase/supabase-js';

describe('fixed Jordan study snapshot', () => {
  it('never overdraws either account after any event, including each transfer', () => {
    const data = buildJordanTaylorSnapshot('id');
    const rows = auditJordanAccountHistory(data);
    expect(rows).toHaveLength(1 + data.paychecks.length + data.transactions.length);
    for (const row of rows) {
      for (const account of data.accounts) expect(row.balances[account.id], `${row.date} ${row.description} ${account.name}`).toBeGreaterThanOrEqual(0);
    }
    expect(Math.min(...rows.map(row => row.balances['jordan:checking']))).toBe(10200);
    expect(Math.min(...rows.map(row => row.balances['jordan:savings']))).toBe(50000);
    for (const transfer of data.transactions.filter(t => t.type === 'transfer')) {
      const index = rows.findIndex(row => row.eventId === transfer.id);
      expect(rows[index].balances[transfer.accountId!] - rows[index-1].balances[transfer.accountId!]).toBe(-transfer.amountCents);
      expect(rows[index].balances[transfer.toAccountId!] - rows[index-1].balances[transfer.toAccountId!]).toBe(transfer.amountCents);
    }
    for (const date of new Set(rows.map(row => row.date))) {
      const endOfDay = rows.filter(row => row.date === date).at(-1)!;
      for (const account of data.accounts) expect(endOfDay.balances[account.id]).toBe(accountBalanceAt(data,account,date));
    }
  });

  it('refuses to reset a fixture with a historical overdraft even when final balances reconcile', () => {
    const data = buildJordanTaylorSnapshot('id');
    data.transactions.find(t => t.id === 'jordan:expense:1')!.date = '2026-09-07';
    expect(accountBalance(data,data.accounts[0])).toBe(24500);
    expect(() => verifyJordanTaylorStartingData(data)).toThrow('Jordan fixture overdrafts');
    expect(() => assertJordanHasNoOverdrafts(data)).toThrow('2026-09-07');
  });

  it('allows an over-budget category while bank balances stay positive, without duplicate withdrawals', () => {
    const data = buildJordanTaylorSnapshot('id');
    const allocation = data.allocations.find(a => a.paycheckId === 'jordan:paycheck:4' && a.categoryId === 'jordan:category:groceries')!;
    expect(allocationSummary(data,allocation)).toEqual({ allocatedCents: 10000, spentCents: 14000, remainingCents: -4000 });
    expect(accountBalance(data,data.accounts[0])).toBe(24500);
    const beforePurchase = { ...data, transactions: data.transactions.filter(t => t.id !== 'jordan:expense:31') };
    expect(accountBalance(beforePurchase,data.accounts[0]) - accountBalance(data,data.accounts[0])).toBe(14000);
    expect(data.transactions).toHaveLength(44);
    expect(data.transactions.filter(t => t.type === 'transfer')).toHaveLength(3);
    expect(() => assertJordanHasNoOverdrafts(data)).not.toThrow();
  });

  it('preserves all 33 dated/category expenses and reconciles the entire ledger', () => {
    const data = buildJordanTaylorSnapshot('existing-auth-id');
    verifyJordanTaylorStartingData(data);
    expect(data.user.id).toBe('existing-auth-id');
    const expenses = data.transactions.filter(t => t.type === 'expense');
    expect(expenses.map(t => [t.date, t.description, data.categories.find(c => c.id === t.categoryId)!.name, t.amountCents])).toEqual(historicalExpenses);
    expect(expenses.reduce((n,t) => n+t.amountCents,0)).toBe(324000);
    expect(data.transactions).toHaveLength(44);
    expect(accountBalanceAt(data, data.accounts[0], '2026-09-06')).toBe(18000);
    expect(accountBalanceAt(data, data.accounts[1], '2026-09-06')).toBe(50000);
    expect(accountBalance(data, data.accounts[0])).toBe(24500);
    expect(accountBalance(data, data.accounts[1])).toBe(68000);
    expect(data.transactions.filter(t => t.interestPosting)).toEqual([]);
  });

  it('keeps exact category allocations, implicit zero allocations, and realistic overspending', () => {
    const data = buildJordanTaylorSnapshot('id');
    data.paychecks.forEach((p,i) => {
      allocationRows.forEach(row => {
        const c = data.categories.find(c => c.name === row[0])!;
        expect(data.allocations.find(a => a.paycheckId === p.id && a.categoryId === c.id)?.amountCents ?? 0).toBe(Number(row[i+1])*100);
      });
      expect(unallocatedForPaycheck(data,p.id)).toBe([5700,6200,7700,12700][i]);
    });
    expect(data.allocations.some(a => allocationSummary(data,a).remainingCents < 0)).toBe(true);
    const noPlans = { ...data, allocations: [] };
    expect(accountBalance(noPlans,data.accounts[0])).toBe(24500);
    expect(accountBalance(noPlans,data.accounts[1])).toBe(68000);
  });

  it('reserves $120 without transferring it or changing the $680 bank balance', () => {
    const data = buildJordanTaylorSnapshot('id');
    expect(goalSummary(data,data.goals[0])).toMatchObject({ savedCents: 12000, progressPercent: 12 });
    expect(availableAccountBalance(data,data.accounts[1])).toBe(56000);
    expect(accountBalance({ ...data, contributions: [] },data.accounts[1])).toBe(68000);
    expect(data.contributions).toHaveLength(1);
    expect(data.goals).toHaveLength(1);
  });

  it('keeps five reminders separate from paid expenses and verifies all due dates', () => {
    const data = buildJordanTaylorSnapshot('id');
    expect(data.transactions.filter(t => t.type === 'subscription').map(t => [t.description, data.categories.find(c => c.id === t.categoryId)!.name, t.amountCents, t.nextDueDate])).toEqual(recurringBills);
    expect(accountBalance({ ...data, transactions: data.transactions.filter(t => t.type !== 'subscription') },data.accounts[0])).toBe(24500);
  });

  it('leaves participant tasks incomplete and credits the new paycheck exactly once', () => {
    const data = buildJordanTaylorSnapshot('id');
    verifyJordanTaylorStartingData(data);
    expect(data.goals.some(g => g.name === 'Moving Fund')).toBe(false);
    expect(data.contributions.some(c => c.amountCents === 30000)).toBe(false);
    const result = upsertRecord(data,'paychecks',{ id: 'participant:paycheck', amountCents: 85000, status: 'received', receivedAt: '2026-11-06', accountId: data.accounts[0].id, accountCreditCents: 85000, source: 'Campus Bookstore' });
    expect(result.error).toBeUndefined();
    expect(accountBalance(result.data,data.accounts[0])).toBe(109500);
    expect(accountBalance(result.data,data.accounts[1])).toBe(68000);
  });

  it('remains identical across resets and real clock changes, including persistence migration', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-05T12:00:00Z'));
      const first = buildJordanTaylorSnapshot('same-id');
      first.transactions.pop(); // Simulate participant changes; next reset replaces them.
      vi.setSystemTime(new Date('2027-08-12T12:00:00Z'));
      const reset = buildJordanTaylorSnapshot('same-id');
      expect(reset).toEqual(buildJordanTaylorSnapshot('same-id'));
      expect(migrateAppData(JSON.parse(JSON.stringify(reset)))).toEqual(reset);
      expect(todayISODate(reset.user)).toBe(STUDY_DATE);
      expect(todayISODate()).toBe('2027-08-12');
      expect(calculateNextPayday(reset.user.nextPayday!,todayISODate(reset.user),'biweekly')).toBe('2026-11-06');
    } finally { vi.useRealTimers(); }
  });
});

describe('researcher-only Jordan reset', () => {
  function mockClient() {
    const baseline = buildJordanTaylorSnapshot('existing-id');
    const changed = structuredClone(baseline);
    changed.accounts[0].initialBalanceCents = 999;
    changed.transactions.pop();
    changed.transactions[0].amountCents = 1;
    changed.paychecks.shift();
    changed.allocations.shift();
    changed.allocations[0].amountCents = 1;
    changed.categories[0].name = 'Participant edit';
    changed.goals = [];
    changed.categories.push({ id: 'participant:category', name: 'Friend Outings' });
    changed.paychecks.push({ id: 'participant:paycheck', amountCents: 85000, receivedAt: '2026-11-06' });
    changed.goals.push({ id: 'participant:goal', name: 'Moving Fund', targetCents: 100000, initialSavedCents: 30000 });
    changed.contributions = [];
    const rows: Record<string, { data: typeof baseline; revision: number }> = {
      'existing-id': { data: changed, revision: 7 },
      'other-user': { data: buildJordanTaylorSnapshot('other-user'), revision: 15 },
    };
    const admin = { listUsers: vi.fn(async () => ({ data: { users: [{ id: 'other-user', email: 'someone@example.com' }, { id: 'existing-id', email: 'jordan.taylor@example.com' }] }, error: null })), updateUserById: vi.fn(async () => ({ error: null as { message: string } | null })), createUser: vi.fn(), deleteUser: vi.fn() };
    const faults = { fail: false, conflict: false, corruptReturn: false };
    const writes = vi.fn();
    const client = {
      auth: { admin, signOut: vi.fn() },
      from: vi.fn((table: string) => {
        expect(table).toBe('scuttle_user_data');
        const filters: Record<string, unknown> = {};
        let update: { data: typeof baseline; revision: number } | undefined;
        const chain = {
          eq: vi.fn((key: string, value: unknown) => { filters[key] = value; return chain; }),
          update: vi.fn((value: { data: typeof baseline; revision: number }) => { update = value; return chain; }),
          single: vi.fn(async () => ({ data: structuredClone(rows[String(filters.user_id)]), error: null })),
          select: vi.fn(() => {
            if (!update) return chain;
            const owner = String(filters.user_id);
            if (faults.fail) return Promise.resolve({ data: null, error: new Error('Database write failed') });
            if (faults.conflict || rows[owner].revision !== filters.revision) return Promise.resolve({ data: [], error: null });
            writes(owner, structuredClone(update));
            rows[owner] = structuredClone(update);
            return Promise.resolve({ data: [{ user_id: owner, ...rows[owner], ...(faults.corruptReturn ? { data: {} } : {}) }], error: null });
          }),
        };
        return chain;
      }),
    };
    return { client: client as unknown as SupabaseClient, raw: client, admin, rows, faults, writes };
  }

  it('restores every modified/deleted collection, removes participant records, and affects only Jordan', async () => {
    const mock = mockClient();
    const other = structuredClone(mock.rows['other-user']);
    const first = await resetJordan(mock.client);
    const second = await resetJordan(mock.client);
    expect(first).toEqual(second);
    expect(mock.rows['existing-id'].data).toEqual(buildJordanTaylorSnapshot('existing-id'));
    expect(mock.rows['existing-id'].revision).toBe(9);
    expect(mock.rows['other-user']).toEqual(other);
    expect(mock.writes.mock.calls.map(([id]) => id)).toEqual(['existing-id','existing-id']);
    expect(mock.admin.updateUserById).toHaveBeenCalledTimes(2);
    const resets = mock.admin.updateUserById.mock.calls as unknown as [string, { app_metadata: { scuttle_study_reset: string } }][];
    expect(resets[0][0]).toBe('existing-id');
    expect(Object.keys(resets[0][1])).toEqual(['app_metadata']);
    expect(resets[0][1].app_metadata.scuttle_study_reset).not.toBe(resets[1][1].app_metadata.scuttle_study_reset);
    expect(mock.admin.createUser).not.toHaveBeenCalled();
    expect(mock.admin.deleteUser).not.toHaveBeenCalled();
    expect(mock.raw.auth.signOut).not.toHaveBeenCalled();
    verifyJordanTaylorStartingData(second);
    expect(await verifyLiveJordan(mock.client)).toEqual(second);
  });

  it('requires confirmation and performs no authentication lookup or write when cancelled', async () => {
    const mock = mockClient();
    const feedback = vi.fn();
    expect(await confirmAndResetJordan(mock.client, async () => false, feedback)).toBe(false);
    expect(feedback.mock.calls.slice(0,2)).toEqual([[RESET_TITLE],[RESET_WARNING]]);
    expect(mock.admin.listUsers).not.toHaveBeenCalled();
    expect(mock.writes).not.toHaveBeenCalled();
    expect(feedback).not.toHaveBeenCalledWith(RESET_SUCCESS);
  });

  it('reports success only after the entire returned snapshot has been verified', async () => {
    const mock = mockClient();
    const feedback = vi.fn();
    expect(await confirmAndResetJordan(mock.client, async () => true, feedback)).toBe(true);
    expect(feedback).toHaveBeenLastCalledWith(RESET_SUCCESS);
    expect(mock.rows['existing-id'].data).toEqual(buildJordanTaylorSnapshot('existing-id'));
    mock.faults.corruptReturn = true;
    feedback.mockClear();
    await expect(confirmAndResetJordan(mock.client, async () => true, feedback)).rejects.toThrow('complete study baseline');
    expect(feedback).not.toHaveBeenCalledWith(RESET_SUCCESS);
  });

  it('leaves the full snapshot unchanged after a database failure and never reports success', async () => {
    const mock = mockClient();
    const before = structuredClone(mock.rows);
    const feedback = vi.fn();
    mock.faults.fail = true;
    await expect(confirmAndResetJordan(mock.client, async () => true, feedback)).rejects.toThrow('Database write failed');
    expect(mock.rows).toEqual(before);
    expect(mock.writes).not.toHaveBeenCalled();
    expect(feedback).not.toHaveBeenCalledWith(RESET_SUCCESS);
  });

  it('leaves the full snapshot unchanged on a concurrent-write conflict', async () => {
    const mock = mockClient();
    const before = structuredClone(mock.rows);
    mock.faults.conflict = true;
    await expect(resetJordan(mock.client)).rejects.toThrow('Concurrent save');
    expect(mock.rows).toEqual(before);
    expect(mock.writes).not.toHaveBeenCalled();
  });

  it('reports a sign-out request failure separately after restoring finances', async () => {
    const mock = mockClient();
    mock.admin.updateUserById.mockResolvedValueOnce({ error: { message: 'Auth unavailable' } });
    await expect(resetJordan(mock.client)).rejects.toThrow('Financial data was reset, but session sign-out');
    expect(mock.rows['existing-id'].data).toEqual(buildJordanTaylorSnapshot('existing-id'));
  });

  it('refuses a missing auth account rather than creating a new identity', async () => {
    const mock = mockClient();
    mock.admin.listUsers.mockResolvedValueOnce({ data: { users: [] }, error: null });
    await expect(resetJordan(mock.client)).rejects.toThrow('not found');
    expect(mock.writes).not.toHaveBeenCalled();
  });

  it('verifies the actual stored baseline read-only and rejects any participant changes', async () => {
    const mock = mockClient();
    await expect(verifyLiveJordan(mock.client)).rejects.toThrow('complete study baseline');
    expect(mock.writes).not.toHaveBeenCalled();
    await resetJordan(mock.client);
    mock.writes.mockClear();
    await expect(verifyLiveJordan(mock.client)).resolves.toEqual(buildJordanTaylorSnapshot('existing-id'));
    expect(mock.writes).not.toHaveBeenCalled();
  });
});

 it('starts Cash at $300 without moving money from checking or savings', () => {
  const data = buildJordanTaylorSnapshot('cash-fixture-test');
  const cash = data.accounts.find(account => account.name === 'Cash')!;
  expect(cash.type).toBe('cash');
  expect(cash.initialBalanceCents).toBe(30000);
  expect(accountBalance(data, cash)).toBe(30000);
  expect(availableAccountBalance(data, cash)).toBe(30000);
  expect(data.transactions.some(t => t.accountId === cash.id || t.toAccountId === cash.id)).toBe(false);
  expect(data.paychecks.some(p => p.accountId === cash.id)).toBe(false);
  verifyJordanTaylorStartingData(data);
 });

it('sets the initial StreamFlix reminder to November 14 without altering paid history', () => {
  const d=buildJordanTaylorSnapshot('reminder-date-test');
  expect(d.transactions.find(t=>t.id==='jordan:subscription:streaming')?.nextDueDate).toBe('2026-11-14');
  expect(d.transactions.filter(t=>t.type==='expense'&&t.description==='StreamFlix').map(t=>t.date)).toEqual(['2026-09-16','2026-10-16']);
});
