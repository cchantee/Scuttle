import React from 'react';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from 'react-native';
import { allocationSummary } from '../../src/domain/calculations';
import { formatMoney } from '../../src/domain/money';
import { Action, Feedback, Page, RecordLine } from '../../src/components/ui';
import { useCrud } from '../../src/components/hooks';
import { useData } from '../../src/state/DataProvider';
import { formatDateDisplay } from '../../src/domain/date';

export default function AllocationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data } = useData();
  const transactionCrud = useCrud('transactions');
  const allocation = data.allocations.find(item => item.id === id);
  if (!allocation) return <Page title="Budget category"><Text>Allocation not found.</Text><Link href="/budget">Back to budget</Link></Page>;
  const category = data.categories.find(item => item.id === allocation.categoryId);
  const paycheck = data.paychecks.find(item => item.id === allocation.paycheckId);
  const summary = allocationSummary(data, allocation);
  const expenses = data.transactions.filter(item => item.allocationId === allocation.id).sort((a, b) => b.date.localeCompare(a.date));
  return <Page title={category?.name ?? 'Budget category'}><Feedback />
    <Text>Paycheck {paycheck ? formatDateDisplay(paycheck.receivedAt) : 'not found'}</Text>
    <Text>{formatMoney(summary.remainingCents)} remaining</Text>
    <Text>{formatMoney(summary.allocatedCents)} allocated · {formatMoney(summary.spentCents)} spent</Text>
    {paycheck?.status === 'planned' ? <Text>Planned allocation · funds are not available to spend.</Text> : paycheck?.budgetArchived ? <Text>This paycheck budget is archived. New categorized expenses will use an active paycheck budget.</Text> : <Action label="+ Add transaction" variant="primary" fullWidth onPress={() => router.push({ pathname: '/transaction/new', params: { allocationId: allocation.id } })} />}
    <Text style={{ fontWeight: '600' }}>Transactions</Text>
    {!expenses.length ? <Text>No expenses recorded for this allocation.</Text> : null}
    {expenses.map(tx => <RecordLine key={tx.id} title={tx.description} detail={`${formatDateDisplay(tx.date)} · ${formatMoney(tx.amountCents)}`} onEdit={() => router.push({ pathname: '/transactions', params: { editId: tx.id } })} onDelete={() => transactionCrud.confirmDelete(tx.id)} />)}
    <Action label="Edit allocation" onPress={() => router.push({ pathname: '/budget', params: { allocationId: allocation.id } })} />
  </Page>;
}
