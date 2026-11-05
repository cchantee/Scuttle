import { View } from 'react-native';
import { Card, ProgressBar, SectionTitle } from '../../src/components/ui';
import { IconTile } from '../../src/components/icons';
import { EmptyState } from '../../src/components/coastal';
import { Text } from '../../src/components/typography';
import React from 'react';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';

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
    <Card><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><IconTile name="category" /><Text style={{ fontSize: 24 }}>{category?.name}</Text></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>{[{ label: 'Budgeted', value: summary.allocatedCents }, { label: 'Spent', value: summary.spentCents }, { label: 'Left', value: summary.remainingCents }].map(item => <View key={item.label} style={{ flex: 1, minWidth: 70, gap: 8 }}><Text style={{ color: '#69777A', fontSize: 14 }}>{item.label}</Text><Text role="money" style={{ fontSize: 23 }}>{formatMoney(item.value)}</Text></View>)}</View>
      <ProgressBar value={summary.spentCents} max={summary.allocatedCents} color="#D58A71" />
      <Text style={{ color: '#69777A', fontSize: 14 }}>Paycheck {paycheck ? formatDateDisplay(paycheck.receivedAt) : 'not found'} · {summary.allocatedCents ? Math.round(summary.spentCents / summary.allocatedCents * 100) : 0}% used</Text>
    </Card>
    {paycheck?.status === 'planned' ? <Text>This is planned money. Receive the paycheck before adding spending.</Text> : paycheck?.budgetArchived ? <Text>This paycheck budget is archived. New categorized expenses will use an active paycheck budget.</Text> : <Action label="+ Add transaction" variant="primary" fullWidth onPress={() => router.push({ pathname: '/transaction/new', params: { allocationId: allocation.id } })} />}
    <SectionTitle>Transactions</SectionTitle>
    {!expenses.length ? <EmptyState message="A little room in your budget." /> : null}
    {expenses.map(tx => <RecordLine key={tx.id} title={tx.description} detail={`${formatDateDisplay(tx.date)} · ${formatMoney(tx.amountCents)}`} onEdit={() => router.push({ pathname: '/transactions', params: { editId: tx.id } })} onDelete={() => transactionCrud.confirmDelete(tx.id)} />)}
    <Action label="Edit allocation" onPress={() => router.push({ pathname: '/budget', params: { allocationId: allocation.id } })} />
  </Page>;
}
