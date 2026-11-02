import React, { useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Action, Card, DateField, Feedback, Field, Page, ProgressBar, RecordLine, SectionTitle, SelectId } from '../../src/components/ui';
import { useCrud } from '../../src/components/hooks';
import { availableAccountBalance, goalSummary, pendingForGoal } from '../../src/domain/calculations';
import { formatMoney, parseMoney } from '../../src/domain/money';
import { useData } from '../../src/state/DataProvider';
import { formatDateDisplay, formatDateInput, normalizeDateInput, todayDateInput } from '../../src/domain/date';

export default function GoalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const crud = useCrud('contributions');
  const { data, reportError, completeGoalContributionInAccount } = useData();
  const [formOpen, setFormOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayDateInput());
  const [note, setNote] = useState('');
  const [accountId, setAccountId] = useState('');
  const goal = data.goals.find(item => item.id === id);
  if (!goal) return <Page title="Savings goal"><Text>Goal not found.</Text><Link href="/goals">Back to goals</Link></Page>;
  const summary = goalSummary(data, goal);
  const contributions = data.contributions.filter(item => item.goalId === goal.id).sort((a, b) => b.date.localeCompare(a.date));
  const reset = () => { setAmount(''); setDate(todayDateInput()); setNote(''); setAccountId(''); crud.cancel(); setFormOpen(false); };
  const save = async () => {
    try {
      const contributionDate = normalizeDateInput(date);
      if (!contributionDate) return reportError('Enter a valid date as M/D/YYYY.');
      if (!accountId) return reportError('Choose the account funding this contribution.');
      const existing = crud.list.find(item => item.id === crud.editingId);
      const ok = await crud.submit({ goalId: goal.id, amountCents: parseMoney(amount), date: contributionDate, note: note || undefined, accountId, status: existing?.status === 'posted' ? 'posted' : 'pending', transactionId: existing?.transactionId });
      if (ok) reset();
    } catch (e) { reportError(e instanceof Error ? e.message : 'Invalid contribution.'); }
  };
  return <Page title={goal.name}><Feedback />
    <Card><Text style={{ color: '#555', fontSize: 12 }}>Goal progress includes pending allocations</Text><Text style={{ fontSize: 25, color: '#171717', fontWeight: '700' }}>{formatMoney(summary.savedCents)}</Text><Text style={{ color: '#555' }}>of {formatMoney(goal.targetCents)} · {formatMoney(summary.remainingCents)} remaining</Text><ProgressBar value={summary.savedCents} max={goal.targetCents} /><Text style={{ color: '#555' }}>{summary.progressPercent.toFixed(0)}% complete{goal.targetDate ? ` · Target ${formatDateDisplay(goal.targetDate)}` : ''}</Text>{pendingForGoal(data, goal.id) ? <Text style={{ color: '#555' }}>{formatMoney(pendingForGoal(data, goal.id))} pending in selected accounts</Text> : null}</Card>
    {!formOpen ? <Action label="+ Record contribution" variant="primary" fullWidth onPress={() => setFormOpen(true)} /> : <>
      {crud.list.find(item => item.id === crud.editingId)?.status === 'posted' ? <Text>Posted amount: {formatMoney(parseMoney(amount) || 0)}</Text> : <Field label="Contribution amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />}
      <SelectId label="Fund from account" choices={data.accounts.filter(account => account.type !== 'credit_card').map(account => { const available = availableAccountBalance(data, account); return { id: account.id, title: `${account.name} · available ${formatMoney(available ?? 0)}` }; })} value={accountId} onChange={setAccountId} create="account" />
      <Text style={{ color: '#555', fontSize: 12 }}>This amount counts toward the goal now and is held as pending in the selected account until you record the expense or transfer.</Text>
      <DateField label="Contribution date" value={date} onChangeText={setDate} />
      <Field label="Note (optional)" value={note} onChangeText={setNote} />
      <Action label={crud.editingId ? 'Save changes' : 'Allocate pending funds'} variant="primary" fullWidth onPress={() => void save()} />
      <Action label="Cancel" onPress={reset} />
    </>}
    <SectionTitle>Contributions</SectionTitle>
    {!contributions.length ? <Text>No contributions yet.</Text> : null}
    {contributions.map(item => {
      const account = data.accounts.find(value => value.id === item.accountId);
      const linkedTransaction = item.transactionId ? data.transactions.find(value => value.id === item.transactionId) : undefined;
      const detail = `${formatDateDisplay(item.date)} · ${item.status === 'pending' ? `Pending · ${account?.name ?? 'account'}` : item.status === 'designated' ? `Completed in ${account?.name ?? 'account'}` : item.transactionId ? `${linkedTransaction?.type === 'expense' ? 'Previously posted expense' : 'Transferred'}${linkedTransaction?.toAccountId ? ` to ${data.accounts.find(value => value.id === linkedTransaction.toAccountId)?.name ?? 'account'}` : ''}` : 'Recorded'}${item.note ? ` · ${item.note}` : ''}`;
      if (item.status !== 'pending') return <RecordLine key={item.id} title={formatMoney(item.amountCents)} detail={detail} onEdit={() => { setAmount((item.amountCents / 100).toFixed(2)); setDate(formatDateInput(item.date)); setNote(item.note ?? ''); setAccountId(item.accountId ?? ''); crud.setEditingId(item.id); setFormOpen(true); }} onDelete={() => crud.confirmDelete(item.id)} />;
      return <Card key={item.id}><Text style={{ fontWeight: '700' }}>{formatMoney(item.amountCents)} · Pending</Text><Text>{detail}</Text><Action label="Complete in this account" onPress={() => void completeGoalContributionInAccount(item.id)} /><Action label="Transfer to another account" onPress={() => router.push({ pathname: '/transaction/new', params: { goalContributionId: item.id } })} /><Action label="Edit" onPress={() => { setAmount((item.amountCents / 100).toFixed(2)); setDate(formatDateInput(item.date)); setNote(item.note ?? ''); setAccountId(item.accountId ?? ''); crud.setEditingId(item.id); setFormOpen(true); }} /><Action label="Cancel allocation" destructive onPress={() => crud.confirmDelete(item.id)} /></Card>;
    })}
  </Page>;
}
