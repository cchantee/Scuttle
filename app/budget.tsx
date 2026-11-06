import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '../src/design/Text';
import { colors } from '../src/design/theme';
import { Action, Card, Disclosure, Feedback, Field, Page, RecordLine, SectionTitle, SelectId } from '../src/components/ui';
import { EmptyState, Metric } from '../src/components/brand';
import { useData } from '../src/state/DataProvider';
import { useCrud } from '../src/components/hooks';
import { activeBudgetAllocations, allocatedForPaycheck, allocationSummary, nextSubscriptionDue, newestPaychecks, unallocatedForPaycheck } from '../src/domain/calculations';
import { formatMoney, parseMoney } from '../src/domain/money';
import { formatDateDisplay, todayISODate } from '../src/domain/date';

export default function Budget() {
  const { data, saveRecord, planSubscription } = useData();
  const router = useRouter();
  const params = useLocalSearchParams<{ paycheckId?: string; allocationId?: string; add?: string }>();
  const categoryCrud = useCrud('categories');
  const allocationCrud = useCrud('allocations');
  const [tab, setTab] = useState('spending');
  const initializedParams = useRef('');
  const [name, setName] = useState('');
  const [allocationOpen, setAllocationOpen] = useState(false);
  const [paycheckId, setPaycheckId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    const key = `${params.allocationId || ''}|${params.paycheckId || ''}|${params.add || ''}`;
    if (initializedParams.current === key) return;
    if (params.allocationId) {
      const a = data.allocations.find(a => a.id === params.allocationId);
      if (!a) return;
      allocationCrud.setEditingId(a.id); setPaycheckId(a.paycheckId); setCategoryId(a.categoryId); setAmount((a.amountCents / 100).toFixed(2)); setAllocationOpen(true);
    } else if (params.paycheckId || params.add === '1') { setPaycheckId(params.paycheckId || ''); setAllocationOpen(true); }
    initializedParams.current = key;
  }, [params.allocationId, params.paycheckId, params.add, data.allocations]);
  const active = activeBudgetAllocations(data);
  const total = active.reduce((sum, a) => sum + a.amountCents, 0);
  const spent = active.reduce((sum, a) => sum + allocationSummary(data, a).spentCents, 0);
  const paychecks = newestPaychecks(data.paychecks.filter(p => tab === 'archived' ? p.budgetArchived : tab === 'planned' ? !p.budgetArchived && p.status === 'planned' : !p.budgetArchived && p.status !== 'planned'));
  const planPaycheck = newestPaychecks(data.paychecks.filter(p => !p.budgetArchived))[0];
  const subscriptions = data.transactions.filter(t => t.type === 'subscription').map(t => ({ t, due: nextSubscriptionDue(t, todayISODate(data.user)) })).filter(row => row.due).sort((a, b) => a.due!.localeCompare(b.due!));
  const saveAllocation = async () => {
    try { if (!paycheckId || !categoryId) { setMessage('Choose a paycheck and a category.'); return; } if (await allocationCrud.submit({ paycheckId, categoryId, amountCents: parseMoney(amount) })) { setAllocationOpen(false); setMessage(''); } }
    catch { setMessage('Enter a valid dollar amount.'); }
  };
  return <Page title="Budget"><Feedback />
    {!allocationOpen ? <>
      {tab === 'spending' ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}><Metric label="Left in spending categories" amount={formatMoney(total - spent)} caution={spent > total} detail={`${formatMoney(spent)} spent of ${formatMoney(total)} budgeted`} /></View> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[{ id: 'spending', title: 'Spending' }, { id: 'planned', title: 'Planned' }, { id: 'archived', title: 'Archived' }].map(t => <Action key={t.id} label={t.title} selected={tab === t.id} variant={tab === t.id ? 'primary' : 'secondary'} onPress={() => setTab(t.id)} />)}</View>
      {tab === 'planned' ? <Text style={{ color: colors.muted }}>These plans use expected income. They are not part of your spending budget yet.</Text> : tab === 'archived' ? <Text style={{ color: colors.muted }}>Archived budgets stay in history. Restore one to use its category balances again.</Text> : null}
      {!paychecks.length ? <EmptyState title={tab === 'spending' ? 'Build your spending plan.' : `No ${tab} budgets.`} detail={tab === 'spending' ? 'Add a paycheck, then choose the amounts your categories need.' : 'Other budgets are available in the adjacent tabs.'}>{tab === 'spending' ? <Action label="Add paycheck" variant="primary" onPress={() => router.push({ pathname: '/paychecks', params: { add: '1' } })} /> : null}</EmptyState> : null}
      {paychecks.map(p => <View key={p.id} style={{ gap: 12 }}><SectionTitle>{p.source || 'Paycheck'} · {formatDateDisplay(p.receivedAt)}</SectionTitle><Text style={{ color: colors.muted }}>{formatMoney(p.amountCents)} {p.status === 'planned' ? 'expected' : 'received'} · {formatMoney(unallocatedForPaycheck(data, p.id))} left to budget</Text>
        <Action label={`Edit plan${p.source ? ` · ${p.source}` : ''}`} fullWidth onPress={() => router.push({ pathname: '/paycheck/plan/[id]', params: { id: p.id } })} />
        {data.allocations.filter(a => a.paycheckId === p.id).map(a => { const summary = allocationSummary(data, a); return <RecordLine key={a.id} title={data.categories.find(c => c.id === a.categoryId)?.name || 'Category'} amount={`${formatMoney(Math.abs(summary.remainingCents))} ${summary.remainingCents < 0 ? 'over budget' : 'remaining'}`} tone={summary.remainingCents < 0 ? 'caution' : 'default'} detail={`${formatMoney(a.amountCents)} budgeted · ${formatMoney(summary.spentCents)} spent${a.subscriptionId ? ' · recurring bill' : ''}`} progress={{ value: summary.spentCents, max: a.amountCents, label: `${a.amountCents ? Math.round(summary.spentCents / a.amountCents * 100) : 0}% spent` }} onView={() => router.push({ pathname: '/allocation/[id]', params: { id: a.id } })} onEdit={() => router.push({ pathname: '/paycheck/plan/[id]', params: { id: p.id } })} onDelete={() => allocationCrud.confirmDelete(a.id)} />; })}
        <Disclosure title={`Options · ${p.source || formatDateDisplay(p.receivedAt)}`}><Text>{formatMoney(allocatedForPaycheck(data, p.id))} total assigned to categories and goals.</Text><Action label="Open paycheck details" onPress={() => router.push({ pathname: '/paycheck/[id]', params: { id: p.id } })} /><Action label={p.budgetArchived ? 'Restore budget' : 'Archive budget'} onPress={() => saveRecord('paychecks', { ...p, budgetArchived: !p.budgetArchived })} /></Disclosure>
      </View>)}
    </> : <Card><SectionTitle>{allocationCrud.editingId ? 'Edit category amount' : 'Add category amount'}</SectionTitle><SelectId label="Paycheck" choices={data.paychecks.map(p => ({ id: p.id, title: `${p.source || 'Paycheck'} · ${formatDateDisplay(p.receivedAt)} · ${formatMoney(p.amountCents)}` }))} value={paycheckId} onChange={setPaycheckId} /><SelectId label="Category" choices={data.categories.map(c => ({ id: c.id, title: c.name }))} value={categoryId} onChange={setCategoryId} create="category" /><Field label="Amount ($)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />{message ? <Text style={{ color: colors.danger }}>{message}</Text> : null}<Action label="Save category amount" variant="primary" fullWidth onPress={saveAllocation} /><Action label="Cancel" onPress={() => { setAllocationOpen(false); allocationCrud.cancel(); }} /></Card>}
    <Disclosure title="Manage categories">
      <Text style={{ color: colors.muted }}>Categories are reusable names. Their budget amounts belong to individual paychecks.</Text>
      <Field label={categoryCrud.editingId ? 'Rename category' : 'New category name'} value={name} onChangeText={setName} />
      <Action label={categoryCrud.editingId ? 'Save name' : 'Create category'} onPress={async () => { if (await categoryCrud.submit({ name: name.trim() })) { setName(''); } }} />
      {data.categories.map(c => <RecordLine key={c.id} title={c.name} detail="Budget category" onEdit={() => { categoryCrud.setEditingId(c.id); setName(c.name); }} onDelete={() => categoryCrud.confirmDelete(c.id)} />)}
    </Disclosure>
    <Disclosure title={`Recurring bills (${subscriptions.length})`}>
      <Text style={{ color: colors.muted }}>These are reminders. Log paid charges as expenses to update your balances.</Text>
      {subscriptions.map(({ t, due }) => { const included = planPaycheck && data.allocations.some(a => a.subscriptionId === t.id && a.paycheckId === planPaycheck.id); return <Card key={t.id}><Text style={{ fontWeight: '700' }}>{t.description} · {formatMoney(t.amountCents)}</Text><Text>Next due {formatDateDisplay(due!)}</Text><Action label="Edit recurring bill" variant="text" onPress={() => router.push({ pathname: '/transactions', params: { editId: t.id } })} />{included ? <Text>Included in {planPaycheck.source || 'latest paycheck'}.</Text> : <><Text style={{ color: colors.muted, fontSize: 13 }}>{planPaycheck ? `Add to ${planPaycheck.source || 'paycheck'} · ${formatDateDisplay(planPaycheck.receivedAt)}` : 'Add a paycheck before planning this bill.'}</Text><Action label="Add to latest paycheck plan" disabled={!planPaycheck} onPress={() => planSubscription(t.id)} /></>}</Card>; })}
      <Action label="Add recurring bill" onPress={() => router.push({ pathname: '/transaction/new', params: { type: 'subscription' } })} />
    </Disclosure>
  </Page>;
}
