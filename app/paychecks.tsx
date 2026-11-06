import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '../src/design/Text';
import { colors } from '../src/design/theme';
import { Action, Card, DateField, Disclosure, Feedback, Field, Page, RecordLine, SelectId } from '../src/components/ui';
import { EmptyState } from '../src/components/brand';
import { useCrud } from '../src/components/hooks';
import { newId, Paycheck } from '../src/domain/models';
import { allocatedForPaycheck, newestPaychecks, unallocatedForPaycheck } from '../src/domain/calculations';
import { formatMoney, parseMoney } from '../src/domain/money';
import { formatDateDisplay, formatDateInput, normalizeDateInput, todayDateInput } from '../src/domain/date';
import { useData } from '../src/state/DataProvider';
import { TourHighlight } from '../src/components/walkthrough';

export default function Paychecks() {
  const { data, loading, saveRecord, movePaycheckToAccount } = useData();
  const crud = useCrud('paychecks');
  const router = useRouter();
  const params = useLocalSearchParams<{ paycheckId?: string; add?: string }>();
  const initialized = useRef('');
  const id = useRef(newId());
  const busy = useRef(false);
  const [open, setOpen] = useState(params.add === '1');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayDateInput(data.user));
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'received' | 'planned'>('received');
  const [accountId, setAccountId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [filter, setFilter] = useState('all');
  const [message, setMessage] = useState('');
  const existing = data.paychecks.find(p => p.id === editingId);
  const fill = (p: Paycheck) => { setEditingId(p.id); setAmount((p.amountCents / 100).toFixed(2)); setDate(formatDateInput(p.receivedAt)); setSource(p.source || ''); setNotes(p.notes || ''); setStatus(p.status === 'planned' ? 'planned' : 'received'); setAccountId(p.remainingAccountId || p.accountId || ''); setMessage(''); setOpen(true); };
  useEffect(() => { if (params.add === '1' && !params.paycheckId) { reset(); setOpen(true); } }, [params.add]);
  useEffect(() => { const p = data.paychecks.find(p => p.id === params.paycheckId); if (p && initialized.current !== p.id) { initialized.current = p.id; fill(p); } }, [data.paychecks, params.paycheckId]);
  const reset = () => { setOpen(false); setEditingId(''); setAmount(''); setDate(todayDateInput(data.user)); setSource(''); setNotes(''); setStatus('received'); setAccountId(''); setMessage(''); id.current = newId(); };
  const save = async () => {
    if (busy.current) return;
    busy.current = true; setMessage('');
    try {
      const income = parseMoney(amount);
      const receivedAt = normalizeDateInput(date);
      if (income <= 0) { setMessage('Enter an amount greater than zero.'); return; }
      if (!receivedAt) { setMessage('Enter a valid paycheck date.'); return; }
      if (existing?.accountId && !accountId) { setMessage('Choose the account holding this paycheck. A recorded deposit cannot become a standalone budget.'); return; }
      const record: Paycheck = { ...existing, id: existing?.id || id.current, amountCents: income, receivedAt, status, source: source.trim() || undefined, notes: notes.trim() || undefined,
        accountId: status === 'planned' ? undefined : existing?.accountId || (!existing ? accountId || undefined : undefined),
        accountCreditCents: status === 'planned' ? undefined : existing?.accountCreditCents ?? (!existing && accountId ? income : undefined),
        remainingAccountId: status === 'planned' ? undefined : existing?.remainingAccountId || existing?.accountId || (!existing ? accountId || undefined : undefined),
      };
      if (!await saveRecord('paychecks', record)) return;
      if (existing && accountId && accountId !== (existing.remainingAccountId || existing.accountId) && !await movePaycheckToAccount(existing.id, accountId)) return;
      const paycheckId = record.id;
      const wasEditing = Boolean(existing);
      reset();
      router.replace({ pathname: wasEditing ? '/paycheck/[id]' : '/paycheck/plan/[id]', params: { id: paycheckId } });
    } catch { setMessage('Use a dollar amount with up to two decimal places, such as 1234.56.'); }
    finally { busy.current = false; }
  };
  if (!loading && params.paycheckId && !data.paychecks.some(p => p.id === params.paycheckId)) return <Page title="Paycheck not found"><Text>This paycheck no longer exists.</Text><Action label="All paychecks" onPress={() => router.replace('/paychecks')} /></Page>;
  const paychecks = newestPaychecks(data.paychecks.filter(p => filter === 'all' || (p.status === 'planned' ? 'planned' : 'received') === filter));
  return <Page title={open ? editingId ? 'Edit paycheck' : 'Add paycheck' : 'Paychecks'}><Feedback /><TourHighlight id="paychecks-main">
    {open ? <>
      {!editingId ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Action label="Received" selected={status === 'received'} variant={status === 'received' ? 'primary' : 'secondary'} onPress={() => setStatus('received')} /><Action label="Plan ahead" selected={status === 'planned'} variant={status === 'planned' ? 'primary' : 'secondary'} onPress={() => setStatus('planned')} /></View> : null}
      <Text style={{ color: colors.muted }}>{status === 'planned' ? 'Plan expected income now. It won’t affect your account balance until you mark it received.' : 'Add your pay, then budget it on the next screen.'}</Text>
      {existing?.actualAmountCents !== undefined ? <Card><Text>Confirmed income: {formatMoney(existing.amountCents)}</Text><Text style={{ color: colors.muted, fontSize: 13 }}>The received amount is fixed. You can still change how it is budgeted.</Text></Card> : <Field label={status === 'planned' ? 'Expected amount ($)' : 'Amount received ($)'} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />}
      <DateField label={status === 'planned' ? 'Expected payday' : 'Date received'} value={date} onChangeText={setDate} />
      {status === 'received' ? <><SelectId label={existing ? 'Account holding remaining funds' : 'Deposit account (optional)'} value={accountId} onChange={setAccountId} choices={data.accounts.map(a => ({ id: a.id, title: a.name }))} create="account" /><Text style={{ color: colors.muted, fontSize: 13 }}>{accountId ? existing?.accountId ? 'Changing the account records a transfer of the unspent funds.' : 'This records the deposit once. Do not also add it as a separate income transaction.' : 'No account selected: this will track a paycheck budget only.'}</Text></> : null}
      <Field label="Paycheck name (optional)" value={source} onChangeText={setSource} placeholder="e.g. Work, freelance" />
      <Disclosure title="Add a note" initiallyOpen={Boolean(existing?.notes)}><Field label="Note" value={notes} onChangeText={setNotes} multiline /></Disclosure>
      {message ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{message}</Text> : null}
      <Action label={editingId ? 'Save paycheck' : 'Save paycheck & budget'} variant="primary" fullWidth onPress={save} /><Action label="Cancel" onPress={reset} />
    </> : <>
      <Action label="Add paycheck" variant="primary" fullWidth onPress={() => { reset(); setOpen(true); }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{['all', 'received', 'planned'].map(value => <Action key={value} label={value[0].toUpperCase() + value.slice(1)} selected={filter === value} variant={filter === value ? 'primary' : 'secondary'} onPress={() => setFilter(value)} />)}</View>
      {!paychecks.length ? <EmptyState title="Give your next paycheck a plan." detail="Record income you have received, or plan expected pay before it arrives." /> : null}
      {paychecks.map(p => <RecordLine key={p.id} title={p.source || 'Paycheck'} amount={formatMoney(p.amountCents)} detail={`${p.status === 'planned' ? 'Planned' : 'Received'} · ${formatDateDisplay(p.receivedAt)}${p.budgetArchived ? ' · Archived budget' : ''} · ${formatMoney(unallocatedForPaycheck(data, p.id))} left to budget`} progress={{ value: allocatedForPaycheck(data, p.id), max: p.amountCents, label: `${Math.round(allocatedForPaycheck(data, p.id) / p.amountCents * 100)}% budgeted` }} onView={() => router.push({ pathname: '/paycheck/[id]', params: { id: p.id } })} onEdit={() => fill(p)} onDelete={() => crud.confirmDelete(p.id)} />)}
    </>}
  </TourHighlight></Page>;
}
