import { Card } from '../src/components/ui';
import { EmptyState } from '../src/components/coastal';
import { Text } from '../src/components/typography';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { Action, DateField, Field, Feedback, Page, RecordLine, SelectId } from '../src/components/ui';
import { useCrud } from '../src/components/hooks';
import { newId, SubscriptionFrequency, Transaction, TransactionType } from '../src/domain/models';
import { formatMoney, parseMoney } from '../src/domain/money';
import { useData } from '../src/state/DataProvider';
import { formatDateDisplay, formatDateInput, normalizeDateInput, todayDateInput } from '../src/domain/date';
import { TourHighlight } from '../src/components/walkthrough';

const kinds: TransactionType[] = ['expense', 'income', 'transfer', 'subscription'];
const subscriptionFrequencies: SubscriptionFrequency[] = ['weekly', 'biweekly', 'monthly', 'annual', 'custom'];

export default function Transactions() {
  const crud = useCrud('transactions');
  const { data, loading, reportError, settleGoalContribution } = useData();
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ allocationId?: string; accountId?: string; editId?: string; goalContributionId?: string; type?: string }>();
  const [formOpen, setFormOpen] = useState(pathname === '/transaction/new');
  const [filter, setFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<TransactionType>(params.type === 'transfer' ? 'transfer' : 'expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayDateInput());
  const [categoryId, setCategory] = useState('');
  const [allocationId, setAllocation] = useState('');
  const [accountId, setAccount] = useState('');
  const [toAccountId, setToAccount] = useState('');
  const [paycheckId, setPaycheckId] = useState('');
  const [notes, setNotes] = useState('');
  const [subscriptionFrequency, setSubscriptionFrequency] = useState<SubscriptionFrequency>('monthly');
  const [subscriptionInterval, setSubscriptionInterval] = useState('');
  const [nextDueDate, setNextDueDate] = useState(todayDateInput());
  const appliedParams = useRef('');
  const paramKey = `${params.editId ?? ''}|${params.allocationId ?? ''}|${params.accountId ?? ''}|${params.goalContributionId ?? ''}`;

  const fill = (tx: Transaction) => {
    setKind(tx.type); setDescription(tx.description); setAmount((tx.amountCents / 100).toFixed(2)); setDate(formatDateInput(tx.date));
    setCategory(tx.categoryId ?? ''); setAllocation(tx.allocationId ?? ''); setAccount(tx.accountId ?? '');
    setToAccount(tx.toAccountId ?? ''); setPaycheckId(tx.paycheckId ?? ''); setNotes(tx.notes ?? ''); setFormOpen(true);
    setSubscriptionFrequency(tx.subscriptionFrequency ?? 'monthly'); setSubscriptionInterval(tx.subscriptionIntervalDays?.toString() ?? ''); setNextDueDate(formatDateInput(tx.nextDueDate ?? tx.date));
  };

  useEffect(() => {
    if (loading || appliedParams.current === paramKey) return;
    const toEdit = data.transactions.find(item => item.id === params.editId);
    if (toEdit) { fill(toEdit); crud.setEditingId(toEdit.id); }
    const contribution = data.contributions.find(item => item.id === params.goalContributionId && item.status === 'pending');
    if (contribution) {
      setKind('transfer'); setDescription(`Goal contribution · ${data.goals.find(goal => goal.id === contribution.goalId)?.name ?? 'Savings goal'}`);
      setAmount((contribution.amountCents / 100).toFixed(2)); setDate(todayDateInput()); setAccount(contribution.accountId ?? '');
      setCategory(''); setAllocation(''); setFormOpen(true);
    }
    const allocation = data.allocations.find(item => item.id === params.allocationId);
    if (allocation) { setAllocation(allocation.id); setCategory(allocation.categoryId); }
    if (!params.goalContributionId && params.accountId && data.accounts.some(item => item.id === params.accountId)) setAccount(params.accountId);
    appliedParams.current = paramKey;
  }, [loading, data.transactions, data.contributions, data.goals, data.allocations, data.accounts, params.allocationId, params.accountId, params.editId, params.goalContributionId, paramKey]);

  const reset = (close = true) => {
    setKind('expense'); setDescription(''); setAmount(''); setDate(todayDateInput());
    setCategory(''); setAllocation(''); setAccount(''); setToAccount(''); setPaycheckId(''); setNotes(''); setSubscriptionFrequency('monthly'); setSubscriptionInterval(''); setNextDueDate(todayDateInput()); crud.cancel();
    if (close) {
      setFormOpen(false);
      if (pathname === '/transaction/new') router.replace('/transactions');
    }
  };
  const submit = async () => {
    try {
      if (!description.trim()) return reportError('Enter a transaction description.');
      const transactionDate = normalizeDateInput(date);
      if (!transactionDate) return reportError('Enter a valid date as M/D/YYYY.');
      const normalizedDueDate = kind === 'subscription' ? normalizeDateInput(nextDueDate) : undefined;
      if (kind === 'subscription' && !normalizedDueDate) return reportError('Enter a valid next charge date as M/D/YYYY.');
      if (kind === 'subscription' && subscriptionFrequency === 'custom' && (!/^\d+$/.test(subscriptionInterval) || Number(subscriptionInterval) < 1 || Number(subscriptionInterval) > 365)) return reportError('Choose a repeat interval from 1 to 365 days.');
      const allocation = data.allocations.find(item => item.id === allocationId);
      if (params.goalContributionId) {
        const settled = await settleGoalContribution(params.goalContributionId, {
          id: newId(), type: kind, description: description.trim(), amountCents: parseMoney(amount), date: transactionDate,
          categoryId: kind === 'expense' ? (allocation?.categoryId ?? categoryId) || undefined : undefined,
          allocationId: kind === 'expense' ? allocationId || undefined : undefined,
          accountId: accountId || undefined, toAccountId: kind === 'transfer' ? toAccountId || undefined : undefined,
          notes: notes || undefined,
        });
        if (settled) reset();
        return;
      }
      const previousTransaction = data.transactions.find(item => item.id === crud.editingId);
      const ok = await crud.submit({
        type: kind, description: description.trim(), amountCents: parseMoney(amount), date: transactionDate,
        categoryId: kind === 'expense' ? (allocation?.categoryId ?? categoryId) || undefined : kind === 'subscription' ? categoryId || undefined : undefined,
        allocationId: kind === 'expense' ? allocationId || undefined : undefined,
        accountId: accountId || undefined, toAccountId: kind === 'transfer' ? toAccountId || undefined : undefined,
        paycheckId: kind === 'transfer' ? paycheckId || undefined : undefined,
        notes: notes || undefined,
        goalContributionId: previousTransaction?.goalContributionId,
        subscriptionFrequency: kind === 'subscription' ? subscriptionFrequency : undefined,
        subscriptionIntervalDays: kind === 'subscription' && subscriptionFrequency === 'custom' ? Number(subscriptionInterval) : undefined,
        nextDueDate: normalizedDueDate,
      });
      if (ok) { setSaved(true); reset(); }
    } catch (e) { reportError(e instanceof Error ? e.message : 'Invalid transaction.'); }
  };
  const filtered = [...data.transactions].sort((a, b) => b.date.localeCompare(a.date)).filter(tx => {
    const accountName = data.accounts.find(item => item.id === tx.accountId)?.name ?? '';
    const categoryName = data.categories.find(item => item.id === tx.categoryId)?.name ?? '';
    const query = search.trim().toLowerCase();
    return (filter === 'all' || tx.type === filter) && (!query || `${tx.description} ${tx.type} ${accountName} ${categoryName} ${tx.date}`.toLowerCase().includes(query));
  });

  return <Page title={pathname === '/transaction/new' ? 'Add transaction' : 'Transactions'}><TourHighlight id="expense-main"><Feedback />
    {saved ? <Card><Text accessibilityRole="alert">Transaction saved.</Text></Card> : null}
    {!formOpen ? <>
      <View style={{ flexDirection: 'row', gap: 8 }}>{(['all', 'expense', 'income'] as const).map(f => <Action key={f} label={f === 'all' ? 'All' : f === 'expense' ? 'Expenses' : 'Income'} variant={filter === f ? 'primary' : 'secondary'} onPress={() => setFilter(f)} />)}</View>
      <Field label="Search transactions" value={search} onChangeText={setSearch} placeholder="Search description, category, account" />
      <Action label="+ Add transaction" variant="primary" fullWidth onPress={() => router.push('/transaction/new')} />
    </> : <>
      <View style={{ padding: 12, borderRadius: 10, backgroundColor: '#D9DFE6' }}><Text>Enter a purchase, income, transfer, or subscription reminder. Subscription reminders do not change account balances; log the charge as an expense when it is paid.</Text></View>
      {params.goalContributionId ? <View style={{ padding: 12, borderRadius: 10, backgroundColor: '#D9DFE6' }}><Text>Transfer this reserved amount to another account. Scuttle records both sides, releases the pending hold, and keeps goal progress counted once.</Text></View> : null}
      <Text style={{ fontWeight: '600' }}>Transaction type</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(params.goalContributionId ? ['expense', 'transfer'] as TransactionType[] : kinds).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: kind === value }} onPress={() => setKind(value)} style={{ paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: kind === value ? '#69777A' : '#E9E7E2', borderRadius: 8, backgroundColor: kind === value ? '#344447' : '#fff' }}><Text style={{ color: kind === value ? '#fff' : '#344447', fontWeight: kind === value ? '700' : '400' }}>{value === 'expense' ? 'Expense' : value === 'income' ? 'Income' : value === 'transfer' ? 'Transfer' : 'Subscription'}</Text></Pressable>)}</View>
      <Field label="Payee / description" value={description} onChangeText={setDescription} placeholder="e.g. Groceries" />
      {params.goalContributionId ? <Text>Pending amount to post: {formatMoney(parseMoney(amount) || 0)}</Text> : <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />}
      {kind === 'subscription' ? <>
        <Text style={{ fontWeight: '600' }}>Repeat schedule</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{subscriptionFrequencies.map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: subscriptionFrequency === value }} onPress={() => setSubscriptionFrequency(value)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: subscriptionFrequency === value ? '#69777A' : '#E9E7E2', borderRadius: 8, backgroundColor: subscriptionFrequency === value ? '#344447' : '#fff' }}><Text style={{ color: subscriptionFrequency === value ? '#fff' : '#344447' }}>{value === 'biweekly' ? 'Every 2 weeks' : value === 'annual' ? 'Yearly' : value === 'custom' ? 'Other' : value[0].toUpperCase() + value.slice(1)}</Text></Pressable>)}</View>
        {subscriptionFrequency === 'custom' ? <Field label="Repeat every (days)" value={subscriptionInterval} onChangeText={setSubscriptionInterval} keyboardType="numeric" placeholder="e.g. 30" /> : null}
        <DateField label="Next charge date" value={nextDueDate} onChangeText={setNextDueDate} />
      </> : <DateField label="Date" value={date} onChangeText={setDate} />}
      {kind === 'expense' ? <>
        {params.allocationId && data.allocations.some(item => item.id === params.allocationId) ? <Text>Budget category: {data.categories.find(item => item.id === data.allocations.find(a => a.id === params.allocationId)?.categoryId)?.name ?? 'Selected allocation'}</Text> : <>
          <SelectId label="Category (optional)" choices={data.categories.map(item => ({ id: item.id, title: item.name }))} value={categoryId} onChange={value => { setCategory(value); setAllocation(''); }} create="category" />
          <Text style={{ color: '#69777A', fontSize: 12 }}>Expenses are applied to the matching active paycheck budget automatically.</Text>
        </>}
      </> : kind === 'subscription' ? <>
        <SelectId label="Budget category (optional)" choices={data.categories.map(item => ({ id: item.id, title: item.name }))} value={categoryId} onChange={setCategory} create="category" />
        <Text style={{ color: '#69777A', fontSize: 12 }}>This reminder appears on the dashboard and budget page when a charge is approaching.</Text>
      </> : null}
      {params.goalContributionId ? <Text>Funding account: {data.accounts.find(item => item.id === accountId)?.name ?? 'Missing account'}</Text> : <SelectId label={kind === 'transfer' ? 'Source account' : kind === 'subscription' ? 'Account charged (optional)' : 'Account (optional)'} choices={data.accounts.map(item => ({ id: item.id, title: `${item.name}${item.type === 'credit_card' ? ' · credit card' : ''}`}))} value={accountId} onChange={value => { setAccount(value); if (toAccountId === value) setToAccount(''); }} create="account" />}
      {kind === 'transfer' ? <SelectId label="Destination account" choices={data.accounts.filter(item => item.id !== accountId).map(item => ({ id: item.id, title: item.name }))} value={toAccountId} onChange={setToAccount} create="account" /> : null}
      <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
      <Action label={crud.editingId ? 'Save changes' : params.goalContributionId ? 'Post transfer and clear reservation' : kind === 'subscription' ? 'Save subscription' : 'Save transaction'} variant="primary" fullWidth onPress={() => void submit()} />
      <Action label="Cancel" onPress={() => reset()} />
    </>}
    {!formOpen ? <>
      <Text style={{ fontWeight: '600', fontSize: 17 }}>Activity</Text>
      {!filtered.length ? <EmptyState message={search ? 'No matching transactions.' : 'Your activity starts here.'} /> : null}
      {filtered.map(tx => <RecordLine key={tx.id} icon={tx.type === 'transfer' ? 'move' : 'transaction'} title={tx.description} amount={`${tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : ''}${formatMoney(tx.amountCents)}`} detail={`${formatDateDisplay(tx.type === 'subscription' ? tx.nextDueDate ?? tx.date : tx.date)} · ${tx.type}${tx.categoryId ? ` · ${data.categories.find(c => c.id === tx.categoryId)?.name ?? ''}` : ''}${tx.accountId ? ` · ${data.accounts.find(a => a.id === tx.accountId)?.name ?? 'Account'}` : ''}`} onView={() => { fill(tx); crud.setEditingId(tx.id); }} onEdit={() => { fill(tx); crud.setEditingId(tx.id); }} onDelete={() => crud.confirmDelete(tx.id)} />)}
    </> : null}
  </TourHighlight></Page>;
}
