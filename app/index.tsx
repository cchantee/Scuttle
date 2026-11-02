import { EmptyState, Eyebrow, Hero, Metric } from '../src/components/brand';
import { colors } from '../src/design/theme';
import React, { useEffect, useMemo, useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '../src/design/Text';
import { activeBudgetAllocations, allocatedForPaycheck, allocationSummary, cashAccountSummary, nextSubscriptionDue, savingsGoalSummary, unallocatedForPaycheck } from '../src/domain/calculations';
import { formatMoney } from '../src/domain/money';
import { Action, Card, DateField, Field, Feedback, Page, ProgressBar, SectionTitle } from '../src/components/ui';
import { useData } from '../src/state/DataProvider';
import { PaydayFrequency } from '../src/domain/models';
import { calculateNextPayday, formatDateDisplay, formatDateInput, normalizeDateInput, todayISODate, todayDateInput } from '../src/domain/date';
import { TourHighlight, useWalkthrough } from '../src/components/walkthrough';

const ink = colors.text;
const muted = colors.muted;
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
  const recent = data.paychecks.filter(p => p.status !== 'planned').sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0];
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
  const greetingName = firstName && firstName.toLowerCase() !== 'local' ? firstName : '';
  const categoryRemaining = allocations.reduce((sum, allocation) => sum + allocationSummary(data, allocation).remainingCents, 0);
  const categorySpent = allocations.reduce((sum, allocation) => sum + allocationSummary(data, allocation).spentCents, 0);
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

  return <Page title={greetingName ? `Hey, ${greetingName}.` : 'Your money, at a glance.'} headerRight={headerRight}>
    <Feedback />
    {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    <Field label="Search for anything" value={search} onChangeText={setSearch} placeholder="Search transactions, paychecks, accounts, goals" />
    {query ? <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 320, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface }} contentContainerStyle={{ padding: 8, gap: 5 }}>
      {searchResults.map((item, index) => <Action key={`${item.label}-${index}`} label={`${item.label} · ${item.detail}`} onPress={item.open} />)}
      {paycheckGroups.map(group => <View key={group.name} style={{ gap: 3 }}>
        <Text style={{ paddingHorizontal: 8, paddingTop: 6, color: ink, fontWeight: '700' }}>{group.name}</Text>
        {group.paychecks.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).map(paycheck => <Action key={paycheck.id} label={`${formatDateDisplay(paycheck.receivedAt)} · ${formatMoney(paycheck.amountCents)}`} onPress={() => router.push({ pathname: '/paycheck/[id]', params: { id: paycheck.id } })} />)}
      </View>)}
      {!searchResults.length && !paycheckGroups.length ? <Text style={{ padding: 8, color: muted }}>No matching records.</Text> : null}
    </ScrollView> : null}

    <Eyebrow>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</Eyebrow>
    {recent ? <>
      <Hero label={unallocated < 0 ? 'Over assigned' : 'Left to assign'} amount={formatMoney(Math.abs(unallocated))} detail={`${recent.source || 'Paycheck'} · ${formatDateDisplay(recent.receivedAt)} · ${formatMoney(recent.amountCents)} received`}>
        <Text style={{ color: colors.mutedOnDark }}>Unassigned paycheck money is separate from your bank balance.</Text>
        <Action label="Open paycheck plan →" fullWidth onPress={() => router.push({ pathname: '/paycheck/[id]', params: { id: recent.id } })} />
      </Hero>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}><Metric label="Assigned from this pay" amount={formatMoney(allocated)} /><Metric label="Category budget remaining" amount={formatMoney(categoryRemaining)} caution={categoryRemaining < 0} detail={`${formatMoney(categorySpent)} spent across active budgets`} /></View>
    </> : <EmptyState title="Start with your next paycheck." detail="A regular payday or a little extra work—give that money a plan before you spend it."><Action label="Add your first paycheck" variant="primary" fullWidth onPress={() => router.push({ pathname: '/paychecks', params: { add: '1' } })} /></EmptyState>}
    <TourHighlight id="home-quick-views"><SectionTitle>A closer look</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><QuickView label="Paychecks" selected={quickView === 'paycheck'} onPress={() => setQuickView('paycheck')} /><QuickView label="Accounts" selected={quickView === 'accounts'} onPress={() => setQuickView('accounts')} /><QuickView label="Savings" selected={quickView === 'savings'} onPress={() => setQuickView('savings')} /></View>
    </TourHighlight>
    {quickView === 'paycheck' ? <Card><Text style={{ fontWeight: '700' }}>Your paycheck plans</Text><Text style={{ color: muted }}>{data.paychecks.filter(p => p.status === 'planned').length} planned · {data.paychecks.filter(p => p.status !== 'planned').length} received</Text><Action label="View all paychecks →" variant="text" onPress={() => router.push('/paychecks')} /></Card> : quickView === 'accounts' ? <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}><Metric label="Actual cash balances" amount={formatMoney(accountSummary.totalCashCents)} detail="Checking, savings, and cash" /><Metric label="Available after goal holds" amount={formatMoney(accountSummary.availableCashCents)} detail="Recorded balances minus pending reservations" /></View>
      <Text style={{ color: colors.danger }}>Credit card debt owed: {formatMoney(accountSummary.creditCardDebtCents)}</Text><Action label="View accounts →" variant="text" onPress={() => router.push('/accounts')} />
    </> : <Card><Metric label="Completed goal savings" amount={formatMoney(savingsSummary.savedCents)} detail={`${savingsSummary.progressPercent.toFixed(1)}% of ${formatMoney(savingsSummary.targetCents)} targeted · excludes planned and pending allocations`} /><Action label="View savings goals →" variant="text" onPress={() => router.push('/goals')} /></Card>}

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
        <Action label="Save payday" variant="primary" fullWidth onPress={() => savePayday()} />
      </> : null}
      <Action label="View paycheck" fullWidth onPress={() => recent ? router.push({ pathname: '/paycheck/[id]', params: { id: recent.id } }) : router.push('/paychecks')} />
    </Card></TourHighlight>

    {upcomingSubscriptions.length ? <Card>
      <Text style={{ color: ink, fontWeight: '700', fontSize: 16 }}>Upcoming subscriptions</Text>
      <Text style={{ color: muted, fontSize: 12 }}>Plan for these charges with your paycheck.</Text>
      {upcomingSubscriptions.map(({ item, dueDate }) => {
        const planned = !!planPaycheck && data.allocations.some(allocation => allocation.subscriptionId === item.id && allocation.paycheckId === planPaycheck.id);
        return <View key={item.id} style={{ paddingVertical: 7, borderTopWidth: 1, borderTopColor: colors.border, gap: 6 }}>
          <Pressable onPress={() => router.push({ pathname: '/transactions', params: { editId: item.id } })} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flex: 1 }}><Text style={{ color: ink, fontWeight: '600' }}>{item.description}</Text><Text style={{ color: muted, fontSize: 12 }}>Due {formatDateDisplay(dueDate)}{item.categoryId ? ` · ${data.categories.find(category => category.id === item.categoryId)?.name ?? 'Category'}` : ''}</Text></View>
            <Text style={{ color: ink }}>{formatMoney(item.amountCents)}</Text>
          </Pressable>
          {planned ? <Text style={{ color: muted, fontSize: 12 }}>Included in paycheck plan · {formatDateDisplay(planPaycheck!.receivedAt)}</Text> : <Action label="Add to paycheck plan" onPress={() => planSubscription(item.id)} />}
        </View>;
      })}
    </Card> : null}

    <SectionTitle>Your next move</SectionTitle>
    <TourHighlight id="home-quick-actions"><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
      <QuickAction label="Add paycheck" onPress={() => router.push({ pathname: '/paychecks', params: { add: '1' } })} />
      <QuickAction label="Add expense" onPress={() => router.push('/transaction/new')} />
      <QuickAction label="Budget money" onPress={() => router.push('/budget')} />
      <QuickAction label="Transfer money" onPress={() => router.push({ pathname: '/transaction/new', params: { type: 'transfer' } })} />
    </View></TourHighlight>

    <TourHighlight id="home-active-budgets"><SectionTitle right={<Action label="View all" variant="text" onPress={() => router.push('/budget')} />}>Your category budgets</SectionTitle>
    {allocations.length ? allocations.map(allocation => {
      const summary = allocationSummary(data, allocation);
      const category = data.categories.find(item => item.id === allocation.categoryId);
      return <PressableBudget key={allocation.id} title={category?.name ?? 'Category'} spent={summary.spentCents} allocated={summary.allocatedCents} remaining={summary.remainingCents} onPress={() => router.push({ pathname: '/allocation/[id]', params: { id: allocation.id } })} />;
    }) : <Text style={{ color: muted }}>Paycheck allocations will appear here.</Text>}</TourHighlight>
  </Page>;
}

function HeaderIcon({ label, mark, onPress }: { label: string; mark: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ minHeight: 48, width: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.pressed : colors.surface })}><Text style={{ color: ink, fontSize: 18 }}>{mark}</Text></Pressable>;
}

function frequencyLabel(frequency?: PaydayFrequency, intervalDays?: number) {
  if (frequency === 'monthly') return 'Repeats monthly';
  if (frequency === 'weekly') return 'Repeats weekly';
  if (frequency === 'biweekly') return 'Repeats every two weeks';
  if (frequency === 'custom' && intervalDays) return `Repeats every ${intervalDays} days`;
  return 'Repeat schedule not set';
}

function QuickView({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => ({ flexGrow: 1, flexBasis: 90, minHeight: 48, borderWidth: 1, borderColor: selected ? ink : colors.border, borderRadius: 14, padding: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.evergreen : pressed ? colors.subtle : colors.surface })}><Text style={{ color: selected ? colors.onPrimary : ink, fontSize: 14, fontWeight: selected ? '700' : '600', textAlign: 'center' }}>{label}</Text></Pressable>;
}

function QuickAction({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ flexGrow: 1, flexBasis: '45%', minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.pressed : colors.surface })}><Text style={{ color: ink, textAlign: 'center' }}>{label}</Text></Pressable>;
}

function PressableBudget({ title, spent, allocated, remaining, onPress }: { title: string; spent: number; allocated: number; remaining: number; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 18, gap: 8, backgroundColor: pressed ? colors.pressed : colors.surface })}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: ink, fontWeight: '600' }}>{title}</Text><Text style={{ color: remaining < 0 ? colors.danger : muted, fontSize: 13 }}>{formatMoney(Math.abs(remaining))} {remaining < 0 ? 'over budget' : 'remaining'}</Text></View>
    <ProgressBar value={spent} max={allocated} /><Text style={{ color: muted, fontSize: 12 }}>{formatMoney(spent)} spent of {formatMoney(allocated)} assigned</Text>
  </Pressable>;
}
