import React, { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Action, Field, Feedback, Page, RecordLine, SelectId } from '../src/components/ui';
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
  const upcomingPayday = data.user.nextPayday && data.user.paydayFrequency ? calculateNextPayday(data.user.nextPayday, todayISODate(), data.user.paydayFrequency, data.user.paydayIntervalDays) : data.user.nextPayday;
  const upcomingSubscriptions = data.transactions.filter(item => item.type === 'subscription').map(item => ({ item, dueDate: nextSubscriptionDue(item, todayISODate()) })).filter((row): row is { item: typeof data.transactions[number]; dueDate: string } => !!row.dueDate && (!upcomingPayday || row.dueDate <= upcomingPayday)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const planPaycheck = [...data.paychecks].filter(item => !item.budgetArchived).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0];

  useEffect(() => {
    if (params.add === '1') setAllocationFormOpen(true);
    if (params.paycheckId) { setPaycheck(params.paycheckId); setAllocationFormOpen(true); }
    if (!loading && params.allocationId && initializedAllocation.current !== params.allocationId) {
      const allocation = data.allocations.find(item => item.id === params.allocationId);
      if (allocation) {
        setPaycheck(allocation.paycheckId);
        setCategory(allocation.categoryId);
        setAmount((allocation.amountCents / 100).toFixed(2));
        allocationCrud.setEditingId(allocation.id);
        setAllocationFormOpen(true);
        initializedAllocation.current = allocation.id;
      }
    }
  }, [params.paycheckId, params.allocationId, params.add, data.allocations, loading]);

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
      const ok = await allocationCrud.submit({ paycheckId, categoryId, amountCents: parseMoney(amount) });
      if (ok) clearAllocation();
    } catch (e) { reportError(e instanceof Error ? e.message : 'Invalid allocation.'); }
  };

  return <Page title="Budget"><Feedback />
    <Text>Categories and allocations are tracked separately for each paycheck.</Text>
    <Text style={{ fontWeight: '600', fontSize: 17 }}>Upcoming subscriptions</Text>
    <Text>Budget for these scheduled charges before they are due.</Text>
    {!upcomingSubscriptions.length ? <Text>No upcoming subscription charges before your next payday.</Text> : upcomingSubscriptions.map(({ item, dueDate }) => {
      const planned = !!planPaycheck && data.allocations.some(allocation => allocation.subscriptionId === item.id && allocation.paycheckId === planPaycheck.id);
      return <React.Fragment key={item.id}><RecordLine title={item.description} detail={`${formatMoney(item.amountCents)} · Due ${formatDateDisplay(dueDate)}${item.categoryId ? ` · ${data.categories.find(category => category.id === item.categoryId)?.name ?? 'Category'}` : ''}${item.accountId ? ` · ${data.accounts.find(account => account.id === item.accountId)?.name ?? 'Account'}` : ''}`} onEdit={() => router.push({ pathname: '/transactions', params: { editId: item.id } })} onDelete={() => router.push({ pathname: '/transactions', params: { editId: item.id } })} />{planned ? <Text>Included in paycheck plan · {formatDateDisplay(planPaycheck!.receivedAt)}</Text> : <Action label="Add to paycheck plan" onPress={() => void planSubscription(item.id)} />}</React.Fragment>;
    })}
    {!categoryFormOpen ? <Action label="+ Add category" variant="primary" fullWidth onPress={() => setCategoryFormOpen(true)} /> : <>
      <Field label={categoryCrud.editingId ? 'Category name' : 'New category name'} value={name} onChangeText={setName} />
      <Action label="Save category" variant="primary" fullWidth onPress={() => void categorySave()} />
      <Action label="Cancel" onPress={clearCategory} />
    </>}
    {!data.categories.length ? <Text>No categories yet.</Text> : null}
    {data.categories.map(category => <RecordLine key={category.id} title={category.name} detail="Budget category" onEdit={() => { setName(category.name); categoryCrud.setEditingId(category.id); setCategoryFormOpen(true); }} onDelete={() => categoryCrud.confirmDelete(category.id)} />)}

    {!allocationFormOpen ? <Action label="+ Allocate paycheck" variant="primary" fullWidth onPress={() => setAllocationFormOpen(true)} /> : <>
      <SelectId label="Paycheck" choices={data.paychecks.map(item => ({ id: item.id, title: `${item.status === 'planned' ? 'Planned · ' : ''}${formatDateDisplay(item.receivedAt)} · ${formatMoney(item.amountCents)}`}))} value={paycheckId} onChange={setPaycheck} />
      <SelectId label="Category" choices={data.categories.map(item => ({ id: item.id, title: item.name }))} value={categoryId} onChange={setCategory} create="category" />
      <Field label="Allocated amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
      <Action label="Save allocation" variant="primary" fullWidth onPress={() => void allocationSave()} />
      <Action label="Cancel" onPress={clearAllocation} />
    </>}

    <Text style={{ fontWeight: '600', fontSize: 17 }}>Active paycheck budgets</Text>
    {!data.paychecks.some(paycheck => !paycheck.budgetArchived && data.allocations.some(item => item.paycheckId === paycheck.id)) ? <Text>No active paycheck budgets. Add allocations to start budgeting.</Text> : null}
    {data.paychecks.filter(paycheck => !paycheck.budgetArchived && data.allocations.some(item => item.paycheckId === paycheck.id)).map(paycheck => <React.Fragment key={paycheck.id}>
      <Text>{paycheck.status === 'planned' ? 'Planned · unavailable to spend · ' : ''}{formatDateDisplay(paycheck.receivedAt)}: {formatMoney(allocatedForPaycheck(data, paycheck.id))} allocated · {formatMoney(unallocatedForPaycheck(data, paycheck.id))} unallocated</Text>
      <Action label="Archive this paycheck budget" onPress={() => { void saveRecord('paychecks', { ...paycheck, budgetArchived: true }); }} />
      {data.allocations.filter(item => item.paycheckId === paycheck.id).map(allocation => <AllocationLine key={allocation.id} allocation={allocation} data={data} router={router} onEdit={() => { setPaycheck(allocation.paycheckId); setCategory(allocation.categoryId); setAmount((allocation.amountCents / 100).toFixed(2)); allocationCrud.setEditingId(allocation.id); setAllocationFormOpen(true); }} onDelete={() => allocationCrud.confirmDelete(allocation.id)} />)}
    </React.Fragment>)}

    <Text style={{ fontWeight: '600', fontSize: 17 }}>Archived paycheck budgets</Text>
    {!data.paychecks.some(paycheck => paycheck.budgetArchived && data.allocations.some(item => item.paycheckId === paycheck.id)) ? <Text>No archived paycheck budgets.</Text> : null}
    {data.paychecks.filter(paycheck => paycheck.budgetArchived && data.allocations.some(item => item.paycheckId === paycheck.id)).map(paycheck => <React.Fragment key={paycheck.id}>
      <Text>{paycheck.status === 'planned' ? 'Planned · unavailable to spend · ' : ''}{formatDateDisplay(paycheck.receivedAt)}: {formatMoney(allocatedForPaycheck(data, paycheck.id))} allocated · {formatMoney(unallocatedForPaycheck(data, paycheck.id))} unallocated</Text>
      <Action label="Restore paycheck budget" onPress={() => { void saveRecord('paychecks', { ...paycheck, budgetArchived: false }); }} />
      {data.allocations.filter(item => item.paycheckId === paycheck.id).map(allocation => <AllocationLine key={allocation.id} allocation={allocation} data={data} router={router} onEdit={() => { setPaycheck(allocation.paycheckId); setCategory(allocation.categoryId); setAmount((allocation.amountCents / 100).toFixed(2)); allocationCrud.setEditingId(allocation.id); setAllocationFormOpen(true); }} onDelete={() => allocationCrud.confirmDelete(allocation.id)} />)}
    </React.Fragment>)}
  </Page>;
}

function AllocationLine({ allocation, data, router, onEdit, onDelete }: { allocation: (typeof data.allocations)[number]; data: ReturnType<typeof useData>['data']; router: ReturnType<typeof useRouter>; onEdit: () => void; onDelete: () => void }) {
  const summary = allocationSummary(data, allocation);
  const category = data.categories.find(item => item.id === allocation.categoryId);
  return <RecordLine title={category?.name ?? 'Unknown category'} detail={`${formatMoney(summary.allocatedCents)} allocated · ${formatMoney(summary.spentCents)} spent · ${formatMoney(summary.remainingCents)} left`} onView={() => router.push({ pathname: '/allocation/[id]', params: { id: allocation.id } })} onEdit={onEdit} onDelete={onDelete} />;
}
