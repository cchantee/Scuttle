import { HarborBalance as CoastalBalance } from '../src/components/collaborative';
import { currentPaycheck } from '../src/domain/navigation';
import { colors } from '../src/design/theme';

import { Card, ProgressBar, SectionTitle } from '../src/components/ui';
import { Completion, EmptyState } from '../src/components/coastal';
import { Text } from '../src/components/typography';
import React, { useEffect, useRef, useState } from 'react';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { Action, DateField, Field, Feedback, Page, RecordLine, SelectId } from '../src/components/ui';
import { useCrud } from '../src/components/hooks';
import { formatMoney, parseMoney } from '../src/domain/money';
import { newId } from '../src/domain/models';
import { allocatedForPaycheck, unallocatedForPaycheck } from '../src/domain/calculations';
import { useData } from '../src/state/DataProvider';
import { formatDateDisplay, formatDateInput, normalizeDateInput, todayDateInput } from '../src/domain/date';
import { TourHighlight } from '../src/components/walkthrough';

export default function Paychecks() {
  const crud = useCrud('paychecks');
  const router = useRouter();
  const { data, loading, saveRecord, receivePaycheck, movePaycheckToAccount, reportError } = useData();
  const params = useLocalSearchParams<{ paycheckId?: string; add?: string; receive?: string; view?: string }>();
  const initializedId = useRef('');
  const focused = useIsFocused();
  const saving = useRef(false);
  const [status, setStatus] = useState<'planned' | 'received'>('received');
  const [savedId, setSavedId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const current = currentPaycheck(data);
  const older = data.paychecks.filter(p => p.id !== current?.id).sort((a,b)=>b.receivedAt.localeCompare(a.receivedAt));
  useEffect(() => { if (focused) setShowArchive(params.view === 'archive'); }, [focused, params.view]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayDateInput(data.user));
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');
  const [fundingMode, setFundingMode] = useState<'paycheck' | 'account' | ''>('');
  const [accountId, setAccountId] = useState('');
  useEffect(() => {
    if (!focused) { initializedId.current = ''; return; }
    if (loading) return;
    const key = `${params.paycheckId || ''}|${params.add || ''}|${params.receive || ''}`;
    if (initializedId.current === key) return;
    reset(); setSavedId('');
    const paycheck = data.paychecks.find(item => item.id === params.paycheckId);
    if (params.paycheckId && !paycheck) return;
    if (paycheck) {
      setStatus(params.receive === '1' && paycheck.status === 'planned' ? 'received' : paycheck.status ?? 'received'); setAmount((paycheck.amountCents / 100).toFixed(2)); setDate(formatDateInput(paycheck.receivedAt)); setSource(paycheck.source ?? ''); setNotes(paycheck.notes ?? ''); setAccountId(paycheck.remainingAccountId ?? paycheck.accountId ?? ''); setFundingMode(params.receive === '1' || paycheck.accountId ? 'account' : 'paycheck'); crud.setEditingId(paycheck.id); setFormOpen(true);
    } else setFormOpen(params.add === '1');
    initializedId.current = key;
  }, [focused, loading, params.paycheckId, params.add, params.receive, data.paychecks]);
  const reset = () => { setStatus('received'); setAmount(''); setDate(todayDateInput(data.user)); setSource(''); setNotes(''); setAccountId(''); setFundingMode(''); crud.cancel(); setFormOpen(false); };
  const submit = async () => {
    if (saving.current) return;
    saving.current = true;
    try {
      const receivedAt = normalizeDateInput(date);
      if (!receivedAt) return reportError('Enter a valid date as M/D/YYYY.');
      if (status !== 'planned' && !fundingMode) return reportError('Choose whether to budget this paycheck on its own or record it in an account.');
      if (status !== 'planned' && fundingMode === 'account' && !accountId) return reportError('Choose the account where this paycheck was deposited.');
      const existing = data.paychecks.find(item => item.id === crud.editingId);
      if (existing?.accountId && fundingMode === 'paycheck') return reportError('This paycheck is already recorded in an account. Choose an account to move its remaining funds.');
      const amountCents = parseMoney(amount);
      const recordId = existing?.id ?? newId();
      let ok: boolean;
      if (existing?.status === 'planned' && status === 'received') {
        ok = await receivePaycheck(existing.id, amountCents, receivedAt, accountId);
      } else {
        ok = await saveRecord('paychecks', { id: recordId, status, amountCents, receivedAt, source: source || undefined, notes: notes || undefined,
          accountId: status === 'planned' ? undefined : existing?.accountId ?? (!existing && fundingMode === 'account' ? accountId : undefined),
          accountCreditCents: status === 'planned' ? undefined : existing?.accountCreditCents ?? (!existing && fundingMode === 'account' ? amountCents : undefined),
          remainingAccountId: status === 'planned' ? undefined : existing?.remainingAccountId ?? existing?.accountId ?? (!existing && fundingMode === 'account' ? accountId : undefined),
          budgetArchived: existing?.budgetArchived });
      }
      if (!ok) return;
      if (existing && existing.status !== 'planned' && fundingMode === 'account' && accountId !== (existing.remainingAccountId ?? existing.accountId)) {
        if (!await movePaycheckToAccount(existing.id, accountId)) return;
      }
      const received = status === 'received';
      setSavedId(recordId); reset();
      if (received) router.replace({ pathname: '/paycheck/[id]', params: { id: recordId } });
    } catch (e) { reportError(e instanceof Error ? e.message : 'Invalid paycheck.'); } finally { saving.current = false; }
  };
  return <Page title={formOpen ? (crud.editingId ? 'Edit paycheck' : 'New paycheck') : 'Paycheck'}><TourHighlight id="paychecks-main"><Feedback />
    {savedId && !formOpen ? <><Completion message="Your paycheck is ready to plan." /><Action label="Review paycheck & allocations" variant="primary" fullWidth onPress={() => router.push({ pathname: '/paycheck/[id]', params: { id: savedId } })} /></> : null}
    {!formOpen ? <>
      {current ? <><CoastalBalance title="Current paycheck" amount={formatMoney(current.amountCents)} subtitle={`${current.source || 'Income'} · ${formatDateDisplay(current.receivedAt)}`} /><View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={{fontSize:13,color:colors.muted}}>Left to assign</Text><Text role="money">{formatMoney(unallocatedForPaycheck(data,current.id))}</Text></View><ProgressBar value={allocatedForPaycheck(data,current.id)} max={current.amountCents}/><Action label="Open paycheck plan" variant="primary" fullWidth onPress={()=>router.push({pathname:'/paycheck/[id]',params:{id:current.id}})}/></> : null}
      <Action label="+ Add paycheck" variant={current?'secondary':'primary'} fullWidth onPress={() => setFormOpen(true)} />
      {older.length ? <Action label={showArchive?'Hide other paychecks':`View other paychecks (${older.length})`} variant="text" fullWidth onPress={()=>setShowArchive(!showArchive)}/> : null}
      {showArchive ? <SectionTitle>Previous & planned paychecks</SectionTitle> : null}
    </> : <>
      {!crud.editingId || data.paychecks.find(p => p.id === crud.editingId)?.status === 'planned' ? <View style={{ flexDirection: 'row', gap: 10 }}><Action label="Planned" variant={status === 'planned' ? 'primary' : 'secondary'} onPress={() => setStatus('planned')} /><Action label="Received" variant={status === 'received' ? 'primary' : 'secondary'} onPress={() => setStatus('received')} /></View> : null}
      <Field label={status === 'planned' ? 'Expected amount' : 'Amount received'} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
      <DateField label={status === 'planned' ? 'Expected date' : 'Date received'} value={date} onChangeText={setDate} />
      <Field label="Income source (optional)" value={source} onChangeText={setSource} />
      {status !== 'planned' ? <>
      <Text style={{ fontWeight: '600' }}>Where should this paycheck be recorded?</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Action label="Budget paycheck only" variant={fundingMode === 'paycheck' ? 'primary' : 'secondary'} onPress={() => setFundingMode('paycheck')} />
        <Action label="Deposit to an account" variant={fundingMode === 'account' ? 'primary' : 'secondary'} onPress={() => setFundingMode('account')} />
      </View>
      {fundingMode === 'account' ? <>

        <SelectId label={data.paychecks.find(p => p.id === crud.editingId)?.accountId ? 'Move remaining funds to account' : 'Deposit account'} choices={data.accounts.map(item => ({ id: item.id, title: `${item.name}${item.type === 'credit_card' ? ' · card debt' : ''}`}))} value={accountId} onChange={setAccountId} create="account" />
        {data.paychecks.find(p => p.id === crud.editingId)?.accountId ? <Text>Only unspent funds move. This paycheck’s allocations and linked expenses stay in its history.</Text> : null}
      </> : null}
      </> : null}
      <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
      <Action label={status === 'planned' ? 'Save paycheck plan' : 'Save paycheck'} variant="primary" fullWidth onPress={() => void submit()} />
      <Action label="Cancel" onPress={reset} />
    </>}
    {!data.paychecks.length ? <EmptyState message="Make every paycheck count." /> : null}
    {!formOpen && showArchive ? older.map(p => {
      const depositName = data.accounts.find(account => account.id === p.accountId)?.name;
      const currentFundsName = data.accounts.find(account => account.id === (p.remainingAccountId ?? p.accountId))?.name;
      const accountDetail = p.accountId ? `Deposited to ${depositName ?? 'account'}${currentFundsName && currentFundsName !== depositName ? ` · remaining funds moved to ${currentFundsName}` : ''} · ` : 'Paycheck only · ';
      return <RecordLine icon="paycheck" key={p.id} title={`${p.status === 'planned' ? 'Planned · ' : ''}${formatDateDisplay(p.receivedAt)} · ${formatMoney(p.amountCents)}`} detail={`${p.source ?? 'Income'} · ${accountDetail}${formatMoney(allocatedForPaycheck(data, p.id))} allocated · ${formatMoney(unallocatedForPaycheck(data, p.id))} left`} progress={{ value: allocatedForPaycheck(data, p.id), max: p.amountCents, label: `${p.amountCents ? Math.round(allocatedForPaycheck(data, p.id) / p.amountCents * 100) : 0}% allocated` }} onView={() => router.push({ pathname: '/paycheck/[id]', params: { id: p.id } })} onEdit={() => { setStatus(p.status ?? 'received'); setAmount((p.amountCents / 100).toFixed(2)); setDate(formatDateInput(p.receivedAt)); setSource(p.source ?? ''); setNotes(p.notes ?? ''); setAccountId(p.remainingAccountId ?? p.accountId ?? ''); setFundingMode(p.accountId ? 'account' : 'paycheck'); crud.setEditingId(p.id); setFormOpen(true); }} onDelete={() => crud.confirmDelete(p.id)} />;
    }) : null}
  </TourHighlight></Page>;
}
