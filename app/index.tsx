import React from 'react';
import { Text, View } from 'react-native';
import { allocatedForPaycheck, allocationSummary, goalSummary, unallocatedForPaycheck } from '../src/domain/calculations';
import { formatMoney } from '../src/domain/money';
import { FeatureButton, Page, LocalNotice } from '../src/components/ui';
import { useData } from '../src/state/DataProvider';

const features = [
  { title: 'Paychecks', detail: 'Add and review income and unallocated amounts.', href: '/paychecks' },
  { title: 'Budget', detail: 'Manage categories and paycheck allocations.', href: '/budget' },
  { title: 'Transactions', detail: 'Record expenses, income, and transfers.', href: '/transactions' },
  { title: 'Accounts', detail: 'Review cash balances and credit card debt.', href: '/accounts' },
  { title: 'Savings goals', detail: 'Track goals and record contributions.', href: '/goals' },
  { title: 'History', detail: 'Browse and filter saved financial activity.', href: '/history' },
] as const;
export default function Dashboard() {
  const { data, loading, error } = useData();
  if (loading) return <Page title="Dashboard"><Text>Loading local records…</Text></Page>;
  const recent = [...data.paychecks].sort((a,b) => b.receivedAt.localeCompare(a.receivedAt))[0];
  return <Page title="Dashboard">
    <LocalNotice />
    {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    {recent ? <View style={{ gap: 5 }}><Text>Most recent paycheck: {formatMoney(recent.amountCents)}</Text><Text>Allocated: {formatMoney(allocatedForPaycheck(data, recent.id))}</Text><Text>Unallocated: {formatMoney(unallocatedForPaycheck(data, recent.id))}</Text>
      {data.allocations.filter(a => a.paycheckId === recent.id).map(a => { const category = data.categories.find(c => c.id === a.categoryId); const s = allocationSummary(data, a); return <Text key={a.id}>{category?.name ?? 'Unknown category'}: {formatMoney(s.spentCents)} spent / {formatMoney(s.remainingCents)} remaining</Text>; })}
    </View> : <Text>No paychecks yet. Add a paycheck to begin; totals will be calculated from saved records.</Text>}
    <Text>Savings goals</Text>{data.goals.length ? data.goals.map(g => { const s = goalSummary(data, g); return <Text key={g.id}>{g.name}: {formatMoney(s.savedCents)} / {formatMoney(g.targetCents)} ({s.progressPercent.toFixed(0)}%)</Text>; }) : <Text>No savings goals yet.</Text>}
    <Text>Recent transactions</Text>{data.transactions.length ? [...data.transactions].sort((a,b) => b.date.localeCompare(a.date)).slice(0,5).map(tx => <Text key={tx.id}>{tx.date} · {tx.description} · {formatMoney(tx.amountCents)}</Text>) : <Text>No transactions yet.</Text>}
    <Text style={{ fontSize: 18, fontWeight: '600' }}>Feature areas</Text>
    {features.map(feature => <FeatureButton key={feature.href} {...feature} />)}
  </Page>;
}
