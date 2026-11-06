import { View } from 'react-native';
import { IconTile } from '../src/components/icons';
import { colors } from '../src/design/theme';
import { Text } from '../src/components/typography';
import React, { useEffect, useRef, useState } from 'react';

import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { TourHighlight } from '../src/components/walkthrough';
import { Card, ProgressBar, SectionTitle, Action, Field, Feedback, Page, RecordLine, SelectId } from '../src/components/ui';
import { useCrud } from '../src/components/hooks';
import { formatMoney, parseMoney } from '../src/domain/money';
import { allocationSummary, allocatedForPaycheck, nextSubscriptionDue, unallocatedForPaycheck } from '../src/domain/calculations';
import { useData } from '../src/state/DataProvider';
import { calculateNextPayday, formatDateDisplay, todayISODate } from '../src/domain/date';

export default function Budget() {
  const categoryCrud = useCrud('categories');
  const allocationCrud = useCrud('allocations');
  const { data, loading, saveRecord, planSubscription, reportError } = useData();
  const params = useLocalSearchParams<{ paycheckId?: string; allocationId?: string; add?: string }>();
  const router = useRouter();
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [allocationFormOpen, setAllocationFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [paycheckId, setPaycheck] = useState(params.paycheckId ?? '');
  const [categoryId, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const initializedAllocation = useRef('');
  const focused = useIsFocused();
  const upcomingPayday = data.user.nextPayday && data.user.paydayFrequency ? calculateNextPayday(data.user.nextPayday, todayISODate(data.user), data.user.paydayFrequency, data.user.paydayIntervalDays) : data.user.nextPayday;
  const upcomingSubscriptions = data.transactions.filter(item => item.type === 'subscription').map(item => ({ item, dueDate: nextSubscriptionDue(item, todayISODate(data.user)) })).filter((row): row is { item: typeof data.transactions[number]; dueDate: string } => !!row.dueDate && (!upcomingPayday || row.dueDate <= upcomingPayday)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const planPaycheck = [...data.paychecks].filter(item => !item.budgetArchived).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0];

  useEffect(() => {
    if (!focused) { initializedAllocation.current = ''; return; }
    if (loading) return;
    const key = `${params.paycheckId || ''}|${params.allocationId || ''}|${params.add || ''}`;
    if (initializedAllocation.current === key) return;
    setName(''); setPaycheck(''); setCategory(''); setAmount(''); categoryCrud.cancel(); allocationCrud.cancel(); setCategoryFormOpen(false); setAllocationFormOpen(false);
    if (params.add === '1') setAllocationFormOpen(true);
    if (params.paycheckId) { setPaycheck(params.paycheckId); setAllocationFormOpen(true); }
    const allocation = data.allocations.find(item => item.id === params.allocationId);
    if (params.allocationId && !allocation) return;
    if (allocation) { setPaycheck(allocation.paycheckId); setCategory(allocation.categoryId); setAmount((allocation.amountCents / 100).toFixed(2)); allocationCrud.setEditingId(allocation.id); setAllocationFormOpen(true); }
    initializedAllocation.current = key;
  }, [focused, loading, params.paycheckId, params.allocationId, params.add, data.allocations]);

  const clearCategory = () => { setName(''); categoryCrud.cancel(); setCategoryFormOpen(false); };
  const categorySave = async () => {
    if (!name.trim()) return reportError('Enter a category name.');
    const ok = await categoryCrud.submit({ name: name.trim() });
    if (ok) clearCategory();
  };
  const clearAllocation = () => { setPaycheck(''); setCategory(''); setAmount(''); allocationCrud.cancel(); setAllocationFormOpen(false); };
  const allocationSave = async () => {
    try {
      if (!paycheckId || !categoryId) return reportError('Choose a paycheck and category.');
      const cents = parseMoney(amount);
      const existing = data.allocations.find(a => a.id === allocationCrud.editingId);
      if (cents > (existing?.amountCents ?? 0) && cents > unallocatedForPaycheck(data, paycheckId) + (existing?.amountCents ?? 0)) return reportError('This amount is more than the paycheck left to assign.');
      const ok = await allocationCrud.submit({ paycheckId, categoryId, amountCents: cents });
      if (ok) {
        const savedPaycheck = paycheckId;
        clearAllocation();
        if (params.paycheckId || params.allocationId) router.replace({ pathname: '/paycheck/[id]', params: { id: savedPaycheck } });
      }
    } catch (e) { reportError(e instanceof Error ? e.message : 'Invalid allocation.'); }
  };

  if ((params.paycheckId || params.allocationId) && paycheckId) {
    const paycheck = data.paychecks.find(p => p.id === paycheckId);
    const previous = data.allocations.find(a => a.id === allocationCrud.editingId)?.amountCents ?? 0;
    let draft = 0;
    try { draft = amount.trim() ? parseMoney(amount) : 0; } catch { /* Input validation runs on save. */ }
    const remaining = unallocatedForPaycheck(data, paycheckId) + previous - draft;
    return <Page title={allocationCrud.editingId ? 'Edit Allocation' : 'Add Allocation'}><Feedback />
      <Card><Text>Left to Assign</Text><Text role="money" style={{ fontSize: 32 }}>{formatMoney(remaining)}</Text><Text style={{ color: '#69777A', fontSize: 14 }}>From {paycheck?.source || 'this paycheck'} · {paycheck ? formatDateDisplay(paycheck.receivedAt) : ''}</Text></Card>
      <SelectId label="Category" choices={data.categories.map(c => ({ id: c.id, title: c.name }))} value={categoryId} onChange={setCategory} create="category" />
      <Field label="Allocated amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
      <Action label="Save allocation" variant="primary" fullWidth onPress={() => void allocationSave()} />
      <Action label="Cancel" onPress={() => router.replace({ pathname: '/paycheck/[id]', params: { id: paycheckId } })} />
    </Page>;
  }

  return <Page title="Budget"><TourHighlight id="budget-main"><Feedback />

    <Card style={{ borderTopWidth: 4, borderTopColor: colors.blue, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconTile name="calendar" tint={colors.glass} />
        <Text accessibilityRole="header" style={{ flex: 1, fontSize: 23 }}>Bills & subscriptions</Text>
        {upcomingSubscriptions.length ? <View style={{ backgroundColor: colors.mist, minWidth: 30, minHeight: 30, borderRadius: 8, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' }}><Text accessibilityLabel={`${upcomingSubscriptions.length} upcoming bills and subscriptions`} style={{ fontSize: 15 }}>{upcomingSubscriptions.length}</Text></View> : null}
      </View>

    {!upcomingSubscriptions.length ? <Text>No upcoming bills or subscriptions before your next payday.</Text> : upcomingSubscriptions.map(({ item, dueDate }) => {
      const planned = !!planPaycheck && data.allocations.some(allocation => allocation.subscriptionId === item.id && allocation.paycheckId === planPaycheck.id);
      return <React.Fragment key={item.id}><RecordLine title={item.description} detail={`${formatMoney(item.amountCents)} · Due ${formatDateDisplay(dueDate)}${item.categoryId ? ` · ${data.categories.find(category => category.id === item.categoryId)?.name ?? 'Category'}` : ''}${item.accountId ? ` · ${data.accounts.find(account => account.id === item.accountId)?.name ?? 'Account'}` : ''}`} onEdit={() => router.push({ pathname: '/transactions', params: { editId: item.id } })} onDelete={() => router.push({ pathname: '/transactions', params: { editId: item.id } })} />{planned ? <Text>Included in paycheck plan · {formatDateDisplay(planPaycheck!.receivedAt)}</Text> : <Action label="Add to paycheck plan" onPress={() => void planSubscription(item.id)} />}</React.Fragment>;
    })}
    </Card>
    {!categoryFormOpen ? <Action label="+ Add category" variant="primary" fullWidth onPress={() => setCategoryFormOpen(true)} /> : <>
      <Field label={categoryCrud.editingId ? 'Category name' : 'New category name'} value={name} onChangeText={setName} />
      <Action label="Save category" variant="primary" fullWidth onPress={() => void categorySave()} />
      <Action label="Cancel" onPress={clearCategory} />
    </>}
    {!data.categories.length ? <Text>No categories yet.</Text> : null}
    {data.categories.map(category => <RecordLine key={category.id} title={category.name} detail="Budget category" onEdit={() => { setName(category.name); categoryCrud.setEditingId(category.id); setCategoryFormOpen(true); }} onDelete={() => categoryCrud.confirmDelete(category.id)} />)}

    {!allocationFormOpen ? <Action label="+ Allocate paycheck" variant="primary" fullWidth onPress={() => setAllocationFormOpen(true)} /> : <>
      <SelectId label="Paycheck" choices={data.paychecks.map(item => ({ id: item.id, title: `${formatDateDisplay(item.receivedAt)} · ${formatMoney(item.amountCents)}`}))} value={paycheckId} onChange={setPaycheck} />
      <SelectId label="Category" choices={data.categories.map(item => ({ id: item.id, title: item.name }))} value={categoryId} onChange={setCategory} create="category" />
      <Field label="Allocated amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
      <Action label="Save allocation" variant="primary" fullWidth onPress={() => void allocationSave()} />
      <Action label="Cancel" onPress={clearAllocation} />
    </>}

    <Text style={{ fontWeight: '600', fontSize: 17 }}>Active paycheck budgets</Text>
    {!data.paychecks.some(paycheck => !paycheck.budgetArchived && data.allocations.some(item => item.paycheckId === paycheck.id)) ? <Text>No active paycheck budgets. Add allocations to start budgeting.</Text> : null}
    {data.paychecks.filter(paycheck => !paycheck.budgetArchived && data.allocations.some(item => item.paycheckId === paycheck.id)).map(paycheck => <React.Fragment key={paycheck.id}>
      <Text>{formatDateDisplay(paycheck.receivedAt)}: {formatMoney(allocatedForPaycheck(data, paycheck.id))} allocated · {formatMoney(unallocatedForPaycheck(data, paycheck.id))} unallocated</Text>
      <Action label="Archive this paycheck budget" onPress={() => { void saveRecord('paychecks', { ...paycheck, budgetArchived: true }); }} />
      {data.allocations.filter(item => item.paycheckId === paycheck.id).map(allocation => <AllocationLine key={allocation.id} allocation={allocation} data={data} router={router} onEdit={() => { setPaycheck(allocation.paycheckId); setCategory(allocation.categoryId); setAmount((allocation.amountCents / 100).toFixed(2)); allocationCrud.setEditingId(allocation.id); setAllocationFormOpen(true); }} onDelete={() => allocationCrud.confirmDelete(allocation.id)} />)}
    </React.Fragment>)}

    <Text style={{ fontWeight: '600', fontSize: 17 }}>Archived paycheck budgets</Text>
    {!data.paychecks.some(paycheck => paycheck.budgetArchived && data.allocations.some(item => item.paycheckId === paycheck.id)) ? <Text>No archived paycheck budgets.</Text> : null}
    {data.paychecks.filter(paycheck => paycheck.budgetArchived && data.allocations.some(item => item.paycheckId === paycheck.id)).map(paycheck => <React.Fragment key={paycheck.id}>
      <Text>{formatDateDisplay(paycheck.receivedAt)}: {formatMoney(allocatedForPaycheck(data, paycheck.id))} allocated · {formatMoney(unallocatedForPaycheck(data, paycheck.id))} unallocated</Text>
      <Action label="Restore paycheck budget" onPress={() => { void saveRecord('paychecks', { ...paycheck, budgetArchived: false }); }} />
      {data.allocations.filter(item => item.paycheckId === paycheck.id).map(allocation => <AllocationLine key={allocation.id} allocation={allocation} data={data} router={router} onEdit={() => { setPaycheck(allocation.paycheckId); setCategory(allocation.categoryId); setAmount((allocation.amountCents / 100).toFixed(2)); allocationCrud.setEditingId(allocation.id); setAllocationFormOpen(true); }} onDelete={() => allocationCrud.confirmDelete(allocation.id)} />)}
    </React.Fragment>)}
  </TourHighlight></Page>;
}

function AllocationLine({ allocation, data, router, onEdit, onDelete }: { allocation: (typeof data.allocations)[number]; data: ReturnType<typeof useData>['data']; router: ReturnType<typeof useRouter>; onEdit: () => void; onDelete: () => void }) {
  const summary = allocationSummary(data, allocation);
  const category = data.categories.find(item => item.id === allocation.categoryId);
  return <RecordLine title={category?.name ?? 'Unknown category'} detail={`${formatMoney(summary.allocatedCents)} allocated · ${formatMoney(summary.spentCents)} spent · ${formatMoney(summary.remainingCents)} ${summary.remainingCents < 0 ? 'remaining · Over budget' : 'left'}`} onView={() => router.push({ pathname: '/allocation/[id]', params: { id: allocation.id } })} onEdit={onEdit} onDelete={onDelete} />;
}
