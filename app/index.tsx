import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Action, Card, Feedback, Page, ProgressBar, SectionTitle } from '../src/components/ui';
import { Text } from '../src/components/typography';
import { CompanionCard, HarborHero } from '../src/components/collaborative';
import { IconTile, categoryIcon } from '../src/components/icons';
import { allocationSummary, cashAccountSummary, goalSummary, nextSubscriptionDue, unallocatedForPaycheck } from '../src/domain/calculations';
import { formatMoney } from '../src/domain/money';
import { formatDateDisplay, todayISODate } from '../src/domain/date';
import { useData } from '../src/state/DataProvider';
import { colors } from '../src/design/theme';

export default function Dashboard() {
  const { data, loading, authConfigured, authLoading, authUser } = useData();
  const router = useRouter();
  if (authConfigured && authLoading) return <Page title="Scuttle" showTabs={false}><Text>Loading…</Text></Page>;
  if (authConfigured && !authUser) return <Redirect href="/welcome" />;
  if (loading) return <Page title="Scuttle" showTabs={false}><Text>Loading your harbor…</Text></Page>;
  const latest = [...data.paychecks].filter(p => !p.budgetArchived && p.status !== 'planned').sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0];
  const planned = [...data.paychecks].filter(p => p.status === 'planned').sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))[0];
  const cash = cashAccountSummary(data);
  const active = data.allocations.filter(a => { const p = data.paychecks.find(item => item.id === a.paycheckId); return p && !p.budgetArchived && p.status !== 'planned'; });
  const openCommitments = active.reduce((sum, item) => sum + Math.max(0, allocationSummary(data, item).remainingCents), 0);
  const safe = Math.max(0, cash.availableCashCents - openCommitments);
  const firstName = (authUser?.displayName || data.user.displayName || 'there').trim().split(/\s+/)[0];
  const radar = useMemo(() => data.transactions.filter(t => t.type === 'subscription').map(t => ({ t, due: nextSubscriptionDue(t, todayISODate()) })).filter((row): row is { t: typeof data.transactions[number]; due: string } => Boolean(row.due)).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 2), [data.transactions]);
  const budgetRows = active.sort((a, b) => allocationSummary(data, a).remainingCents - allocationSummary(data, b).remainingCents).slice(0, 3);
  return <Page title={`Good morning, ${firstName} 👋`} headerRight={<Pressable accessibilityRole="button" onPress={() => router.push('/more')} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Text style={{ fontSize: 22 }}>☰</Text></Pressable>}>
    <Feedback />
    <HarborHero safeToSpend={formatMoney(safe)} detail={`${formatMoney(cash.totalCashCents)} in accounts · ${formatMoney(openCommitments)} already spoken for`} action={{ label: latest ? 'Plan this paycheck' : 'Add a paycheck', onPress: () => router.push(latest ? { pathname: '/paycheck/[id]', params: { id: latest.id } } : { pathname: '/paychecks', params: { add: '1' } }) }} />
    <View style={{ flexDirection: 'row', gap: 8 }}><Metric label="In Accounts" value={formatMoney(cash.totalCashCents)} /><Metric label="Committed" value={formatMoney(openCommitments)} /></View>
    <CompanionCard title="Your next best step" message={latest ? `${formatMoney(unallocatedForPaycheck(data, latest.id))} is still waiting for a job. Start with the essentials, then decide what is next.` : 'Add your next paycheck when you are ready, and we’ll make a simple plan together.'} action={{ label: 'See planning tips', onPress: () => router.push('/insights') }} />
    <SectionTitle>On Your Radar</SectionTitle>
    <Card style={{ padding: 0, gap: 0 }}>{radar.length ? radar.map(({ t, due }, index) => <Pressable key={t.id} accessibilityRole="button" onPress={() => router.push('/budget')} style={{ minHeight: 66, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: index === radar.length - 1 ? 0 : 1, borderColor: colors.border }}><IconTile name="calendar" tint={colors.shell} /><View style={{ flex: 1 }}><Text style={{ fontWeight: '700' }}>{t.description}</Text><Text style={{ fontSize: 12, color: colors.muted }}>Due {formatDateDisplay(due)} · {data.allocations.some(a => a.subscriptionId === t.id) ? 'planned' : 'needs a plan'}</Text></View><Text role="money">{formatMoney(t.amountCents)}</Text></Pressable>) : <Text style={{ padding: 14, color: colors.muted }}>Nothing urgent is coming up. Nice breathing room.</Text>}</Card>
    <SectionTitle right={<Action label="View budget" variant="text" onPress={() => router.push('/budget')} />}>This Paycheck</SectionTitle>
    {latest ? <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/paycheck/[id]', params: { id: latest.id } })}><Card><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><View><Text style={{ fontWeight: '700' }}>{latest.source || 'Latest paycheck'}</Text><Text style={{ color: colors.muted, fontSize: 13 }}>{formatDateDisplay(latest.receivedAt)}</Text></View><Text role="money" style={{ fontSize: 22 }}>{formatMoney(latest.amountCents)}</Text></View><ProgressBar value={latest.amountCents - unallocatedForPaycheck(data, latest.id)} max={latest.amountCents} color={colors.teal} /><Text style={{ color: colors.muted, fontSize: 13 }}>{formatMoney(unallocatedForPaycheck(data, latest.id))} still yours to assign</Text></Card></Pressable> : <Action label="Plan a paycheck" variant="primary" fullWidth onPress={() => router.push({ pathname: '/paychecks', params: { add: '1' } })} />}
    {planned ? <Card style={{ backgroundColor: '#F5FBF8' }}><Text style={{ fontWeight: '700' }}>Next up · {formatDateDisplay(planned.receivedAt)}</Text><Text style={{ color: colors.muted }}>{formatMoney(planned.amountCents)} planned, not in account balances yet.</Text><Action label="Review planned paycheck" onPress={() => router.push({ pathname: '/paycheck/[id]', params: { id: planned.id } })} /></Card> : null}
    <SectionTitle right={<Action label="All goals" variant="text" onPress={() => router.push('/goals')} />}>Making Progress</SectionTitle>
    {data.goals.length ? data.goals.slice(0, 2).map(goal => { const summary = goalSummary(data, goal); return <Pressable key={goal.id} onPress={() => router.push({ pathname: '/goal/[id]', params: { id: goal.id } })}><Card style={{ gap: 7 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontWeight: '700' }}>{goal.name}</Text><Text role="money">{summary.progressPercent.toFixed(0)}%</Text></View><ProgressBar value={summary.savedCents} max={goal.targetCents} color={colors.teal} /><Text style={{ color: colors.muted, fontSize: 12 }}>{formatMoney(summary.savedCents)} of {formatMoney(goal.targetCents)}</Text></Card></Pressable>; }) : <Action label="Create a savings goal" onPress={() => router.push('/goal/new')} />}
    <SectionTitle right={<Action label="All categories" variant="text" onPress={() => router.push('/budget')} />}>Budget Check-in</SectionTitle>
    {budgetRows.length ? budgetRows.map(row => { const summary = allocationSummary(data, row); const name = data.categories.find(c => c.id === row.categoryId)?.name ?? 'Category'; return <Pressable key={row.id} onPress={() => router.push({ pathname: '/allocation/[id]', params: { id: row.id } })}><Card style={{ padding: 11, gap: 5 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><IconTile name={categoryIcon(name)} tint={colors.mist} /><Text style={{ flex: 1, fontWeight: '700' }}>{name}</Text><Text role="money">{formatMoney(summary.remainingCents)}</Text></View><ProgressBar value={summary.spentCents} max={row.amountCents} color={summary.remainingCents <= 0 ? colors.coral : colors.teal} /></Card></Pressable>; }) : <Text style={{ color: colors.muted }}>Your planned categories will show up here.</Text>}
    <Action label="See your insights" variant="primary" fullWidth onPress={() => router.push('/insights')} />
  </Page>;
}
function Metric({ label, value }: { label: string; value: string }) { return <View style={{ flex: 1, borderRadius: 12, padding: 12, backgroundColor: '#FFF9F0', borderWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text><Text role="money" style={{ fontSize: 18 }}>{value}</Text></View>; }
