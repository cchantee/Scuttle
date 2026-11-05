import { Icon, IconTile, categoryIcon } from '../src/components/icons';
import { EmptyState, CoastalBalance } from '../src/components/coastal';
import { Text } from '../src/components/typography';
import React, { useEffect, useMemo, useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { activeBudgetAllocations, allocatedForPaycheck, allocationSummary, cashAccountSummary, savingsGoalSummary, nextSubscriptionDue, goalSummary, unallocatedForPaycheck } from '../src/domain/calculations';
import { formatMoney } from '../src/domain/money';
import { Action, Card, DateField, Field, Feedback, Page, ProgressBar, SectionTitle } from '../src/components/ui';
import { useData } from '../src/state/DataProvider';
import { PaydayFrequency } from '../src/domain/models';
import { calculateNextPayday, formatDateDisplay, formatDateInput, normalizeDateInput, todayISODate, todayDateInput } from '../src/domain/date';
import { TourHighlight, walkthroughSteps, useWalkthrough } from '../src/components/walkthrough';

const ink = '#344447';
const muted = '#69777A';
export default function Dashboard() {
  const { data, loading, error, authConfigured, authLoading, authUser, saveNextPayday, planSubscription, reportError } = useData();
  const walkthrough = useWalkthrough();
  const router = useRouter();
  const params = useLocalSearchParams<{ walkthrough?: string }>();
  const [search, setSearch] = useState('');
  const [quickView, setQuickView] = useState<'paycheck' | 'accounts' | 'savings'>('paycheck');
  const [editingPayday, setEditingPayday] = useState(false);
  const [paydaySaved, setPaydaySaved] = useState(false);
  const [paydayInput, setPaydayInput] = useState(data.user.nextPayday ? formatDateInput(data.user.nextPayday) : '');
  const [paydayFrequency, setPaydayFrequency] = useState<PaydayFrequency>(data.user.paydayFrequency ?? 'weekly');
  const [paydayIntervalInput, setPaydayIntervalInput] = useState(data.user.paydayIntervalDays?.toString() ?? '');
  const recent = [...data.paychecks].filter(p => p.status !== 'planned' && !p.budgetArchived).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0];
  useEffect(() => {
    if (walkthrough?.active || walkthrough?.dismissed) return;
    if (params.walkthrough === '1') {
      walkthrough?.start();
      return;
    }
    if (authUser?.walkthroughNeeded) walkthrough?.start();
  }, [params.walkthrough, authUser?.walkthroughNeeded, walkthrough?.active, walkthrough?.dismissed]);
  useEffect(() => {
    if (walkthrough?.active && ['home-quick-views', 'home-next-payday'].includes(walkthroughSteps[walkthrough.index]?.target)) setQuickView('paycheck');
  }, [walkthrough?.active, walkthrough?.index]);
  const query = search.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!query) return [];
    const results: { label: string; detail: string; open: () => void }[] = [];
    data.transactions.filter(item => `${item.description} ${item.type} ${item.date}`.toLowerCase().includes(query)).forEach(item => results.push({ label: item.description, detail: `${formatDateDisplay(item.date)} · ${formatMoney(item.amountCents)} · Transaction`, open: () => router.push({ pathname: '/transactions', params: { editId: item.id } }) }));
    data.accounts.filter(item => item.name.toLowerCase().includes(query)).forEach(item => results.push({ label: item.name, detail: `${item.type} · Account`, open: () => router.push({ pathname: '/account/[id]', params: { id: item.id } }) }));
    data.goals.filter(item => item.name.toLowerCase().includes(query)).forEach(item => results.push({ label: item.name, detail: 'Savings goal', open: () => router.push({ pathname: '/goal/[id]', params: { id: item.id } }) }));
    data.categories.filter(item => item.name.toLowerCase().includes(query)).forEach(item => results.push({ label: item.name, detail: 'Budget category', open: () => router.push('/budget') }));
    return results.slice(0, 8);
  }, [data, query, router]);
  const paycheckGroups = useMemo(() => {
    if (!query) return [];
    const queryMatchesSource = new Set(data.paychecks.filter(item => (item.source ?? '').trim().toLowerCase().includes(query)).map(item => (item.source ?? '').trim().toLowerCase()));
    const matches = data.paychecks.filter(item => queryMatchesSource.has((item.source ?? '').trim().toLowerCase()) || item.receivedAt.includes(query));
    const groups = new Map<string, typeof matches>();
    matches.forEach(item => {
      const key = item.source?.trim().toLowerCase() || 'other paychecks';
      groups.set(key, [...(groups.get(key) ?? []), item]);
    });
    return [...groups.entries()].map(([, paychecks]) => ({ name: paychecks[0].source?.trim() || 'Other paychecks', paychecks }));
  }, [data.paychecks, query]);

  if (authConfigured && authLoading) return <Page title="Scuttle" showTabs={false}><Text>Loading…</Text></Page>;
  if (authConfigured && !authUser) return <Redirect href="/welcome" />;
  if (loading) return <Page title="Scuttle" showTabs={false}><Text>Loading your records…</Text></Page>;
  const cash = cashAccountSummary(data);
  const savings = savingsGoalSummary(data);
  const allocated = recent ? allocatedForPaycheck(data, recent.id) : 0;
  const unallocated = recent ? unallocatedForPaycheck(data, recent.id) : 0;
  const allocations = [...activeBudgetAllocations(data)].sort((a, b) => { const priority = (id: string) => /grocer|gas|food|fun|discretion|personal/i.test(data.categories.find(c => c.id === id)?.name ?? '') ? 0 : 1; return priority(a.categoryId) - priority(b.categoryId); });
  const planPaycheck = [...data.paychecks].filter(item => !item.budgetArchived).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0];
  const rawName = authUser?.displayName || (authConfigured ? '' : data.user.displayName);
  const firstName = rawName.trim().split(/\s+/)[0];
  const greetingName = firstName && firstName.toLowerCase() !== 'local' ? firstName : 'User';
  const nextPayday = data.user.nextPayday;
  const upcomingPayday = nextPayday && data.user.paydayFrequency
    ? calculateNextPayday(nextPayday, todayISODate(), data.user.paydayFrequency, data.user.paydayIntervalDays)
    : nextPayday;
  const daysUntilPayday = upcomingPayday ? Math.round((Date.parse(`${upcomingPayday}T00:00:00Z`) - Date.parse(`${todayISODate()}T00:00:00Z`)) / 86400000) : null;
  const countdown = daysUntilPayday === null ? '' : daysUntilPayday < 0 ? `${Math.abs(daysUntilPayday)} days ago` : daysUntilPayday === 0 ? 'Today' : daysUntilPayday < 7 ? `in ${daysUntilPayday} ${daysUntilPayday === 1 ? 'day' : 'days'}` : `in ${Math.floor(daysUntilPayday / 7)} ${Math.floor(daysUntilPayday / 7) === 1 ? 'week' : 'weeks'}${daysUntilPayday % 7 ? ` / ${daysUntilPayday % 7} ${daysUntilPayday % 7 === 1 ? 'day' : 'days'}` : ''}`;
  const upcomingSubscriptions = data.transactions.filter(item => item.type === 'subscription').map(item => ({ item, dueDate: nextSubscriptionDue(item, todayISODate()) })).filter((row): row is { item: typeof data.transactions[number]; dueDate: string } => !!row.dueDate && (!upcomingPayday || row.dueDate <= upcomingPayday)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const savePayday = async () => {
    const normalized = normalizeDateInput(paydayInput);
    if (!normalized) { reportError('Enter a valid date as M/D/YYYY.'); return; }
    if (paydayFrequency === 'custom' && !/^\d+$/.test(paydayIntervalInput)) { reportError('Enter how many days between paychecks.'); return; }
    const interval = paydayFrequency === 'custom' ? Number(paydayIntervalInput) : undefined;
    if (paydayFrequency === 'custom' && (!interval || interval < 1 || interval > 365)) { reportError('Choose a repeat interval from 1 to 365 days.'); return; }
    if (await saveNextPayday(normalized, paydayFrequency, interval)) { setEditingPayday(false); setPaydaySaved(true); }
  };
  const headerRight = <View style={{ flexDirection: 'row' }}><HeaderIcon label="Profile" mark="profile" onPress={() => router.push('/profile')} /><HeaderIcon label="More and settings" mark="more" onPress={() => router.push('/more')} /></View>;
  const transactions = [...data.transactions].filter(t => t.type !== 'subscription').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const planned = [...data.paychecks].filter(p => p.status === 'planned').sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))[0];
  return <Page title={`Good morning, ${greetingName}!`} headerRight={headerRight}>
    <Feedback />
    <Field label="Search Scuttle" value={search} onChangeText={setSearch} placeholder="Search transactions, accounts, goals, paychecks" />
    {query ? <View style={{ gap: 8 }}>{searchResults.map((item, index) => <Action key={index} label={`${item.label} · ${item.detail}`} onPress={item.open} />)}{paycheckGroups.flatMap(group => group.paychecks.map(p => <Action key={p.id} label={`${group.name} · ${formatMoney(p.amountCents)}`} onPress={() => router.push({ pathname: '/paycheck/[id]', params: { id: p.id } })} />))}{!searchResults.length && !paycheckGroups.length ? <Text>No matching records.</Text> : null}</View> : null}
    <TourHighlight id="home-quick-views"><View style={{ gap: 6 }}>
      <Text style={{ fontSize: 14, color: muted }}>View Focus</Text>
      <View accessibilityRole="tablist" accessibilityLabel="Dashboard view" style={{ flexDirection: 'row', gap: 4, borderWidth: 1, borderColor: '#E9E7E2', padding: 3, borderRadius: 10, backgroundColor: '#FFFFFF' }}>
        {([{ id: 'paycheck', label: 'Paycheck' }, { id: 'accounts', label: 'Accounts' }, { id: 'savings', label: 'Savings' }] as const).map(view => <Pressable key={view.id} accessibilityRole="tab" accessibilityLabel={`${view.label} view`} hitSlop={{ top: 6, bottom: 6 }} accessibilityState={{ selected: quickView === view.id }} onPress={() => setQuickView(view.id)} style={({ pressed }) => ({ flex: 1, minHeight: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: quickView === view.id ? '#DCE7DA' : pressed ? '#FAF9F6' : 'transparent' })}><Text style={{ fontSize: 14, textDecorationLine: quickView === view.id ? 'underline' : 'none' }}>{view.label}</Text></Pressable>)}
      </View>
    </View></TourHighlight>

    <View style={{ gap: 16 }}>
      {quickView === 'paycheck' ? <><CoastalBalance title="Available to Spend" amount={formatMoney(Math.max(0, unallocated))} subtitle="from this received paycheck" />{unallocated < 0 ? <Text>Your plan is {formatMoney(-unallocated)} above this paycheck. Review allocations.</Text> : null}</>
        : quickView === 'accounts' ? <><CoastalBalance title="Total Cash Balance" amount={formatMoney(cash.totalCashCents)} subtitle="checking, savings, and cash" /><Card><Text>Available Balance</Text><Text role="money" style={{ fontSize: 27 }}>{formatMoney(cash.availableCashCents)}</Text><Text style={{ fontSize: 14, color: muted }}>{formatMoney(cash.totalCashCents - cash.availableCashCents)} reserved for pending goals</Text>{cash.creditCardDebtCents > 0 ? <Text style={{ fontSize: 14, color: muted }}>Credit card debt: {formatMoney(cash.creditCardDebtCents)}</Text> : null}<Action label="View accounts" variant="text" onPress={() => router.push('/accounts')} /></Card></>
        : <><CoastalBalance title="Total Goal Savings" amount={formatMoney(savings.savedCents)} subtitle="completed goal savings" /><Card><Text>Savings Progress</Text><Text style={{ fontSize: 23 }}>{savings.progressPercent.toFixed(1)}%</Text><ProgressBar value={savings.savedCents} max={savings.targetCents} color="#869F9F" /><Text style={{ color: muted, fontSize: 14 }}>{formatMoney(savings.savedCents)} of {formatMoney(savings.targetCents)} targeted · excludes pending reservations</Text><Action label="View savings goals" variant="text" onPress={() => router.push('/goals')} /></Card></>}
    </View>
    {quickView === 'paycheck' ? <Pressable accessibilityRole="button" accessibilityLabel="View this paycheck" onPress={() => recent ? router.push({ pathname: '/paycheck/[id]', params: { id: recent.id } }) : router.push({ pathname: '/paychecks', params: { add: '1' } })}>
      <Card><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ fontSize: 19 }}>This Paycheck</Text>{countdown ? <Text style={{ fontSize: 13, color: muted }}>{countdown}</Text> : <Icon name="paycheck" />}</View>
        <Text role="money" style={{ fontSize: 26 }}>{recent ? formatMoney(recent.amountCents) : '—'}</Text>
        <ProgressBar value={allocated} max={recent?.amountCents ?? 0} />
        <Text style={{ fontSize: 13, color: muted }}>{recent ? `${recent.amountCents ? Math.round(allocated / recent.amountCents * 100) : 0}% allocated · ${formatMoney(unallocated)} left to assign` : 'Add a paycheck to begin'}</Text>
      </Card>
    </Pressable> : null}

    {quickView === 'paycheck' ? <TourHighlight id="home-next-payday"><Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: muted, fontSize: 14 }}>Next Paycheck</Text>
          {upcomingPayday ? <>
            <Text style={{ fontSize: 24, color: ink }}>{countdown}</Text>
            <Text style={{ color: muted }}>{new Date(`${upcomingPayday}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
            <Text style={{ color: muted, fontSize: 12 }}>{frequencyLabel(data.user.paydayFrequency, data.user.paydayIntervalDays)}</Text>
          </> : <Text style={{ fontSize: 17 }}>Set your next payday</Text>}
        </View>
        <Action label={editingPayday ? 'Cancel' : nextPayday ? 'Change' : 'Set date'} onPress={() => {
          setPaydayInput(nextPayday ? formatDateInput(nextPayday) : todayDateInput());
          setPaydayFrequency(data.user.paydayFrequency ?? 'weekly');
          setPaydayIntervalInput(data.user.paydayIntervalDays?.toString() ?? '');
          setPaydaySaved(false); setEditingPayday(!editingPayday);
        }} />
      </View>
      {editingPayday ? <>
        <DateField label="Upcoming paycheck date" value={paydayInput} onChangeText={setPaydayInput} />
        <Text style={{ fontSize: 14 }}>How often are you paid?</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {([{ id: 'monthly', label: 'Monthly' }, { id: 'weekly', label: 'Weekly' }, { id: 'biweekly', label: 'Biweekly' }, { id: 'custom', label: 'Other' }] as const).map(option => <Action key={option.id} label={option.label} variant={paydayFrequency === option.id ? 'primary' : 'secondary'} onPress={() => setPaydayFrequency(option.id)} />)}
        </View>
        {paydayFrequency === 'custom' ? <><Field label="Repeat every how many days?" value={paydayIntervalInput} onChangeText={setPaydayIntervalInput} keyboardType="numeric" placeholder="e.g. 10" /><Text style={{ color: muted, fontSize: 12 }}>Repeat every 1–365 days.</Text></> : null}
        <Action label="Save payday" variant="primary" fullWidth onPress={() => void savePayday()} />
      </> : null}
      {paydaySaved ? <Text accessibilityLiveRegion="polite" style={{ fontSize: 14 }}>Payday schedule saved.</Text> : null}
      <Action label="View paycheck" fullWidth onPress={() => recent ? router.push({ pathname: '/paycheck/[id]', params: { id: recent.id } }) : router.push('/paychecks')} />
    </Card></TourHighlight> : null}

    <TourHighlight id="home-active-budgets"><SectionTitle right={<Action label="View all" variant="text" onPress={() => router.push('/budget')} />}>Active Budgets</SectionTitle>
      <View style={{ gap: 10, marginTop: 8 }}>{allocations.length ? allocations.slice(0, 3).map(allocation => {
        const summary = allocationSummary(data, allocation);
        return <PressableBudget key={allocation.id} title={data.categories.find(c => c.id === allocation.categoryId)?.name ?? 'Category'} spent={summary.spentCents} allocated={summary.allocatedCents} remaining={summary.remainingCents} onPress={() => router.push({ pathname: '/allocation/[id]', params: { id: allocation.id } })} />;
      }) : <Text style={{ color: muted }}>Your budget categories will appear here.</Text>}</View>
    </TourHighlight>

    <SectionTitle right={<Action label="View all" variant="text" onPress={() => router.push('/transactions')} />}>Upcoming Bills</SectionTitle>
    <Card>{upcomingSubscriptions.length ? upcomingSubscriptions.slice(0, 3).map(({ item, dueDate }) => {
      const included = !!planPaycheck && data.allocations.some(a => a.paycheckId === planPaycheck.id && a.subscriptionId === item.id);
      return <Pressable accessibilityRole="button" key={item.id} onPress={() => router.push({ pathname: '/transactions', params: { editId: item.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}><IconTile name="calendar" tint="#EFD3C1" /><View style={{ flex: 1, gap: 4 }}><Text>{item.description}</Text><Text style={{ fontSize: 13, color: muted }}>Due {formatDateDisplay(dueDate)} · {included ? 'Included in plan' : 'Not yet allocated'}</Text></View><Text>{formatMoney(item.amountCents)}</Text></Pressable>;
    }) : <Text style={{ color: muted }}>No scheduled bills before your next payday.</Text>}</Card>

    <SectionTitle right={<Action label="View all" variant="text" onPress={() => router.push('/goals')} />}>Savings Goals</SectionTitle>
    {data.goals.length ? data.goals.slice(0, 2).map(goal => {
      const summary = goalSummary(data, goal);
      return <Pressable key={goal.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/goal/[id]', params: { id: goal.id } })}><Card><View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><IconTile name="goals" /><View style={{ flex: 1, gap: 5 }}><Text>{goal.name}</Text><Text style={{ color: muted, fontSize: 14 }}>{formatMoney(summary.savedCents)} of {formatMoney(goal.targetCents)} · {Math.round(summary.progressPercent)}%</Text></View></View><ProgressBar value={summary.savedCents} max={goal.targetCents} color="#869F9F" /></Card></Pressable>;
    }) : <EmptyState message="Make room for what matters." />}

    <SectionTitle right={<Action label="View all" variant="text" onPress={() => router.push('/history')} />}>Recent Transactions</SectionTitle>
    <Card>{transactions.length ? transactions.map(tx => <Pressable accessibilityRole="button" key={tx.id} onPress={() => router.push({ pathname: '/transactions', params: { editId: tx.id } })} style={{ flexDirection: 'row', gap: 10, paddingVertical: 8, alignItems: 'center' }}><IconTile name="transaction" tint="#E4B793" /><View style={{ flex: 1 }}><Text>{tx.description}</Text><Text style={{ color: muted, fontSize: 13 }}>{formatDateDisplay(tx.date)} · {tx.type}</Text></View><Text>{tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : ''}{formatMoney(tx.amountCents)}</Text></Pressable>) : <Text style={{ color: muted }}>Your recent activity will appear here.</Text>}</Card>

    {planned ? <Card><Text style={{ fontSize: 19 }}>Paycheck Preview</Text><Text>Expected {formatDateDisplay(planned.receivedAt)}</Text><Text role="money" style={{ fontSize: 28 }}>{formatMoney(planned.amountCents)}</Text><Action label="Plan this paycheck" onPress={() => router.push({ pathname: '/paycheck/[id]', params: { id: planned.id } })} /></Card> : null}
    <View style={{ alignSelf: 'center', paddingTop: 8 }}><Action label="Plan a paycheck" onPress={() => router.push({ pathname: '/paychecks', params: { add: '1' } })} /></View>

    <TourHighlight id="home-quick-actions"><View accessibilityLabel="Quick navigation" style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 6, paddingVertical: 6 }}>
      {([{ label: 'Budget', href: '/budget' }, { label: 'Transactions', href: '/transactions' }, { label: 'History', href: '/history' }] as const).map(item => <Pressable key={item.href} accessibilityRole="button" accessibilityLabel={`Open ${item.label}`} hitSlop={{ top: 6, bottom: 6 }} onPress={() => router.push(item.href)} style={({ pressed }) => ({ minHeight: 32, paddingHorizontal: 11, justifyContent: 'center', borderWidth: 1, borderColor: '#E9E7E2', borderRadius: 8, backgroundColor: pressed ? '#DCE7DA' : '#FFFFFF' })}><Text numberOfLines={1} style={{ fontSize: 14 }}>{item.label}</Text></Pressable>)}
    </View></TourHighlight>
  </Page>;
}

function HeaderIcon({ label, mark, onPress }: { label: string; mark: 'profile' | 'more'; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ height: 44, width: 44, borderWidth: 1, borderColor: '#E9E7E2', borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? '#DCE7DA' : '#fff' })}><Icon name={mark} size={21} /></Pressable>;
}

function frequencyLabel(frequency?: PaydayFrequency, intervalDays?: number) {
  if (frequency === 'monthly') return 'Repeats monthly';
  if (frequency === 'weekly') return 'Repeats weekly';
  if (frequency === 'biweekly') return 'Repeats every two weeks';
  if (frequency === 'custom' && intervalDays) return `Repeats every ${intervalDays} days`;
  return 'Repeat schedule not set';
}

function PressableBudget({ title, spent, allocated, remaining, onPress }: { title: string; spent: number; allocated: number; remaining: number; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => ({ borderWidth: 1, borderColor: '#E9E7E2', borderRadius: 12, padding: 12, gap: 8, backgroundColor: pressed ? '#DCE7DA' : '#fff' })}>
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><IconTile name={categoryIcon(title)} /><Text style={{ color: ink, flex: 1 }}>{title}</Text><Text style={{ color: muted, fontSize: 12 }}>{formatMoney(remaining)} left</Text></View>
    <ProgressBar value={spent} max={allocated} color="#D58A71" />
  </Pressable>;
}
