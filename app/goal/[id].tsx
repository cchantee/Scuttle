import { colors } from '../../src/design/theme';
import React, { useRef, useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { Text } from '../../src/design/Text';
import { useLocalSearchParams } from 'expo-router';
import { Action, Card, DateField, Feedback, Field, Page, ProgressBar, RecordLine, SectionTitle, SelectId } from '../../src/components/ui';
import { EmptyState, Mascot } from '../../src/components/brand';
import { newId } from '../../src/domain/models';
import { useCrud } from '../../src/components/hooks';
import { allocationSummary, availableAccountBalance, goalSummary, pendingForGoal } from '../../src/domain/calculations';
import { formatMoney, parseMoney } from '../../src/domain/money';
import { useData } from '../../src/state/DataProvider';
import { formatDateDisplay, formatDateInput, normalizeDateInput, todayDateInput } from '../../src/domain/date';

export default function GoalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const crud = useCrud('contributions');
  const { data, reportError, paycheckOperation, completeGoalContributionInAccount } = useData();
  const [formOpen, setFormOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayDateInput());
  const [note, setNote] = useState('');
  const [accountId, setAccountId] = useState('');
  const [fundingMode, setFundingMode] = useState('account');
  const [allocationId, setAllocationId] = useState('');
  const saving = useRef(false);
  const budgetChoices = data.allocations.filter(allocation => !allocation.subscriptionId && allocationSummary(data, allocation).remainingCents > 0).map(allocation => {
    const paycheck = data.paychecks.find(p => p.id === allocation.paycheckId);
    return { id: allocation.id, title: `${data.categories.find(c => c.id === allocation.categoryId)?.name ?? 'Category'} · ${paycheck?.source || 'Paycheck'} · ${paycheck ? formatDateDisplay(paycheck.receivedAt) : ''} · ${formatMoney(allocationSummary(data, allocation).remainingCents)} available${paycheck?.status === 'planned' ? ' · Planned' : ''}` };
  });
  const goal = data.goals.find(item => item.id === id);
  if (!goal) return <Page title="Savings goal"><Text>Goal not found.</Text><Link href="/goals">Back to goals</Link></Page>;
  const summary = goalSummary(data, goal);
  const contributions = data.contributions.filter(item => item.goalId === goal.id).sort((a, b) => b.date.localeCompare(a.date));
  const reset = () => { setAmount(''); setDate(todayDateInput()); setNote(''); setAccountId(''); setFundingMode('account'); setAllocationId(''); crud.cancel(); setFormOpen(false); };
  const save = async () => {
    if (saving.current) return;
    saving.current = true;
    try {
      if (!crud.editingId && fundingMode === 'budget') {
        const allocation = data.allocations.find(a => a.id === allocationId);
        if (!allocation) return reportError('Choose the budget group funding this contribution.');
        const ok = await paycheckOperation({ type: 'reallocate', paycheckId: allocation.paycheckId, sourceId: allocation.id, goalId: goal.id, amountCents: parseMoney(amount), id: newId() });
        if (ok) reset();
        return;
      }
      const contributionDate = normalizeDateInput(date);
      if (!contributionDate) return reportError('Enter a valid date as M/D/YYYY.');
      if (!accountId) return reportError('Choose the account funding this contribution.');
      const existing = crud.list.find(item => item.id === crud.editingId);
      const ok = await crud.submit({ goalId: goal.id, amountCents: parseMoney(amount), date: contributionDate, note: note || undefined, accountId, status: existing?.status === 'posted' ? 'posted' : 'pending', transactionId: existing?.transactionId });
      if (ok) reset();
    } catch (e) { reportError(e instanceof Error ? e.message : 'Invalid contribution.'); } finally { saving.current = false; }
  };
  return <Page title={goal.name}><Feedback />
    <Card style={{ backgroundColor: colors.subtle }}>{summary.savedCents >= goal.targetCents ? <Mascot mood="celebrate" size={44} /> : null}<Text style={{ color: colors.muted, fontSize: 12 }}>Designated toward your goal · includes pending funds</Text><Text style={{ fontSize: 25, color: colors.text, fontWeight: '700' }}>{formatMoney(summary.savedCents)}</Text><Text style={{ color: colors.muted }}>of {formatMoney(goal.targetCents)} · {formatMoney(summary.remainingCents)} remaining</Text><ProgressBar value={summary.savedCents} max={goal.targetCents} /><Text style={{ color: colors.muted }}>{summary.progressPercent.toFixed(0)}% complete{goal.targetDate ? ` · Target ${formatDateDisplay(goal.targetDate)}` : ''}</Text>{pendingForGoal(data, goal.id) ? <Text style={{ color: colors.muted }}>{formatMoney(pendingForGoal(data, goal.id))} pending in selected accounts</Text> : null}</Card>
    {!formOpen ? <Action label="+ Record contribution" variant="primary" fullWidth onPress={() => setFormOpen(true)} /> : <>
      {crud.list.find(item => item.id === crud.editingId)?.status === 'posted' ? <Text>Posted amount: {formatMoney(parseMoney(amount) || 0)}</Text> : <Field label="Contribution amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />}
      {!crud.editingId ? <SelectId label="Contribution source" choices={[{ id: 'account', title: 'Account' }, { id: 'budget', title: 'Paycheck budget group' }]} value={fundingMode} onChange={setFundingMode} /> : null}
      {!crud.editingId && fundingMode === 'budget' ? <>
        <SelectId label="Fund from budget group" choices={budgetChoices} value={allocationId} onChange={setAllocationId} />
        {!budgetChoices.length ? <Text>No eligible budget groups have unspent funds. Add a paycheck category allocation first.</Text> : null}
        <Text style={{ color: colors.muted, fontSize: 12 }}>Reallocates unspent budget money to this goal without changing account balances or recording a transfer. Planned paycheck funds remain planned and are excluded from actual savings. The allocation is recorded with today's date.</Text>
      </> : <>
      <SelectId label="Fund from account" choices={data.accounts.filter(account => account.type !== 'credit_card').map(account => { const available = availableAccountBalance(data, account); return { id: account.id, title: `${account.name} · available ${formatMoney(available ?? 0)}` }; })} value={accountId} onChange={setAccountId} create="account" />
      <Text style={{ color: colors.muted, fontSize: 12 }}>This amount counts toward the goal now and is held as pending in the selected account until you record the expense or transfer.</Text>
      <DateField label="Contribution date" value={date} onChangeText={setDate} />
      <Field label="Note (optional)" value={note} onChangeText={setNote} />
      </>}
      <Action label={crud.editingId ? 'Save changes' : fundingMode === 'budget' ? 'Reallocate to goal' : 'Allocate pending funds'} variant="primary" fullWidth onPress={() => save()} />
      <Action label="Cancel" onPress={reset} />
    </>}
    <SectionTitle>Contributions</SectionTitle>
    {!contributions.length ? <EmptyState title="Your first step is ready." detail="Designate funds from an account or a paycheck budget group. Contributions do not automatically transfer cash." /> : null}
    {contributions.map(item => {
      if (item.paycheckId) return <RecordLine key={item.id} title={formatMoney(item.amountCents)} detail={data.paychecks.find(p => p.id === item.paycheckId)?.status === 'planned' ? 'Planned paycheck allocation · excluded from actual savings' : 'Paycheck allocation · not transferred'} onEdit={() => router.push({ pathname: '/paycheck/[id]', params: { id: item.paycheckId! } })} onDelete={() => crud.confirmDelete(item.id)} />;
      const account = data.accounts.find(value => value.id === item.accountId);
      const linkedTransaction = item.transactionId ? data.transactions.find(value => value.id === item.transactionId) : undefined;
      const detail = `${formatDateDisplay(item.date)} · ${item.status === 'pending' ? `Pending · ${account?.name ?? 'account'}` : item.status === 'designated' ? `Completed in ${account?.name ?? 'account'}` : item.transactionId ? `${linkedTransaction?.type === 'expense' ? 'Previously posted expense' : 'Transferred'}${linkedTransaction?.toAccountId ? ` to ${data.accounts.find(value => value.id === linkedTransaction.toAccountId)?.name ?? 'account'}` : ''}` : 'Recorded'}${item.note ? ` · ${item.note}` : ''}`;
      if (item.status !== 'pending') return <RecordLine key={item.id} title={formatMoney(item.amountCents)} detail={detail} onEdit={() => { setAmount((item.amountCents / 100).toFixed(2)); setDate(formatDateInput(item.date)); setNote(item.note ?? ''); setAccountId(item.accountId ?? ''); crud.setEditingId(item.id); setFormOpen(true); }} onDelete={() => crud.confirmDelete(item.id)} />;
      return <Card key={item.id}><Text style={{ fontWeight: '700' }}>{formatMoney(item.amountCents)} · Pending</Text><Text>{detail}</Text><Action label="Complete in this account" onPress={() => completeGoalContributionInAccount(item.id)} /><Action label="Transfer to another account" onPress={() => router.push({ pathname: '/transaction/new', params: { goalContributionId: item.id } })} /><Action label="Edit" onPress={() => { setAmount((item.amountCents / 100).toFixed(2)); setDate(formatDateInput(item.date)); setNote(item.note ?? ''); setAccountId(item.accountId ?? ''); crud.setEditingId(item.id); setFormOpen(true); }} /><Action label="Cancel allocation" destructive onPress={() => crud.confirmDelete(item.id)} /></Card>;
    })}
  </Page>;
}
