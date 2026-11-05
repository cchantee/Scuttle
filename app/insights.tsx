import React from 'react';
import { View } from 'react-native';
import { Action, Card, Page, ProgressBar } from '../src/components/ui';
import { Text } from '../src/components/typography';
import { CompanionCard } from '../src/components/collaborative';
import { useData } from '../src/state/DataProvider';
import { activeBudgetAllocations, allocationSummary, goalSummary } from '../src/domain/calculations';
import { formatMoney } from '../src/domain/money';
import { colors } from '../src/design/theme';
import { useRouter } from 'expo-router';

export default function Insights() {
  const { data } = useData(); const router = useRouter();
  const allocations = activeBudgetAllocations(data); const over = allocations.filter(a => allocationSummary(data, a).remainingCents < 0);
  const spent = allocations.reduce((sum, a) => sum + allocationSummary(data, a).spentCents, 0); const planned = allocations.reduce((sum, a) => sum + a.amountCents, 0);
  return <Page title="Your Insights"><CompanionCard title={over.length ? 'A small adjustment could help.' : "You’re on track!"} message={over.length ? `${over.length} budget ${over.length === 1 ? 'needs' : 'items need'} a little attention.` : 'You’ve stayed with the plan you set for yourself.'} />
    <Card style={{ backgroundColor: '#F5FBF8' }}><Text style={{ fontWeight: '700' }}>This paycheck</Text><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.muted }}>Budget used</Text><Text role="money">{formatMoney(spent)} / {formatMoney(planned)}</Text></View><ProgressBar value={spent} max={planned} color={colors.teal} /></Card>
    <Text style={{ fontSize: 18, fontWeight: '700' }}>Progress worth noticing</Text>
    {data.goals.length ? data.goals.map(goal => { const summary = goalSummary(data, goal); return <Card key={goal.id}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontWeight: '700' }}>{goal.name}</Text><Text role="money">{summary.progressPercent.toFixed(0)}%</Text></View><ProgressBar value={summary.savedCents} max={goal.targetCents} color={colors.teal} /><Text style={{ color: colors.muted, fontSize: 13 }}>{formatMoney(summary.remainingCents)} left to reach your goal.</Text></Card>; }) : <Card><Text style={{ color: colors.muted }}>Add a goal to watch your progress grow here.</Text></Card>}
    <Action label="Move money around" variant="primary" fullWidth onPress={() => router.push('/move-money')} /></Page>;
}
