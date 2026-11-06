import { searchScuttle } from '../src/domain/scuttleSearch';
import { LoadingRecords } from '../src/components/LoadingRecords';
import { goalOverview } from '../src/domain/goalOverview';
import { currentPaycheck, paycheckDestination } from '../src/domain/navigation';
import { colors } from '../src/design/theme';
import { Icon, IconTile, categoryIcon } from '../src/components/icons';
import { EmptyState, CoastalBalance, CoastalScene, Crab } from '../src/components/coastal';
import { Text } from '../src/components/typography';
import React, { useEffect, useMemo, useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { accountBalance, activeBudgetAllocations, allocatedForPaycheck, allocationSummary, cashAccountSummary, savingsGoalSummary, nextSubscriptionDue, goalSummary, unallocatedForPaycheck } from '../src/domain/calculations';
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickView, setQuickView] = useState<'paycheck' | 'accounts' | 'savings'>('paycheck');
  const [editingPayday, setEditingPayday] = useState(false);
  const [paydaySaved, setPaydaySaved] = useState(false);
  const [paydayInput, setPaydayInput] = useState(data.user.nextPayday ? formatDateInput(data.user.nextPayday) : '');
  const [paydayFrequency, setPaydayFrequency] = useState<PaydayFrequency>(data.user.paydayFrequency ?? 'weekly');
  const [paydayIntervalInput, setPaydayIntervalInput] = useState(data.user.paydayIntervalDays?.toString() ?? '');
  const recent = currentPaycheck(data);
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
  const searchResults = useMemo(() => searchScuttle(data, search), [data, search]);

  if (authConfigured && authLoading) return <LoadingRecords />;
  if (authConfigured && !authUser) return <Redirect href="/welcome" />;
  if (loading) return <LoadingRecords />;
  const cash = cashAccountSummary(data);
  const savings = goalOverview(data);
  const allocated = recent ? allocatedForPaycheck(data, recent.id) : 0;
  const unallocated = recent ? unallocatedForPaycheck(data, recent.id) : 0;
  const allocations = [...activeBudgetAllocations(data)].sort((a, b) => { const priority = (id: string) => /grocer|gas|food|fun|discretion|personal/i.test(data.categories.find(c => c.id === id)?.name ?? '') ? 0 : 1; return priority(a.categoryId) - priority(b.categoryId); });
  const planPaycheck = [...data.paychecks].filter(item => !item.budgetArchived).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0];
  const rawName = authUser?.displayName || (authConfigured ? '' : data.user.displayName);
  const firstName = rawName.trim().split(/\s+/)[0];
  const greetingName = firstName && firstName.toLowerCase() !== 'local' ? firstName : 'User';
  const nextPayday = data.user.nextPayday;
  const upcomingPayday = nextPayday && data.user.paydayFrequency
    ? calculateNextPayday(nextPayday, todayISODate(data.user), data.user.paydayFrequency, data.user.paydayIntervalDays)
    : nextPayday;
  const daysUntilPayday = upcomingPayday ? Math.round((Date.parse(`${upcomingPayday}T00:00:00Z`) - Date.parse(`${todayISODate(data.user)}T00:00:00Z`)) / 86400000) : null;
  const countdown = daysUntilPayday === null ? '' : daysUntilPayday < 0 ? `${Math.abs(daysUntilPayday)} days ago` : daysUntilPayday === 0 ? 'Today' : daysUntilPayday < 7 ? `in ${daysUntilPayday} ${daysUntilPayday === 1 ? 'day' : 'days'}` : `in ${Math.floor(daysUntilPayday / 7)} ${Math.floor(daysUntilPayday / 7) === 1 ? 'week' : 'weeks'}${daysUntilPayday % 7 ? ` / ${daysUntilPayday % 7} ${daysUntilPayday % 7 === 1 ? 'day' : 'days'}` : ''}`;
  const upcomingSubscriptions = data.transactions.filter(item => item.type === 'subscription').map(item => ({ item, dueDate: nextSubscriptionDue(item, todayISODate(data.user)) })).filter((row): row is { item: typeof data.transactions[number]; dueDate: string } => !!row.dueDate && (!upcomingPayday || row.dueDate <= upcomingPayday)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const savePayday = async () => {
    const normalized = normalizeDateInput(paydayInput);
    if (!normalized) { reportError('Enter a valid date as M/D/YYYY.'); return; }
    if (paydayFrequency === 'custom' && !/^\d+$/.test(paydayIntervalInput)) { reportError('Enter how many days between paychecks.'); return; }
    const interval = paydayFrequency === 'custom' ? Number(paydayIntervalInput) : undefined;
    if (paydayFrequency === 'custom' && (!interval || interval < 1 || interval > 365)) { reportError('Choose a repeat interval from 1 to 365 days.'); return; }
    if (await saveNextPayday(normalized, paydayFrequency, interval)) { setEditingPayday(false); setPaydaySaved(true); }
  };
  const headerRight = <View style={{ flexDirection: 'row', gap: 5 }}><HeaderIcon label="Search Scuttle" mark="search" onPress={() => { setSearchOpen(!searchOpen); if (searchOpen) setSearch(''); }} /><HeaderIcon label="More and settings" mark="more" onPress={() => router.push('/more')} /></View>;
  const transactions = [...data.transactions].filter(t => t.type !== 'subscription').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const planned = [...data.paychecks].filter(p => p.status === 'planned').sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))[0];
  return <Page title={`Good morning, ${greetingName}`} headerRight={headerRight}>
    <Feedback />
    {searchOpen ? <View style={{ gap: 10 }}>
      <Field label="Search Scuttle" value={search} onChangeText={setSearch} placeholder="Search names, amounts, dates, or pages" />
      {query ? <Card>{searchResults.map(item => <Action key={item.key} label={`${item.label} · ${item.detail}`} variant="text" onPress={() => router.push(item.destination as Parameters<typeof router.push>[0])} />)}{!searchResults.length ? <Text style={{ color: muted }}>No matching records.</Text> : null}</Card> : null}
    </View> : null}

    <TourHighlight id="home-quick-views">
      <View accessibilityRole="tablist" accessibilityLabel="Dashboard view" style={{ flexDirection: 'row', padding: 4, borderRadius: 15, backgroundColor: colors.track, marginBottom: 14 }}>
        {([{ id: 'paycheck', label: 'Paycheck' }, { id: 'accounts', label: 'Accounts' }, { id: 'savings', label: 'Savings' }] as const).map(view => <Pressable key={view.id} accessibilityRole="tab" accessibilityState={{ selected: quickView === view.id }} onPress={() => setQuickView(view.id)} style={{ flex: 1, minHeight: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: quickView === view.id ? colors.surface : 'transparent' }}><Text style={{ fontSize: 13, fontWeight: quickView === view.id ? '600' : '400', color: quickView === view.id ? ink : muted }}>{view.label}</Text></Pressable>)}
      </View>
      {quickView === 'paycheck' ? <View style={{ gap: 12 }}><Pressable accessibilityRole="button" accessibilityLabel="View this paycheck and its budget plan" onPress={() => router.push(paycheckDestination(data))}><CoastalBalance title="This paycheck" amount={recent ? formatMoney(recent.amountCents) : 'Your next chapter'} subtitle={recent ? `${recent.source || 'Paycheck'} · ${formatDateDisplay(recent.receivedAt)}` : 'Record a paycheck to start your plan'} /></Pressable><View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 1, gap: 4 }}><Text style={{ color: muted, fontSize: 12 }}>Already planned</Text><Text role="money" style={{ fontSize: 19 }}>{formatMoney(allocated)}</Text></View><View style={{ flex: 1, gap: 4, alignItems: 'flex-end' }}><Text style={{ color: muted, fontSize: 12 }}>{unallocated < 0 ? 'Over assigned' : 'Left to assign'}</Text><Text role="money" style={{ fontSize: 22 }}>{formatMoney(Math.abs(unallocated))}</Text></View></View><ProgressBar value={allocated} max={recent?.amountCents ?? 0} color={colors.teal} /><Action label={recent ? 'View paycheck plan →' : 'View paychecks →'} variant="text" onPress={() => router.push(paycheckDestination(data))} /></View> : quickView === 'accounts' ? <View style={{ gap: 10 }}><CoastalBalance title="Your account balances" amount={formatMoney(cash.totalCashCents)} subtitle={`${formatMoney(cash.availableCashCents)} available after goal reservations`} /><Action label="View all accounts →" variant="text" onPress={() => router.push('/accounts')} /></View> : <View style={{ gap: 12 }}><CoastalBalance title="Set aside for your goals" amount={formatMoney(savings.setAsideCents)} subtitle={`${formatMoney(savings.targetCents)} total target${savings.reservedCents ? ` · ${formatMoney(savings.reservedCents)} reserved in accounts` : ''}`} /><ProgressBar value={savings.setAsideCents} max={savings.targetCents} color={colors.teal} /><Action label="View all savings goals →" variant="text" onPress={() => router.push('/goals')} /></View>}

    </TourHighlight>

    <TourHighlight id="home-next-payday"><View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 2 }}>
        <IconTile name="calendar" tint={colors.glass} />
        <View style={{ flex: 1, gap: 2 }}><Text style={{ fontSize: 13, color: muted }}>Next payday{countdown ? ` · ${countdown}` : ''}</Text><Text style={{ fontSize: 14, fontWeight: '600' }}>{upcomingPayday ? formatDateDisplay(upcomingPayday) : 'Set your payday rhythm'}</Text></View>
        <Action label={editingPayday ? 'Cancel' : upcomingPayday ? 'Change' : 'Set date'} variant="text" onPress={() => { setPaydayInput(nextPayday ? formatDateInput(nextPayday) : todayDateInput(data.user)); setPaydayFrequency(data.user.paydayFrequency ?? 'weekly'); setPaydayIntervalInput(data.user.paydayIntervalDays?.toString() ?? ''); setPaydaySaved(false); setEditingPayday(!editingPayday); }} />
      </View>
      {editingPayday ? <Card><DateField label="Upcoming paycheck date" value={paydayInput} onChangeText={setPaydayInput} /><Text style={{ fontSize: 14 }}>How often are you paid?</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{([{ id: 'monthly', label: 'Monthly' }, { id: 'weekly', label: 'Weekly' }, { id: 'biweekly', label: 'Biweekly' }, { id: 'custom', label: 'Other' }] as const).map(option => <Action key={option.id} label={option.label} variant={paydayFrequency === option.id ? 'primary' : 'secondary'} onPress={() => setPaydayFrequency(option.id)} />)}</View>{paydayFrequency === 'custom' ? <Field label="Repeat every how many days?" value={paydayIntervalInput} onChangeText={setPaydayIntervalInput} keyboardType="numeric" placeholder="1–365 days" /> : null}<Action label="Save payday" variant="primary" fullWidth onPress={() => void savePayday()} /></Card> : null}
      {paydaySaved ? <Text accessibilityLiveRegion="polite" style={{ color: muted, fontSize: 13 }}>Payday schedule saved.</Text> : null}
    </View></TourHighlight>

    <View style={{ gap: 9 }}><SectionTitle right={<Text style={{ color: muted, fontSize: 12 }}>{formatMoney(cash.totalCashCents)} total cash</Text>}>Your accounts</SectionTitle>
      <Card style={{ padding: 0, gap: 0 }}>
        {data.accounts.slice(0, 3).map((account, index) => <Pressable key={account.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/account/[id]', params: { id: account.id } })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, minHeight: 76, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.background : 'transparent' })}>
          <IconTile name="accounts" tint={index % 2 ? colors.mist : colors.glass} />
          <View style={{ flex: 1, gap: 3 }}><Text style={{ fontSize: 14, fontWeight: '500' }}>{account.name}</Text><Text style={{ fontSize: 12, color: muted }}>{account.type.replace(/_/g, ' ')}</Text></View><Text role="money" style={{ fontSize: 16 }}>{formatMoney(accountBalance(data, account))}{account.type === 'credit_card' ? ' owed' : ''}</Text><Text style={{ color: muted }}>›</Text>
        </Pressable>)}
        <Action label={data.accounts.length ? 'View all accounts  →' : 'Add your first account  →'} variant="text" fullWidth onPress={() => router.push('/accounts')} />
      </Card>
    </View>

    <View style={{ gap: 9 }}><SectionTitle right={<Action label="View all" variant="text" onPress={() => router.push('/goals')} />}>Your goals</SectionTitle>
      {data.goals.length ? <Card style={{ paddingVertical: 0, gap: 0 }}>{data.goals.slice(0, 3).map((goal, index) => {
        const summary = goalSummary(data, goal);
        return <Pressable key={goal.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/goal/[id]', params: { id: goal.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, borderBottomWidth: index < Math.min(data.goals.length, 3) - 1 ? 1 : 0, borderColor: colors.border }}>
          <IconTile name={categoryIcon(goal.name)} tint={colors.shell} /><View style={{ flex: 1, gap: 9 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><Text style={{ flex: 1, fontSize: 14, fontWeight: '500' }}>{goal.name}</Text><Text style={{ fontSize: 12, color: muted }}>{formatMoney(summary.savedCents)} / {formatMoney(goal.targetCents)}</Text></View><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={{ flex: 1 }}><ProgressBar value={summary.savedCents} max={goal.targetCents} color={colors.teal} /></View><Text style={{ fontSize: 11, color: muted }}>{Math.round(summary.progressPercent)}%</Text></View></View>
        </Pressable>;
      })}</Card> : <Card><Text style={{ color: muted, fontSize: 14 }}>A holiday, a rainy day, a fresh start. Make room for what matters.</Text><Action label="Create a savings goal" variant="text" onPress={() => router.push('/goal/new')} /></Card>}
    </View>

    <TourHighlight id="home-active-budgets"><View style={{ gap: 9 }}><SectionTitle right={<Action label="View all" variant="text" onPress={() => router.push('/budget')} />}>Your budget</SectionTitle>
      <Card style={{ paddingVertical: 0, gap: 0 }}>{allocations.length ? allocations.slice(0, 3).map(allocation => {
        const summary = allocationSummary(data, allocation);
        return <PressableBudget key={allocation.id} title={data.categories.find(c => c.id === allocation.categoryId)?.name ?? 'Category'} spent={summary.spentCents} allocated={summary.allocatedCents} remaining={summary.remainingCents} onPress={() => router.push({ pathname: '/allocation/[id]', params: { id: allocation.id } })} />;
      }) : <View style={{ paddingVertical: 16, gap: 8 }}><Text style={{ color: muted, fontSize: 14 }}>Your category budgets will appear here when you plan a paycheck.</Text><Action label="Make a plan" variant="text" onPress={() => router.push('/budget')} /></View>}</Card>
    </View></TourHighlight>

    {upcomingSubscriptions.length ? <View style={{ gap: 9 }}><SectionTitle right={<Action label="View all" variant="text" onPress={() => router.push('/transactions')} />}>Before next payday</SectionTitle><Card>{upcomingSubscriptions.slice(0, 3).map(({ item, dueDate }) => <Pressable accessibilityRole="button" key={item.id} onPress={() => router.push({ pathname: '/transactions', params: { editId: item.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}><IconTile name="calendar" tint={colors.shell} /><View style={{ flex: 1, gap: 3 }}><Text style={{ fontSize: 14, fontWeight: '500' }}>{item.description}</Text><Text style={{ fontSize: 12, color: muted }}>Due {formatDateDisplay(dueDate)}</Text></View><Text role="money" style={{ fontSize: 16 }}>{formatMoney(item.amountCents)}</Text></Pressable>)}</Card></View> : null}

    <View style={{ gap: 9 }}><SectionTitle right={<Action label="View all" variant="text" onPress={() => router.push('/transactions')} />}>Recent activity</SectionTitle><Card style={{ paddingVertical: 3, gap: 0 }}>{transactions.length ? transactions.map((tx, index) => <Pressable accessibilityRole="button" key={tx.id} onPress={() => router.push({ pathname: '/transactions', params: { editId: tx.id } })} style={{ flexDirection: 'row', gap: 11, paddingVertical: 15, alignItems: 'center', borderBottomWidth: index < transactions.length - 1 ? 1 : 0, borderColor: colors.border }}><IconTile name={tx.type === 'transfer' ? 'move' : 'transaction'} tint={colors.mist} /><View style={{ flex: 1, gap: 3 }}><Text style={{ fontSize: 14, fontWeight: '500' }}>{tx.description}</Text><Text style={{ color: muted, fontSize: 12 }}>{formatDateDisplay(tx.date)}</Text></View><Text role="money" style={{ fontSize: 14 }}>{tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : ''}{formatMoney(tx.amountCents)}</Text></Pressable>) : <Text style={{ color: muted, paddingVertical: 16, fontSize: 14 }}>Your recent activity will appear here.</Text>}</Card></View>

    {planned ? <Card style={{ backgroundColor: colors.mist, overflow: 'hidden' }}><Text style={{ fontSize: 14 }}>Your next paycheck</Text><Text style={{ color: muted, fontSize: 13 }}>Expected {formatDateDisplay(planned.receivedAt)}</Text><Text role="money" style={{ fontSize: 30 }}>{formatMoney(planned.amountCents)}</Text><CoastalScene height={78} /><Action label="Plan this paycheck" variant="primary" fullWidth onPress={() => router.push({ pathname: '/paycheck/[id]', params: { id: planned.id } })} /></Card> : null}
    <View style={{ borderRadius: 20, borderWidth: 1, borderColor: colors.border, paddingTop: 22, overflow: 'hidden', backgroundColor: colors.surface }}><Text role="message" style={{ fontSize: 26, paddingHorizontal: 22 }}>Small moves today.</Text><Text role="message" style={{ fontSize: 26, paddingHorizontal: 22 }}>A little more freedom tomorrow.</Text><CoastalScene height={108} /></View>
    <TourHighlight id="home-quick-actions"><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
      {([{ label: 'Budget', href: '/budget', icon: 'category' }, { label: 'Transactions', href: '/transactions', icon: 'transaction' }, { label: 'History', href: '/history', icon: 'calendar' }] as const).map(item => <Pressable key={item.href} accessibilityRole="button" onPress={() => router.push(item.href)} style={{ flex: 1, alignItems: 'center', gap: 9, paddingVertical: 12, minHeight: 76 }}><IconTile name={item.icon} tint={colors.shell} /><Text style={{ fontSize: 12 }}>{item.label}</Text></Pressable>)}
    </View></TourHighlight>
  </Page>;
}

function HeaderIcon({ label, mark, onPress }: { label: string; mark: 'profile' | 'more' | 'search'; onPress: () => void }) {
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
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}: ${formatMoney(Math.abs(remaining))} ${remaining < 0 ? 'over budget' : 'remaining'}`} onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.background : 'transparent' })}>
    <IconTile name={categoryIcon(title)} tint={remaining < 0 ? colors.shell : colors.glass} />
    <View style={{ flex: 1, gap: 8 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><Text style={{ fontSize: 14, fontWeight: '500' }}>{title}</Text><Text style={{ fontSize: 12, color: muted }}>{formatMoney(Math.abs(remaining))} {remaining < 0 ? 'over budget' : 'left'}</Text></View><ProgressBar value={spent} max={allocated} color={remaining < 0 ? colors.coral : colors.teal} /></View><Text style={{ color: muted }}>›</Text>
  </Pressable>;
}
