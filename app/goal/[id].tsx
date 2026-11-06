import { goalFundsHeld, goalHoldingAccount } from '../../src/domain/goalFunds';
import { GoalContributionCard } from '../../src/components/GoalContributionCard';
import { colors } from '../../src/design/theme';
import { View } from 'react-native';
import { IconTile } from '../../src/components/icons';
import { Completion, EmptyState, CoastalScene } from '../../src/components/coastal';
import { Text } from '../../src/components/typography';
import React, { useEffect, useState } from 'react';
import { Link, useIsFocused, useRouter } from 'expo-router';

import { useLocalSearchParams } from 'expo-router';
import { Action, Card, DateField, Feedback, Field, Page, ProgressRing, ProgressBar, RecordLine, SectionTitle, SelectId } from '../../src/components/ui';
import { useCrud } from '../../src/components/hooks';
import { availableAccountBalance, goalSummary, pendingForGoal } from '../../src/domain/calculations';
import { formatMoney, parseMoney } from '../../src/domain/money';
import { useData } from '../../src/state/DataProvider';
import { formatDateDisplay, formatDateInput, normalizeDateInput, todayDateInput } from '../../src/domain/date';

export default function GoalDetail() {
  const { id, contribute } = useLocalSearchParams<{ id: string; contribute?: string }>();
  const router = useRouter();
  const crud = useCrud('contributions');
  const { data, reportError, completeGoalContributionInAccount } = useData();
  const focused = useIsFocused();
  useEffect(() => { if (focused && contribute === '1') setFormOpen(true); }, [focused, contribute]);
  const [saved, setSaved] = useState(false);
  const [paycheckId, setPaycheckId] = useState('');
  const [formOpen, setFormOpen] = useState(contribute === '1');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayDateInput(data.user));
  const [note, setNote] = useState('');
  const [accountId, setAccountId] = useState('');
  const goal = data.goals.find(item => item.id === id);
  if (!goal) return <Page title="Savings goal"><Text>Goal not found.</Text><Link href="/goals">Back to goals</Link></Page>;
  const summary = goalSummary(data, goal);
  const contributions = data.contributions.filter(item => item.goalId === goal.id).sort((a, b) => b.date.localeCompare(a.date));
  const reset = () => { setAmount(''); setDate(todayDateInput(data.user)); setNote(''); setAccountId(''); crud.cancel(); setFormOpen(false); };
  const save = async () => {
    try {
      const contributionDate = normalizeDateInput(date);
      if (!contributionDate) return reportError('Enter a valid date as M/D/YYYY.');
      if (!accountId) return reportError('Choose the account funding this contribution.');
      const existing = crud.list.find(item => item.id === crud.editingId);
      const ok = await crud.submit({ paycheckId: existing?.paycheckId ?? (paycheckId || undefined), goalId: goal.id, amountCents: parseMoney(amount), date: contributionDate, note: note || undefined, accountId, status: existing?.status ?? 'pending', transactionId: existing?.transactionId });
      if (ok) { setSaved(true); setPaycheckId(''); reset(); }
    } catch (e) { reportError(e instanceof Error ? e.message : 'Invalid contribution.'); }
  };
  return <Page title={goal.name}><Feedback />
    <Card style={{ alignItems: 'center', paddingTop: 24, paddingBottom: 22, gap: 14 }}>
      <IconTile name="goals" tint={colors.shell} />
      <Text role="money" style={{ fontSize: 38, letterSpacing: -0.8 }}>{formatMoney(summary.savedCents)}</Text>
      <Text style={{ color: colors.muted, fontSize: 14 }}>of {formatMoney(goal.targetCents)}</Text>
      <ProgressRing value={summary.savedCents} max={goal.targetCents} />
      <Text role="message" style={{ fontSize: 24, textAlign: 'center' }}>Small moves count.</Text>
      <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center' }}>{formatMoney(summary.remainingCents)} to go{goal.targetDate ? ` · Target ${formatDateDisplay(goal.targetDate)}` : ''}</Text>
      {pendingForGoal(data, goal.id) ? <View style={{ padding: 13, backgroundColor: colors.glass, borderRadius: 13, width: '100%', gap: 5 }}><Text style={{ fontSize: 13, fontWeight: '600' }}>{formatMoney(pendingForGoal(data, goal.id))} reserved in your accounts</Text></View> : null}
    </Card>
    {saved ? <Completion message="A little closer to what matters." /> : null}
    {!formOpen ? <Action label="Add Money" variant="primary" fullWidth onPress={() => setFormOpen(true)} /> : <>
      {crud.list.find(item => item.id === crud.editingId)?.status === 'posted' ? <Text>Posted amount: {formatMoney(crud.list.find(item => item.id === crud.editingId)?.amountCents ?? 0)}</Text> : <Field label="Contribution amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />}
      {!crud.editingId ? <SelectId label="From paycheck (optional)" choices={data.paychecks.filter(p => p.status !== 'planned' && !p.budgetArchived).map(p => ({ id: p.id, title: `${p.source || 'Paycheck'} · ${formatDateDisplay(p.receivedAt)}` }))} value={paycheckId} onChange={value => { setPaycheckId(value); const p = data.paychecks.find(p => p.id === value); setAccountId(p?.remainingAccountId ?? p?.accountId ?? ''); }} /> : null}
      <SelectId label="Fund from account" choices={data.accounts.filter(account => account.type !== 'credit_card').map(account => { const available = availableAccountBalance(data, account); return { id: account.id, title: `${account.name} · available ${formatMoney(available ?? 0)}` }; })} value={accountId} onChange={setAccountId} create="account" />

      <DateField label="Contribution date" value={date} onChangeText={setDate} />
      <Field label="Note (optional)" value={note} onChangeText={setNote} />
      <Action label={crud.editingId ? 'Save changes' : 'Reserve funds'} variant="primary" fullWidth onPress={() => void save()} />
      <Action label="Cancel" onPress={reset} />
    </>}
    <SectionTitle>Contributions</SectionTitle>
    {!contributions.length ? <EmptyState message="Small moves count." /> : null}
    {contributions.map(item => {
      const account = data.accounts.find(value => value.id === goalHoldingAccount(data, item));
      const linkedTransaction = item.transactionId ? data.transactions.find(value => value.id === item.transactionId) : undefined;
      const detail = `${formatDateDisplay(item.date)} · ${item.status === 'pending' ? `Reserved · ${account?.name ?? 'account'}` : item.status === 'designated' ? `Saved · ${account?.name ?? 'account'}` : item.transactionId ? `${linkedTransaction?.type === 'expense' ? 'Previously posted expense' : 'Transferred'}${linkedTransaction?.toAccountId ? ` to ${data.accounts.find(value => value.id === linkedTransaction.toAccountId)?.name ?? 'account'}` : ''}` : 'Recorded'}${item.note ? ` · ${item.note}` : ''}`;
      if (!goalFundsHeld(data, item)) return <RecordLine key={item.id} title={formatMoney(item.amountCents)} detail={detail} onEdit={() => { setAmount((item.amountCents / 100).toFixed(2)); setDate(formatDateInput(item.date)); setNote(item.note ?? ''); setAccountId(item.accountId ?? ''); crud.setEditingId(item.id); setFormOpen(true); }} onDelete={() => crud.confirmDelete(item.id)} />;
      return <GoalContributionCard key={item.id} contribution={item} accountName={account?.name ?? 'Savings account'} onComplete={() => void completeGoalContributionInAccount(item.id)} onTransfer={() => router.push({ pathname: '/transaction/new', params: { goalContributionId: item.id } })} onEdit={() => { setAmount((item.amountCents / 100).toFixed(2)); setDate(formatDateInput(item.date)); setNote(item.note ?? ''); setAccountId(item.accountId ?? ''); crud.setEditingId(item.id); setFormOpen(true); }} onCancel={() => crud.confirmDelete(item.id)} />;
    })}
  </Page>;
}
