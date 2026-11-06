import { Card } from '../src/components/ui';
import { EmptyState, CoastalBalance } from '../src/components/coastal';
import { Text } from '../src/components/typography';
import React, { useEffect, useRef, useState } from 'react';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';

import { Action, Field, Feedback, Page, RecordLine } from '../src/components/ui';
import { useCrud } from '../src/components/hooks';
import { AccountType } from '../src/domain/models';
import { accountBalance, availableAccountBalance, pendingForAccount } from '../src/domain/calculations';
import { formatMoney, parseMoney } from '../src/domain/money';
import { useData } from '../src/state/DataProvider';

const types: { id: AccountType; label: string }[] = [
  { id: 'checking', label: 'Checking' }, { id: 'savings', label: 'Savings' },
  { id: 'high_yield_savings', label: 'High-yield savings' }, { id: 'cash', label: 'Cash' },
  { id: 'credit_card', label: 'Credit card' },
];

export default function Accounts() {
  const crud = useCrud('accounts');
  const router = useRouter();
  const { data, loading, reportError } = useData();
  const params = useLocalSearchParams<{ accountId?: string }>();
  const initializedId = useRef('');
  const focused = useIsFocused();
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [balance, setBalance] = useState('0.00');
  const [interestRate, setInterestRate] = useState('');
  const [notes, setNotes] = useState('');
  useEffect(() => {
    if (!focused) { initializedId.current = ''; return; }
    if (loading) return;
    const key = params.accountId || 'list';
    if (initializedId.current === key) return;
    reset();
    const account = data.accounts.find(item => item.id === params.accountId);
    if (params.accountId && !account) return;
    if (account) { setName(account.name); setType(account.type); setBalance((account.initialBalanceCents / 100).toFixed(2)); setInterestRate(account.interestRatePercent?.toString() ?? ''); setNotes(account.notes ?? ''); crud.setEditingId(account.id); setFormOpen(true); }
    initializedId.current = key;
  }, [focused, loading, params.accountId, data.accounts]);
  const reset = () => { setName(''); setType('checking'); setBalance('0.00'); setInterestRate(''); setNotes(''); crud.cancel(); setFormOpen(false); };
  const submit = async () => {
    try {
      if (!name.trim()) return reportError('Enter an account name.');
      const ok = await crud.submit({ name: name.trim(), type, initialBalanceCents: parseMoney(balance), interestRatePercent: supportsInterest(type) && interestRate.trim() !== '' ? Number(interestRate) : undefined, notes: notes || undefined });
      if (ok) reset();
    } catch (e) { reportError(e instanceof Error ? e.message : 'Invalid amount.'); }
  };

  return <Page title="Accounts"><Feedback />
    {!formOpen && data.accounts.length ? <CoastalBalance title="Total Cash Balance" amount={formatMoney(data.accounts.filter(a => a.type !== 'credit_card').reduce((sum, a) => sum + accountBalance(data, a), 0))} subtitle="checking, savings, and cash" /> : null}
    {!formOpen ? <Action label="+ Add account" variant="primary" fullWidth onPress={() => setFormOpen(true)} /> : <>
      <Field label="Account name" value={name} onChangeText={setName} />
      <TextLabel>Account type</TextLabel>
      {types.map(t => <Action key={t.id} label={`${type === t.id ? '✓ ' : ''}${t.label}`} onPress={() => setType(t.id)} />)}
      <Field label={type === 'credit_card' ? 'Starting amount owed' : 'Starting account balance'} value={balance} onChangeText={setBalance} keyboardType="decimal-pad" />
      {supportsInterest(type) ? <><Field label={type === 'credit_card' ? 'Interest rate (APR %, optional)' : 'Interest rate (APY %, optional)'} value={interestRate} onChangeText={setInterestRate} keyboardType="decimal-pad" placeholder="e.g. 4.25" /><TextLabel>Used for Scuttle’s interest estimate. Changes apply from today and preserve prior accrued or credited interest.</TextLabel></> : null}
      <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
      <Action label={crud.editingId ? 'Save account' : 'Add account'} variant="primary" fullWidth onPress={() => void submit()} />
      <Action label="Cancel" onPress={reset} />
    </>}
    {!data.accounts.length ? <EmptyState message="Your money, all in one place." /> : null}
    {!formOpen ? data.accounts.map(a => {
      const pending = pendingForAccount(data, a.id);
      const available = availableAccountBalance(data, a);
      return <RecordLine icon="accounts" amount={formatMoney(accountBalance(data, a))} key={a.id} title={a.name} detail={`${a.type.replace(/_/g, ' ')}${pending ? ` · ${formatMoney(pending)} pending` : ''}`} onView={() => router.push({ pathname: '/account/[id]', params: { id: a.id } })} onEdit={() => { setName(a.name); setType(a.type); setBalance((a.initialBalanceCents / 100).toFixed(2)); setInterestRate(a.interestRatePercent?.toString() ?? ''); setNotes(a.notes ?? ''); crud.setEditingId(a.id); setFormOpen(true); }} onDelete={() => crud.confirmDelete(a.id)} />;
    }) : null}
  </Page>;
}

function TextLabel({ children }: React.PropsWithChildren) { return <Text style={{ color: '#344447' }}>{children}</Text>; }
function supportsInterest(type: AccountType) { return type === 'savings' || type === 'high_yield_savings' || type === 'credit_card'; }
