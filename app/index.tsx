import React, { useEffect, useMemo, useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { activeBudgetAllocations, allocatedForPaycheck, allocationSummary, cashAccountSummary, nextSubscriptionDue, savingsGoalSummary, unallocatedForPaycheck } from '../src/domain/calculations';
import { formatMoney } from '../src/domain/money';
import { Action, Card, DateField, Field, Feedback, Page, ProgressBar, SectionTitle } from '../src/components/ui';
import { useData } from '../src/state/DataProvider';
import { PaydayFrequency } from '../src/domain/models';
import { calculateNextPayday, formatDateDisplay, formatDateInput, normalizeDateInput, todayISODate, todayDateInput } from '../src/domain/date';
import { TourHighlight, useWalkthrough } from '../src/components/walkthrough';

const ink = '#171717';
const muted = '#626262';
export default function Dashboard() {
  const { data, loading, error, authConfigured, authLoading, authUser, saveNextPayday, planSubscription, reportError } = useData();
  const walkthrough = useWalkthrough();
  const router = useRouter();
  const params = useLocalSearchParams<{ walkthrough?: string }>();
  const [search, setSearch] = useState('');
  const [quickView, setQuickView] = useState<'paycheck' | 'accounts' | 'savings'>('paycheck');
  const [editingPayday, setEditingPayday] = useState(false);
  const [paydayInput, setPaydayInput] = useState(data.user.nextPayday ? formatDateInput(data.user.nextPayday) : '');
  const [paydayFrequency, setPaydayFrequency] = useState<PaydayFrequency>(data.user.paydayFrequency ?? 'weekly');
  const [paydayIntervalInput, setPaydayIntervalInput] = useState(data.user.paydayIntervalDays?.toString() ?? '');
  const recent = [...data.paychecks].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0];
  useEffect(() => {
    if (walkthrough?.active) return;
    if (params.walkthrough === '1') {
      walkthrough?.start();
      return;
    }
    if (authUser?.walkthroughNeeded) walkthrough?.start();
  }, [params.walkthrough, authUser?.walkthroughNeeded, walkthrough?.active]);
  const query = search.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!query) return [];
    const results: { label: string; detail: string; open: () => void }[] = [];
    data.transactions.filter(item => `${item.description} ${item.type} ${item.date}`.toLowerCase().includes(query)).forEach(item => results.push({ label: item.description, detail: `${formatDateDisplay(item.date)} · ${formatMoney(item.amountCents)} · Transaction`, open: () => router.push('/transactions') }));
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
  const allocated = recent ? allocatedForPaycheck(data, recent.id) : 0;
  const unallocated = recent ? unallocatedForPaycheck(data, recent.id) : 0;
  const allocations = activeBudgetAllocations(data);
  const accountSummary = cashAccountSummary(data);
  const savingsSummary = savingsGoalSummary(data);
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
    if (await saveNextPayday(normalized, paydayFrequency, interval)) setEditingPayday(false);
  };
  const headerRight = <View style={{ flexDirection: 'row', gap: 8 }}>
    <HeaderIcon label="Profile" mark="◉" onPress={() => router.push('/profile')} />
    <HeaderIcon label="Settings" mark="⚙" onPress={() => router.push('/more')} />
  </View>;

  return <Page title={`Good morning, ${greetingName}!`} headerRight={headerRight}>
    <Feedback />
    {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    <Field label="Search for anything" value={search} onChangeText={setSearch} placeholder="Search transactions, paychecks, accounts, goals" />
    {query ? <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 320, borderWidth: 1, borderColor: '#d8d8d8', borderRadius: 10, backgroundColor: '#fff' }} contentContainerStyle={{ padding: 8, gap: 5 }}>
      {searchResults.map((item, index) => <Action key={`${item.label}-${index}`} label={`${item.label} · ${item.detail}`} onPress={item.open} />)}
      {paycheckGroups.map(group => <View key={group.name} style={{ gap: 3 }}>
        <Text style={{ paddingHorizontal: 8, paddingTop: 6, color: ink, fontWeight: '700' }}>{group.name}</Text>
        {group.paychecks.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).map(paycheck => <Action key={paycheck.id} label={`${formatDateDisplay(paycheck.receivedAt)} · ${formatMoney(paycheck.amountCents)}`} onPress={() => router.push({ pathname: '/paycheck/[id]', params: { id: paycheck.id } })} />)}
      </View>)}
      {!searchResults.length && !paycheckGroups.length ? <Text style={{ padding: 8, color: muted }}>No matching records.</Text> : null}
    </ScrollView> : null}

    <TourHighlight id="home-quick-views"><SectionTitle>Quick Views</SectionTitle>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <QuickView label="Paychecks" selected={quickView === 'paycheck'} onPress={() => setQuickView('paycheck')} />
      <QuickView label="Accounts" selected={quickView === 'accounts'} onPress={() => setQuickView('accounts')} />
      <QuickView label="Savings" selected={quickView === 'savings'} onPress={() => setQuickView('savings')} />
    </View></TourHighlight>

    {quickView === 'paycheck' ? <View style={{ flexDirection: 'row', gap: 8 }}>
      <Card style={{ flex: 1, height: 72, padding: 7, gap: 2 }}>
        <Text style={{ color: muted, fontSize: 11 }}>Available to Spend</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 18, color: ink, fontWeight: '700' }}>{formatMoney(unallocated)}</Text>
        <Text style={{ color: muted, fontSize: 10 }}>from this paycheck</Text>
      </Card>
      <Pressable onPress={() => recent && router.push({ pathname: '/paycheck/[id]', params: { id: recent.id } })} style={{ flex: 1 }}>
        <Card style={{ height: 72, padding: 7, gap: 2 }}>
          <Text style={{ color: muted, fontSize: 10 }}>This Paycheck</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 16, color: ink, fontWeight: '700' }}>{recent ? formatMoney(recent.amountCents) : '—'}</Text>
          <ProgressBar value={allocated} max={recent?.amountCents ?? 0} />
          <Text style={{ color: muted, fontSize: 9 }}>{recent ? `${recent.amountCents ? Math.round(allocated / recent.amountCents * 100) : 0}% allocated` : 'Add a paycheck to begin'}</Text>
        </Card>
      </Pressable>
    </View> : quickView === 'accounts' ? <>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <QuickMetric title="Total Cash Balance" amount={formatMoney(accountSummary.totalCashCents)} detail="Checking, savings, and cash" />
        <QuickMetric title="Available Balance" amount={formatMoney(accountSummary.availableCashCents)} detail={`${formatMoney(accountSummary.totalCashCents - accountSummary.availableCashCents)} reserved`} />
      </View>
      {accountSummary.creditCardDebtCents > 0 ? <Text style={{ color: muted, fontSize: 12 }}>Credit card outstanding balance: {formatMoney(accountSummary.creditCardDebtCents)}</Text> : null}
    </> : <View style={{ flexDirection: 'row', gap: 8 }}>
      <QuickMetric title="Total Goal Savings" amount={formatMoney(savingsSummary.savedCents)} detail="Saved toward your goals" />
      <QuickMetric title="Savings Progress" amount={`${savingsSummary.progressPercent.toFixed(1)}%`} detail={`${formatMoney(savingsSummary.savedCents)} of ${formatMoney(savingsSummary.targetCents)} targeted`} />
    </View>}

    <TourHighlight id="home-next-payday"><Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: muted, fontSize: 14 }}>Next Paycheck</Text>
          {upcomingPayday ? <>
            <Text style={{ fontSize: 22, color: ink, fontWeight: '700' }}>{countdown}</Text>
            <Text style={{ color: muted }}>{new Date(`${upcomingPayday}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
            <Text style={{ color: muted, fontSize: 12 }}>{frequencyLabel(data.user.paydayFrequency, data.user.paydayIntervalDays)}</Text>
          </> : <Text style={{ fontSize: 17, color: ink }}>Set your next payday</Text>}
        </View>
        <Action label={editingPayday ? 'Cancel' : nextPayday ? 'Change' : 'Set date'} onPress={() => {
          setPaydayInput(nextPayday ? formatDateInput(nextPayday) : todayDateInput());
          setPaydayFrequency(data.user.paydayFrequency ?? 'weekly');
          setPaydayIntervalInput(data.user.paydayIntervalDays?.toString() ?? '');
          setEditingPayday(!editingPayday);
        }} />
      </View>
      {editingPayday ? <>
        <DateField label="Upcoming paycheck date" value={paydayInput} onChangeText={setPaydayInput} />
        <Text style={{ color: ink, fontSize: 13 }}>How often are you paid?</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          <Action label="Monthly" variant={paydayFrequency === 'monthly' ? 'primary' : 'secondary'} onPress={() => setPaydayFrequency('monthly')} />
          <Action label="Weekly" variant={paydayFrequency === 'weekly' ? 'primary' : 'secondary'} onPress={() => setPaydayFrequency('weekly')} />
          <Action label="Biweekly" variant={paydayFrequency === 'biweekly' ? 'primary' : 'secondary'} onPress={() => setPaydayFrequency('biweekly')} />
          <Action label="Other" variant={paydayFrequency === 'custom' ? 'primary' : 'secondary'} onPress={() => setPaydayFrequency('custom')} />
        </View>
        {paydayFrequency === 'custom' ? <>
          <Field label="Repeat every how many days?" value={paydayIntervalInput} onChangeText={setPaydayIntervalInput} keyboardType="numeric" placeholder="e.g. 10" />
          <Text style={{ color: muted, fontSize: 12 }}>Scuttle repeats your date every N days. Use 1–365 days.</Text>
        </> : null}
        <Action label="Save payday" variant="primary" fullWidth onPress={() => void savePayday()} />
      </> : null}
      <Action label="View paycheck" fullWidth onPress={() => recent ? router.push({ pathname: '/paycheck/[id]', params: { id: recent.id } }) : router.push('/paychecks')} />
    </Card></TourHighlight>

    {upcomingSubscriptions.length ? <Card>
      <Text style={{ color: ink, fontWeight: '700', fontSize: 16 }}>Upcoming subscriptions</Text>
      <Text style={{ color: muted, fontSize: 12 }}>Plan for these charges with your paycheck.</Text>
      {upcomingSubscriptions.map(({ item, dueDate }) => {
        const planned = !!planPaycheck && data.allocations.some(allocation => allocation.subscriptionId === item.id && allocation.paycheckId === planPaycheck.id);
        return <View key={item.id} style={{ paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#e5e5e5', gap: 6 }}>
          <Pressable onPress={() => router.push({ pathname: '/transactions', params: { editId: item.id } })} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flex: 1 }}><Text style={{ color: ink, fontWeight: '600' }}>{item.description}</Text><Text style={{ color: muted, fontSize: 12 }}>Due {formatDateDisplay(dueDate)}{item.categoryId ? ` · ${data.categories.find(category => category.id === item.categoryId)?.name ?? 'Category'}` : ''}</Text></View>
            <Text style={{ color: ink }}>{formatMoney(item.amountCents)}</Text>
          </Pressable>
          {planned ? <Text style={{ color: muted, fontSize: 12 }}>Included in paycheck plan · {formatDateDisplay(planPaycheck!.receivedAt)}</Text> : <Action label="Add to paycheck plan" onPress={() => void planSubscription(item.id)} />}
        </View>;
      })}
    </Card> : null}

    <SectionTitle>Quick Actions</SectionTitle>
    <TourHighlight id="home-quick-actions"><View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 9 }}>
      <QuickAction label="Add paycheck" onPress={() => router.push({ pathname: '/paychecks', params: { add: '1' } })} />
      <QuickAction label="Add expense" onPress={() => router.push('/transaction/new')} />
      <QuickAction label="Budget money" onPress={() => router.push('/budget')} />
      <QuickAction label="View balances" onPress={() => router.push('/accounts')} />
    </View></TourHighlight>

    <TourHighlight id="home-active-budgets"><SectionTitle right={<Action label="View all" variant="text" onPress={() => router.push('/budget')} />}>Active Budgets</SectionTitle>
    {allocations.length ? allocations.map(allocation => {
      const summary = allocationSummary(data, allocation);
      const category = data.categories.find(item => item.id === allocation.categoryId);
      return <PressableBudget key={allocation.id} title={category?.name ?? 'Category'} spent={summary.spentCents} allocated={summary.allocatedCents} remaining={summary.remainingCents} onPress={() => router.push({ pathname: '/allocation/[id]', params: { id: allocation.id } })} />;
    }) : <Text style={{ color: muted }}>Paycheck allocations will appear here.</Text>}</TourHighlight>
  </Page>;
}

function HeaderIcon({ label, mark, onPress }: { label: string; mark: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ height: 36, width: 36, borderWidth: 1, borderColor: '#d9d9d9', borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? '#ededed' : '#fff' })}><Text style={{ color: ink, fontSize: 18 }}>{mark}</Text></Pressable>;
}

function frequencyLabel(frequency?: PaydayFrequency, intervalDays?: number) {
  if (frequency === 'monthly') return 'Repeats monthly';
  if (frequency === 'weekly') return 'Repeats weekly';
  if (frequency === 'biweekly') return 'Repeats every two weeks';
  if (frequency === 'custom' && intervalDays) return `Repeats every ${intervalDays} days`;
  return 'Repeat schedule not set';
}

function QuickView({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => ({ flex: 1, minHeight: 42, borderWidth: 1, borderColor: selected ? ink : '#d5d5d5', borderRadius: 7, padding: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? '#e8e8e8' : pressed ? '#f1f1f1' : '#fff' })}><Text style={{ color: ink, fontSize: 14, fontWeight: selected ? '700' : '600', textAlign: 'center' }}>{label}</Text></Pressable>;
}

function QuickMetric({ title, amount, detail }: { title: string; amount: string; detail: string }) {
  return <Card style={{ flex: 1, minHeight: 72, padding: 7, gap: 2 }}>
    <Text numberOfLines={1} style={{ color: muted, fontSize: 10 }}>{title}</Text>
    <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 17, color: ink, fontWeight: '700' }}>{amount}</Text>
    <Text numberOfLines={2} style={{ color: muted, fontSize: 9 }}>{detail}</Text>
  </Card>;
}

function QuickAction({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => ({ width: '47%', minHeight: 43, borderWidth: 1, borderColor: '#d5d5d5', borderRadius: 7, padding: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? '#e9e9e9' : '#fff' })}><Text style={{ color: ink, textAlign: 'center' }}>{label}</Text></Pressable>;
}

function PressableBudget({ title, spent, allocated, remaining, onPress }: { title: string; spent: number; allocated: number; remaining: number; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => ({ borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 12, padding: 12, gap: 8, backgroundColor: pressed ? '#f0f0f0' : '#fff' })}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: ink, fontWeight: '600' }}>{title}</Text><Text style={{ color: muted, fontSize: 12 }}>{formatMoney(remaining)} left</Text></View>
    <ProgressBar value={spent} max={allocated} />
  </Pressable>;
}
