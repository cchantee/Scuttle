import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '../src/design/Text';
import { colors } from '../src/design/theme';
import { Action, Card, Feedback, Field, Page, ProgressBar, SectionTitle } from '../src/components/ui';
import { EmptyState, Hero, Metric } from '../src/components/brand';
import { PaydayCard } from '../src/components/PaydayCard';
import { TourHighlight, useWalkthrough } from '../src/components/walkthrough';
import { activeBudgetAllocations, allocationSummary, cashAccountSummary, nextSubscriptionDue, newestPaychecks, unallocatedForPaycheck } from '../src/domain/calculations';
import { formatMoney } from '../src/domain/money';
import { formatDateDisplay, todayISODate } from '../src/domain/date';
import { useData } from '../src/state/DataProvider';

export default function Home() {
  const { data, loading, authLoading, authConfigured, authUser } = useData();
  const router = useRouter();
  const params = useLocalSearchParams<{ walkthrough?: string }>();
  const tour = useWalkthrough();
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  useEffect(() => { if (params.walkthrough === '1' && !tour?.active) tour?.start(); }, [params.walkthrough]);
  if (authConfigured && authLoading) return <Page title="Home" showTabs={false} />;
  if (authConfigured && !authUser) return <Redirect href="/welcome" />;
  if (loading) return <Page title="Home" />;
  const recent = newestPaychecks(data.paychecks.filter(p => p.status !== 'planned' && !p.budgetArchived))[0];
  const planned = data.paychecks.filter(p => p.status === 'planned').sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))[0];
  const allocations = activeBudgetAllocations(data).map(a => ({ a, summary: allocationSummary(data, a) })).sort((a, b) => a.summary.remainingCents - b.summary.remainingCents);
  const remaining = allocations.reduce((sum, row) => sum + row.summary.remainingCents, 0);
  const cash = cashAccountSummary(data);
  const left = recent ? unallocatedForPaycheck(data, recent.id) : 0;
  const otherUnassigned = data.paychecks.filter(p => p.status !== 'planned' && !p.budgetArchived && p.id !== recent?.id).reduce((sum, p) => sum + Math.max(0, unallocatedForPaycheck(data, p.id)), 0);
  const query = search.trim().toLowerCase();
  const results: { key: string; label: string; open: () => void }[] = [
    ...data.paychecks.map(p => ({ key: `p-${p.id}`, label: `${p.source || 'Paycheck'} · ${formatDateDisplay(p.receivedAt)} · ${formatMoney(p.amountCents)}`, open: () => router.push({ pathname: '/paycheck/[id]', params: { id: p.id } }) })),
    ...data.accounts.map(a => ({ key: `a-${a.id}`, label: `${a.name} · Account`, open: () => router.push({ pathname: '/account/[id]', params: { id: a.id } }) })),
    ...data.goals.map(g => ({ key: `g-${g.id}`, label: `${g.name} · Savings goal`, open: () => router.push({ pathname: '/goal/[id]', params: { id: g.id } }) })),
    ...data.categories.map(c => ({ key: `c-${c.id}`, label: `${c.name} · Budget category`, open: () => router.push('/budget') })),
    ...data.transactions.map(t => ({ key: `t-${t.id}`, label: `${t.description} · ${t.type} · ${formatMoney(t.amountCents)}`, open: () => router.push({ pathname: '/transactions', params: { editId: t.id } }) })),
  ].filter(item => query && item.label.toLowerCase().includes(query)).slice(0, 8);
  const upcoming = data.transactions.filter(t => t.type === 'subscription').map(t => ({ t, due: nextSubscriptionDue(t, todayISODate()) })).filter(row => row.due).sort((a, b) => a.due!.localeCompare(b.due!)).slice(0, 3);
  return <Page title="Home" headerRight={<Action label={searchOpen ? 'Close search' : 'Search'} variant="text" onPress={() => setSearchOpen(!searchOpen)} />}><Feedback />
    {searchOpen ? <Card><Field label="Search Scuttle" value={search} onChangeText={setSearch} placeholder="Paycheck, category, account, goal, or activity" />{results.map(r => <Action key={r.key} label={r.label} variant="text" onPress={r.open} />)}{query && !results.length ? <Text>No matching records.</Text> : null}</Card> : null}
    {recent ? <Hero label={left < 0 ? 'Over budgeted by' : left === 0 ? 'Paycheck fully budgeted' : 'Left to budget'} amount={formatMoney(left === 0 ? recent.amountCents : Math.abs(left))} detail={`${recent.source || 'Latest paycheck'} · ${formatDateDisplay(recent.receivedAt)} · ${left === 0 ? '$0 left to budget' : `${formatMoney(recent.amountCents)} received`}`}><Action label={left ? 'Budget this paycheck' : 'Review paycheck plan'} fullWidth onPress={() => router.push({ pathname: '/paycheck/plan/[id]', params: { id: recent.id } })} /><Text style={{ color: colors.mutedOnDark, fontSize: 13 }}>Budgeting gives your pay a purpose. It does not move money between accounts.</Text></Hero> : planned ? <Hero label="Planned paycheck" amount={formatMoney(planned.amountCents)} detail={`${planned.source || 'Expected pay'} · ${formatDateDisplay(planned.receivedAt)}`}><Action label="Receive this paycheck" fullWidth onPress={() => router.push({ pathname: '/paycheck/plan/[id]', params: { id: planned.id, receive: '1' } })} /><Action label="Review planned budget" fullWidth onPress={() => router.push({ pathname: '/paycheck/[id]', params: { id: planned.id } })} /></Hero> : <EmptyState title="Start with your paycheck." detail="Add your pay, choose amounts for your categories, and save one clear plan."><Action label="Add a paycheck" variant="primary" fullWidth onPress={() => router.push({ pathname: '/paychecks', params: { add: '1' } })} />{data.paychecks.length ? <Action label="Review previous paychecks" onPress={() => router.push('/paychecks')} /> : null}</EmptyState>}
    <TourHighlight id="home-quick-views"><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}><Metric label="Category budget remaining" amount={formatMoney(remaining)} caution={remaining < 0} detail="Received, active budgets" /><Metric label="Actual account balances" amount={data.accounts.length ? formatMoney(cash.totalCashCents) : '—'} detail={data.accounts.length ? 'Cash and savings · excludes card debt' : 'Add accounts from More to track recorded balances'} /></View></TourHighlight>
    <TourHighlight id="home-quick-actions"><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Action label="Add paycheck" onPress={() => router.push({ pathname: '/paychecks', params: { add: '1' } })} /><Action label="Log spending" onPress={() => router.push({ pathname: '/transaction/new', params: { type: 'expense' } })} /><Action label="All paychecks" variant="text" onPress={() => router.push('/paychecks')} /></View></TourHighlight>
    {otherUnassigned > 0 ? <Card><Text>{formatMoney(otherUnassigned)} is still unassigned in other active paychecks.</Text><Action label="Review other paychecks" variant="text" onPress={() => router.push('/paychecks')} /></Card> : null}
    {recent && planned ? <Card><Text style={{ fontWeight: '700' }}>Expected pay · {formatMoney(planned.amountCents)}</Text><Text style={{ color: colors.muted }}>{planned.source || 'Planned paycheck'} · {formatDateDisplay(planned.receivedAt)} · not received</Text><Action label="Review or receive planned pay" variant="text" onPress={() => router.push({ pathname: '/paycheck/[id]', params: { id: planned.id } })} /></Card> : null}
    <TourHighlight id="home-active-budgets"><SectionTitle right={<Action label="All budgets" variant="text" onPress={() => router.push('/budget')} />}>Spending check-in</SectionTitle>
    {allocations.slice(0, 3).map(({ a, summary }) => <Card key={a.id}><Text style={{ fontWeight: '700' }}>{data.categories.find(c => c.id === a.categoryId)?.name || 'Category'}</Text><Text style={{ color: colors.muted, fontSize: 13 }}>{data.paychecks.find(p => p.id === a.paycheckId)?.source || 'Paycheck'} · {formatDateDisplay(data.paychecks.find(p => p.id === a.paycheckId)?.receivedAt || '')}</Text><Text style={{ color: summary.remainingCents < 0 ? colors.danger : colors.text, fontWeight: '800', fontSize: 22, lineHeight: 29 }}>{formatMoney(Math.abs(summary.remainingCents))} {summary.remainingCents < 0 ? 'over budget' : 'remaining'}</Text><ProgressBar value={summary.spentCents} max={a.amountCents} /><Action label={`Open ${data.categories.find(c => c.id === a.categoryId)?.name || 'category'} · ${data.paychecks.find(p => p.id === a.paycheckId)?.source || 'paycheck'}`} variant="text" onPress={() => router.push({ pathname: '/allocation/[id]', params: { id: a.id } })} /></Card>)}
    {!allocations.length ? <Text style={{ color: colors.muted }}>Your category balances will appear here after you budget received pay.</Text> : null}</TourHighlight>
    <PaydayCard />
    {upcoming.length ? <Card><SectionTitle>Upcoming bills</SectionTitle>{upcoming.map(({ t, due }) => <View key={t.id}><Text>{t.description} · {formatMoney(t.amountCents)}</Text><Text style={{ color: colors.muted, fontSize: 13 }}>Due {formatDateDisplay(due!)}</Text><Action label={`Review ${t.description}`} variant="text" onPress={() => router.push({ pathname: '/transactions', params: { editId: t.id } })} /></View>)}</Card> : null}
  </Page>;
}
