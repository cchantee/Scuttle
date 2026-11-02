import React, { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Action, DateField, Field, Feedback, Page, RecordLine, SelectId } from '../src/components/ui';
import { useCrud } from '../src/components/hooks';
import { formatMoney, parseMoney } from '../src/domain/money';
import { Paycheck } from '../src/domain/models';
import { allocatedForPaycheck, unallocatedForPaycheck } from '../src/domain/calculations';
import { useData } from '../src/state/DataProvider';
import { formatDateDisplay, formatDateInput, normalizeDateInput, todayDateInput } from '../src/domain/date';
import { TourHighlight } from '../src/components/walkthrough';

export default function Paychecks() {
  const crud = useCrud('paychecks');
  const router = useRouter();
  const { data, movePaycheckToAccount, reportError } = useData();
  const params = useLocalSearchParams<{ paycheckId?: string; add?: string }>();
  const initializedId = useRef('');
  const [formOpen, setFormOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayDateInput());
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');
  const [fundingMode, setFundingMode] = useState<'planned' | 'paycheck' | 'account' | ''>('');
  const [accountId, setAccountId] = useState('');
  useEffect(() => { if (params.add === '1' && !params.paycheckId) setFormOpen(true); }, [params.add, params.paycheckId]);
  useEffect(() => {
    if (!params.paycheckId || initializedId.current === params.paycheckId) return;
    const paycheck = data.paychecks.find(item => item.id === params.paycheckId);
    if (!paycheck) return;
    setAmount((paycheck.amountCents / 100).toFixed(2)); setDate(formatDateInput(paycheck.receivedAt)); setSource(paycheck.source ?? ''); setNotes(paycheck.notes ?? ''); setAccountId(paycheck.remainingAccountId ?? paycheck.accountId ?? ''); setFundingMode(paycheck.status === 'planned' ? 'planned' : paycheck.accountId ? 'account' : 'paycheck');
    crud.setEditingId(paycheck.id); setFormOpen(true); initializedId.current = paycheck.id;
  }, [params.paycheckId, data.paychecks]);
  const reset = () => { setAmount(''); setDate(todayDateInput()); setSource(''); setNotes(''); setAccountId(''); setFundingMode(''); crud.cancel(); setFormOpen(false); };
  const submit = async () => {
    try {
      const receivedAt = normalizeDateInput(date);
      if (!receivedAt) return reportError('Enter a valid date as M/D/YYYY.');
      if (!fundingMode) return reportError('Choose whether to budget this paycheck on its own or record it in an account.');
      if (fundingMode === 'account' && !accountId) return reportError('Choose the account where this paycheck was deposited.');
      const existing = data.paychecks.find(item => item.id === crud.editingId);
      if (existing?.accountId && fundingMode === 'paycheck') return reportError('This paycheck is already recorded in an account. Choose an account to move its remaining funds.');
      const amountCents = parseMoney(amount);
      const ok = await crud.submit({ ...existing, status: fundingMode === 'planned' ? 'planned' : 'received', amountCents, receivedAt, source: source || undefined, notes: notes || undefined,
        accountId: existing?.accountId ?? (!existing && fundingMode === 'account' ? accountId : undefined),
        accountCreditCents: existing?.accountCreditCents ?? (!existing && fundingMode === 'account' ? amountCents : undefined),
        remainingAccountId: existing?.remainingAccountId ?? existing?.accountId ?? (!existing && fundingMode === 'account' ? accountId : undefined),
        budgetArchived: existing?.budgetArchived });
      if (!ok) return;
      if (existing && fundingMode === 'account' && accountId !== (existing.remainingAccountId ?? existing.accountId)) {
        if (!await movePaycheckToAccount(existing.id, accountId)) return;
      }
      reset();
    } catch (e) { reportError(e instanceof Error ? e.message : 'Invalid paycheck.'); }
  };
  return <Page title="Paychecks"><TourHighlight id="paychecks-main"><Feedback />
    {!formOpen ? <Action label="+ Add paycheck" variant="primary" fullWidth onPress={() => setFormOpen(true)} /> : <>
      <Field label={fundingMode === 'planned' ? "Expected amount" : "Amount received"} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
      <DateField label={fundingMode === 'planned' ? "Expected payment date" : "Date received"} value={date} onChangeText={setDate} />
      <Field label="Income source (optional)" value={source} onChangeText={setSource} />
      <Text style={{ fontWeight: '600' }}>Where should this paycheck be recorded?</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(!crud.editingId || data.paychecks.find(p => p.id === crud.editingId)?.status === 'planned') ? <Action label="Plan future paycheck" variant={fundingMode === 'planned' ? 'primary' : 'secondary'} onPress={() => setFundingMode('planned')} /> : null}
        <Action label="Budget paycheck only" variant={fundingMode === 'paycheck' ? 'primary' : 'secondary'} onPress={() => setFundingMode('paycheck')} />
        <Action label="Deposit to an account" variant={fundingMode === 'account' ? 'primary' : 'secondary'} onPress={() => setFundingMode('account')} />
      </View>
      {fundingMode === 'account' ? <>
        <Text>Recording a deposit updates the account balance. Paycheck allocations remain separate and do not deposit the money again.</Text>
        <SelectId label={crud.editingId ? 'Move remaining funds to account' : 'Deposit account'} choices={data.accounts.map(item => ({ id: item.id, title: `${item.name}${item.type === 'credit_card' ? ' · card debt' : ''}`}))} value={accountId} onChange={setAccountId} create="account" />
        {crud.editingId ? <Text>Only unspent funds move. This paycheck’s allocations and linked expenses stay in its history.</Text> : null}
      </> : null}
      <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
      <Action label="Save paycheck" variant="primary" fullWidth onPress={() => void submit()} />
      <Action label="Cancel" onPress={reset} />
    </>}
    {!data.paychecks.length ? <Text>Paychecks you add will appear here.</Text> : null}
    {([...data.paychecks] as Paycheck[]).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).map(p => {
      const depositName = data.accounts.find(account => account.id === p.accountId)?.name;
      const currentFundsName = data.accounts.find(account => account.id === (p.remainingAccountId ?? p.accountId))?.name;
      const accountDetail = p.accountId ? `Deposited to ${depositName ?? 'account'}${currentFundsName && currentFundsName !== depositName ? ` · remaining funds moved to ${currentFundsName}` : ''} · ` : 'Paycheck only · ';
      return <RecordLine key={p.id} title={`${p.status === 'planned' ? 'Planned · ' : 'Received · '}${formatDateDisplay(p.receivedAt)} · ${formatMoney(p.amountCents)}`} detail={`${p.source ?? 'Income'} · ${accountDetail}${formatMoney(allocatedForPaycheck(data, p.id))} allocated · ${formatMoney(unallocatedForPaycheck(data, p.id))} left`} progress={{ value: allocatedForPaycheck(data, p.id), max: p.amountCents, label: `${p.amountCents ? Math.round(allocatedForPaycheck(data, p.id) / p.amountCents * 100) : 0}% allocated` }} onView={() => router.push({ pathname: '/paycheck/[id]', params: { id: p.id } })} onEdit={() => { setAmount((p.amountCents / 100).toFixed(2)); setDate(formatDateInput(p.receivedAt)); setSource(p.source ?? ''); setNotes(p.notes ?? ''); setAccountId(p.remainingAccountId ?? p.accountId ?? ''); setFundingMode(p.status === 'planned' ? 'planned' : p.accountId ? 'account' : 'paycheck'); crud.setEditingId(p.id); setFormOpen(true); }} onDelete={() => crud.confirmDelete(p.id)} />;
    })}
  </TourHighlight></Page>;
}
