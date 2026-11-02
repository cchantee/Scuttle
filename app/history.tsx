import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '../src/design/Text';
import { colors } from '../src/design/theme';
import { Action, Card, DateField, Field, Feedback, Page, RecordLine, SectionTitle, SelectId } from '../src/components/ui';
import { EmptyState } from '../src/components/brand';
import { activityRows, filterActivity } from '../src/components/activity';
import { formatMoney } from '../src/domain/money';
import { useData } from '../src/state/DataProvider';
import { useCrud } from '../src/components/hooks';
import { formatDateDisplay, normalizeDateInput } from '../src/domain/date';

export default function History() {
  const { data } = useData();
  const router = useRouter();
  const paycheckCrud = useCrud('paychecks');
  const allocationCrud = useCrud('allocations');
  const transactionCrud = useCrud('transactions');
  const contributionCrud = useCrud('contributions');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [category, setCategory] = useState('');
  const [paycheck, setPaycheck] = useState('');
  const [account, setAccount] = useState('');
  const [kind, setKind] = useState('money');
  const rows = useMemo(() => activityRows(data), [data]);
  const fromISO = from ? normalizeDateInput(from) : '';
  const toISO = to ? normalizeDateInput(to) : '';
  const invalidDate = (from && !fromISO) || (to && !toISO) || (fromISO && toISO && fromISO > toISO);
  const filtered = filterActivity(rows, { search, from: fromISO || '', to: toISO || '', categoryId: category, paycheckId: paycheck, accountId: account, kind });
  const items = invalidDate ? [] : filtered;
  const activeFilters = [from, to, category, paycheck, account, kind === 'money' ? '' : kind].filter(Boolean).length;
  const clear = () => { setFrom(''); setTo(''); setCategory(''); setPaycheck(''); setAccount(''); setKind('money'); setSearch(''); };
  const cruds = { paychecks: paycheckCrud, allocations: allocationCrud, transactions: transactionCrud, contributions: contributionCrud };
  return <Page title="Activity"><Feedback />
    <Text style={{ color: colors.muted }}>Your recorded income, spending, and transfers. Use All records to include plans, goals, allocations, and reminders.</Text>
    <Field label="Search activity" value={search} onChangeText={setSearch} placeholder="Description, account, category, or date" />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Action label={`${showFilters ? 'Hide' : 'Show'} filters${activeFilters ? ` (${activeFilters})` : ''}`} onPress={() => setShowFilters(!showFilters)} />{activeFilters || search ? <Action label="Clear all" variant="text" onPress={clear} /> : null}</View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Action label="Money activity" selected={kind === 'money'} variant={kind === 'money' ? 'primary' : 'secondary'} onPress={() => setKind('money')} /><Action label="All records" selected={kind === 'all'} variant={kind === 'all' ? 'primary' : 'secondary'} onPress={() => setKind('all')} /></View>
    {showFilters ? <Card><SectionTitle>Find what you need</SectionTitle>
      <SelectId label="Activity type" choices={[{ id: 'money', title: 'Money activity' }, { id: 'all', title: 'All records' }, ...['expense', 'income', 'transfer', 'paycheck', 'allocation', 'contribution', 'subscription'].map(id => ({ id, title: id[0].toUpperCase() + id.slice(1) }))]} value={kind} onChange={setKind} />
      <DateField label="From date" value={from} onChangeText={setFrom} optional /><DateField label="To date" value={to} onChangeText={setTo} optional />
      <SelectId label="Category" choices={data.categories.map(c => ({ id: c.id, title: c.name }))} value={category} onChange={setCategory} />
      <SelectId label="Paycheck" choices={data.paychecks.map(p => ({ id: p.id, title: `${p.source || 'Paycheck'} · ${formatDateDisplay(p.receivedAt)} · ${formatMoney(p.amountCents)}` }))} value={paycheck} onChange={setPaycheck} />
      <SelectId label="Account" choices={data.accounts.map(a => ({ id: a.id, title: a.name }))} value={account} onChange={setAccount} />
    </Card> : null}
    {invalidDate ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>Enter valid dates with the start on or before the end.</Text> : null}
    {!items.length && !invalidDate ? <EmptyState title={rows.length ? 'No matches just yet.' : 'Your story starts here.'} detail={rows.length ? 'Try another search or clear your filters.' : 'Record a paycheck or transaction to see your financial activity here.'} /> : null}
    {items.map((item, index) => <React.Fragment key={item.id}>
      {index === 0 || items[index - 1].date !== item.date ? <SectionTitle>{formatDateDisplay(item.date)}</SectionTitle> : null}
      <RecordLine title={item.title} detail={item.detail} amount={`${item.sign}${formatMoney(item.amountCents)}`} tone={item.sign === '−' ? 'caution' : item.sign === '+' ? 'positive' : 'default'} onView={() => router.push({ pathname: item.route, params: item.params } as never)} onEdit={() => router.push({ pathname: item.route, params: item.params } as never)} onDelete={() => cruds[item.collection].confirmDelete(item.recordId)} />
    </React.Fragment>)}
  </Page>;
}
