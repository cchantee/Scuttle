import React, { useRef, useState } from 'react';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from 'react-native';
import { allocationSummary, allocatedForPaycheck, unallocatedForPaycheck } from '../../src/domain/calculations';
import { formatMoney, parseMoney } from '../../src/domain/money';
import { Action, Card, DateField, Field, SelectId, Feedback, Page, ProgressBar, RecordLine, SectionTitle } from '../../src/components/ui';
import { useCrud } from '../../src/components/hooks';
import { useData } from '../../src/state/DataProvider';
import { newId } from '../../src/domain/models';
import { formatDateDisplay, normalizeDateInput, todayDateInput } from '../../src/domain/date';

export default function PaycheckDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, paycheckOperation, saveRecord, deleteRecord, reportError } = useData();
  const [receipt, setReceipt] = useState(false);
  const [actual, setActual] = useState('');
  const [account, setAccount] = useState('');
  const [date, setDate] = useState(todayDateInput());
  const [editingGoalId, setEditingGoalId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [goalId, setGoalId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const busy = useRef(false);
  const run = async (fn: () => Promise<unknown>) => {
    if (busy.current) return;
    busy.current = true;
    try { await fn(); } catch (e) { reportError(e instanceof Error ? e.message : 'Invalid amount.'); } finally { busy.current = false; }
  };
  const allocationCrud = useCrud('allocations');
  const transactionCrud = useCrud('transactions');
  const paycheck = data.paychecks.find(item => item.id === id);
  if (!paycheck) return <Page title="Paycheck"><Text>Paycheck not found.</Text><Link href="/paychecks">Back to paychecks</Link></Page>;
  const allocations = data.allocations.filter(item => item.paycheckId === paycheck.id);
  const allocationIds = new Set(allocations.map(item => item.id));
  const linkedExpenses = data.transactions.filter(item => item.type === 'expense' && item.allocationId && allocationIds.has(item.allocationId)).sort((a, b) => b.date.localeCompare(a.date));
  const accountMoves = data.transactions.filter(item => item.paycheckId === paycheck.id).sort((a, b) => b.date.localeCompare(a.date));
  const remainingAccount = data.accounts.find(account => account.id === (paycheck.remainingAccountId ?? paycheck.accountId));
  return <Page title="Paycheck details"><Feedback />
    <Card><Text style={{ color: '#555' }}>{formatDateDisplay(paycheck.receivedAt)} · {paycheck.source ?? 'Income'}</Text><Text style={{ fontSize: 25, fontWeight: '700', color: '#171717' }}>{formatMoney(paycheck.amountCents)}</Text>{paycheck.accountId ? <Text style={{ color: '#555' }}>Deposited to {data.accounts.find(account => account.id === paycheck.accountId)?.name ?? 'account'}{remainingAccount && remainingAccount.id !== paycheck.accountId ? ` · remaining funds now in ${remainingAccount.name}` : ''}</Text> : <Text style={{ color: '#555' }}>Budgeted as a standalone paycheck</Text>}<ProgressBar value={allocatedForPaycheck(data, paycheck.id)} max={paycheck.amountCents} /><Text style={{ color: '#555' }}>{formatMoney(allocatedForPaycheck(data, paycheck.id))} allocated · {formatMoney(unallocatedForPaycheck(data, paycheck.id))} unallocated</Text></Card>
    <Text>{paycheck.status === 'planned' ? 'Planned · funds are not available to spend' : 'Received'}</Text>
    {paycheck.plannedAmountCents !== undefined ? <Text>Planned {formatMoney(paycheck.plannedAmountCents)} · Actual {formatMoney(paycheck.actualAmountCents ?? paycheck.amountCents)} · Difference {formatMoney(paycheck.amountCents - paycheck.plannedAmountCents)}</Text> : null}
    {paycheck.status === 'planned' ? <Action label="Mark as Received" onPress={() => void run(async () => { if (await paycheckOperation({ type: 'reviewReceipt', paycheckId: paycheck.id })) { setActual((paycheck.amountCents / 100).toFixed(2)); setReceipt(true); } })} /> : null}
    {receipt && paycheck.status === 'planned' ? <>
      <Field label="Actual amount received" value={actual} onChangeText={setActual} keyboardType="decimal-pad" />
      <DateField label="Date received" value={date} onChangeText={setDate} />
      <SelectId label="Receiving account" value={account} onChange={setAccount} choices={data.accounts.filter(a => a.type !== 'credit_card').map(a => ({ id: a.id, title: a.name }))} />
      <Text>Review the allocations below. If actual income is lower, edit or remove allocations before confirming. The original plan is retained.</Text>
      <Action label="Confirm receipt" onPress={() => void run(async () => { const receivedAt = normalizeDateInput(date); if (!receivedAt) return reportError('Enter a valid receipt date.'); if (await paycheckOperation({ type: 'receive', paycheckId: paycheck.id, amountCents: parseMoney(actual), accountId: account, date: receivedAt })) setReceipt(false); })} />
    </> : null}
    {paycheck.notes ? <Text>{paycheck.notes}</Text> : null}
    <Action label={paycheck.accountId ? 'Edit or move remaining funds' : 'Edit or move paycheck to an account'} onPress={() => router.push({ pathname: '/paychecks', params: { paycheckId: paycheck.id } })} />
    <Action label="+ Add category allocation" variant="primary" fullWidth onPress={() => router.push({ pathname: '/budget', params: { paycheckId: paycheck.id } })} />
    <SectionTitle>Categories</SectionTitle>
    {!allocations.length ? <Text>No categories allocated from this paycheck yet.</Text> : null}
    {allocations.map(allocation => {
      const category = data.categories.find(item => item.id === allocation.categoryId);
      const summary = allocationSummary(data, allocation);
      return <RecordLine key={allocation.id} title={category?.name ?? 'Missing category'} detail={`${formatMoney(summary.allocatedCents)} allocated · ${formatMoney(summary.spentCents)} spent · ${formatMoney(summary.remainingCents)} left`} onView={() => router.push({ pathname: '/allocation/[id]', params: { id: allocation.id } })} onEdit={() => router.push({ pathname: '/budget', params: { allocationId: allocation.id } })} onDelete={() => allocationCrud.confirmDelete(allocation.id)} />;
    })}
    <SectionTitle>Savings goal allocations</SectionTitle>
    <Text>These designate paycheck funds without transferring money. Planned allocations do not count toward actual savings.</Text>
    {data.contributions.filter(c => c.paycheckId === paycheck.id).map(c => <RecordLine key={c.id} title={data.goals.find(g => g.id === c.goalId)?.name ?? 'Goal'} detail={`${formatMoney(c.amountCents)} · ${paycheck.status === 'planned' ? 'Planned' : 'Allocated, not transferred'}`} onEdit={() => { setEditingGoalId(c.id); setSourceId(''); setGoalId(c.goalId); setAmount((c.amountCents / 100).toFixed(2)); }} onDelete={() => void deleteRecord('contributions', c.id)} />)}
    {editingGoalId ? <><Text>Editing goal allocation</Text><Action label="Cancel goal edit" onPress={() => { setEditingGoalId(''); setAmount(''); }} /></> : null}
    <SelectId label="Destination goal" value={goalId} onChange={v => { setGoalId(v); setCategoryId(''); }} choices={data.goals.map(g => ({ id: g.id, title: g.name }))} />
    <SelectId label="Or destination category" value={categoryId} onChange={v => { setCategoryId(v); setGoalId(''); }} choices={data.categories.map(c => ({ id: c.id, title: c.name }))} />
    <SelectId label="Source category (optional for goal allocation)" value={sourceId} onChange={setSourceId} choices={allocations.filter(a => !a.subscriptionId).map(a => ({ id: a.id, title: `${data.categories.find(c => c.id === a.categoryId)?.name} · ${formatMoney(allocationSummary(data, a).remainingCents)} available` }))} />
    <Action label="Use unallocated funds" onPress={() => setSourceId('')} />
    <Field label="Amount to allocate or reallocate" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
    <Action label="Confirm allocation" onPress={() => void run(async () => {
      const amountCents = parseMoney(amount);
      if (editingGoalId && (sourceId || !goalId)) return reportError('Choose a goal and use unallocated funds while editing.');
      const ok = sourceId ? await paycheckOperation({ type: 'reallocate', paycheckId: paycheck.id, sourceId, goalId: goalId || undefined, categoryId: categoryId || undefined, amountCents, id: newId() }) : goalId ? await saveRecord('contributions', { id: editingGoalId || newId(), paycheckId: paycheck.id, goalId, amountCents, date: new Date().toISOString().slice(0, 10), status: 'allocated' }) : false;
      if (ok) { setAmount(''); setSourceId(''); setEditingGoalId(''); } else if (!sourceId && !goalId) reportError('Choose a goal or source and destination categories.');
    })} />
    {paycheck.originalPlan ? <><SectionTitle>Original planned distribution</SectionTitle><Text>{formatMoney(paycheck.originalPlan.amountCents)} · {formatDateDisplay(paycheck.originalPlan.date)}</Text>{paycheck.originalPlan.allocations.map(a => <Text key={a.id}>{data.categories.find(c => c.id === a.categoryId)?.name ?? 'Category'}: {formatMoney(a.amountCents)}</Text>)}{paycheck.originalPlan.goals.map(c => <Text key={c.id}>{data.goals.find(g => g.id === c.goalId)?.name ?? 'Goal'}: {formatMoney(c.amountCents)}</Text>)}</> : null}
    <SectionTitle>Allocation history</SectionTitle>
    {(paycheck.allocationHistory ?? []).map(h => <Text key={h.id}>{formatDateDisplay(h.date)} · {h.description}</Text>)}
    <SectionTitle>Linked expenses</SectionTitle>
    {!linkedExpenses.length ? <Text>No expense transactions are linked to these allocations.</Text> : null}
    {linkedExpenses.map(transaction => {
      const allocation = allocations.find(item => item.id === transaction.allocationId);
      const category = data.categories.find(item => item.id === allocation?.categoryId);
      return <RecordLine key={transaction.id} title={transaction.description} detail={`${formatDateDisplay(transaction.date)} · ${category?.name ?? 'Budget category'} · ${formatMoney(transaction.amountCents)}`} onView={() => router.push({ pathname: '/transactions', params: { editId: transaction.id } })} onEdit={() => router.push({ pathname: '/transactions', params: { editId: transaction.id } })} onDelete={() => transactionCrud.confirmDelete(transaction.id)} />;
    })}
    {accountMoves.length ? <><SectionTitle>Account moves</SectionTitle>{accountMoves.map(move => <RecordLine key={move.id} title={move.description} detail={`${formatDateDisplay(move.date)} · ${formatMoney(move.amountCents)} · ${data.accounts.find(account => account.id === move.accountId)?.name ?? 'Account'} → ${data.accounts.find(account => account.id === move.toAccountId)?.name ?? 'Account'}`} onEdit={() => router.push({ pathname: '/transactions', params: { editId: move.id } })} onDelete={() => transactionCrud.confirmDelete(move.id)} />)}</> : null}
  </Page>;
}
