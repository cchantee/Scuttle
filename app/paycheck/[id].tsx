import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '../../src/components/typography';
import { Completion, CoastalScene, EmptyState } from '../../src/components/coastal';
import { Icon, IconTile, categoryIcon } from '../../src/components/icons';
import { Action, Card, Feedback, Page, ProgressBar, SectionTitle } from '../../src/components/ui';
import { allocationSummary, allocatedForPaycheck, unallocatedForPaycheck } from '../../src/domain/calculations';
import { formatMoney } from '../../src/domain/money';
import { useData } from '../../src/state/DataProvider';
import { formatDateDisplay } from '../../src/domain/date';

export default function PaycheckDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, reportError } = useData();
  const [complete, setComplete] = useState(false);
  const [menu, setMenu] = useState(false);
  const [activity, setActivity] = useState(false);
  const paycheck = data.paychecks.find(p => p.id === id);
  if (!paycheck) return <Page title="Paycheck"><Text>Paycheck not found.</Text><Link href="/paychecks">Back to paychecks</Link></Page>;
  const planned = paycheck.status === 'planned';
  const allocated = allocatedForPaycheck(data, id);
  const left = unallocatedForPaycheck(data, id);
  const allocations = data.allocations.filter(a => a.paycheckId === id);
  const goals = data.contributions.filter(c => c.paycheckId === id);
  const allocationIds = new Set(allocations.map(a => a.id));
  const transactions = data.transactions.filter(t => t.paycheckId === id || (t.allocationId && allocationIds.has(t.allocationId))).sort((a, b) => b.date.localeCompare(a.date));
  const edit = () => router.push({ pathname: '/paychecks', params: { paycheckId: id } });
  return <Page title={planned ? 'Planned Paycheck' : 'This Paycheck'}
    headerRight={<Pressable accessibilityRole="button" accessibilityLabel="Paycheck actions" accessibilityState={{ expanded: menu }} onPress={() => setMenu(!menu)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="more" /></Pressable>}
    footer={<Action label="+ Add Allocation" variant="primary" fullWidth onPress={() => router.push({ pathname: '/budget', params: { paycheckId: id } })} />}>
    <Feedback />
    {menu ? <Card><Action label="Edit paycheck" onPress={edit} />{!planned ? <Action label="Move money in this plan" onPress={() => router.push('/move-money')} /> : null}<Action label="Finish budgeting" onPress={() => { if (left < 0) reportError('Review the amounts above this paycheck before finishing.'); else { setComplete(true); setMenu(false); } }} /></Card> : null}
    <View style={{ gap: 12, paddingVertical: 8 }}>
      <Text style={{ fontSize: 16 }}>Paycheck Amount</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Edit paycheck amount" onPress={edit} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><Text role="money" style={{ fontSize: 36 }}>{formatMoney(paycheck.amountCents)}</Text><Text style={{ color: '#69777A' }}>✎</Text></Pressable>
      <Text style={{ fontSize: 14, color: '#69777A' }}>{planned ? 'Expected' : 'Received'} {formatDateDisplay(paycheck.receivedAt)}{paycheck.source ? ` · ${paycheck.source}` : ''}</Text>
      <ProgressBar value={allocated} max={paycheck.amountCents} />
      <Text style={{ fontSize: 14, color: '#69777A' }}>{Math.round(allocated / paycheck.amountCents * 100)}% allocated</Text>
    </View>
    <Card style={{ backgroundColor: '#FAF9F6', paddingBottom: 8 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ flex: 1, gap: 10 }}><Text>Left to Assign</Text><Text role="money" style={{ fontSize: 29 }}>{formatMoney(left)}</Text></View><View style={{ width: 145 }}><CoastalScene height={90} detail /></View></View></Card>
    {planned ? <Action label="Mark as received" onPress={() => router.push({ pathname: '/paychecks', params: { paycheckId: id, receive: '1' } })} /> : null}
    {complete ? <><Completion /><Action label="Return Home" variant="primary" fullWidth onPress={() => router.replace('/')} /></> : null}
    <SectionTitle right={<Action label="Edit" variant="text" onPress={() => router.push({ pathname: '/budget', params: { paycheckId: id } })} />}>Allocations</SectionTitle>
    <View>
      {!allocations.length && !goals.length ? <EmptyState message="Give this paycheck a plan." /> : null}
      {allocations.map(a => {
        const summary = allocationSummary(data, a);
        const name = data.categories.find(c => c.id === a.categoryId)?.name ?? 'Category';
        return <View key={a.id} style={{ borderBottomWidth: 1, borderColor: '#E9E7E2' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Open ${name} allocation`} onPress={() => router.push({ pathname: '/allocation/[id]', params: { id: a.id } })} style={{ minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
            <IconTile name={categoryIcon(name)} tint="#DCE7DA" /><View style={{ flex: 1, gap: 5 }}><Text style={{ fontSize: 18 }}>{name}</Text><Text style={{ fontSize: 13, color: '#69777A' }}>{formatMoney(summary.remainingCents)} left</Text></View><View style={{ alignItems: 'flex-end', gap: 5 }}><Text role="money" style={{ fontSize: 21 }}>{formatMoney(a.amountCents)}</Text><Text style={{ color: '#69777A', fontSize: 12 }}>{a.amountCents ? Math.round(summary.spentCents / a.amountCents * 100) : 0}% used</Text></View><Text>›</Text>
          </Pressable>
        </View>;
      })}
      {goals.map(c => <Pressable key={c.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/goal/[id]', params: { id: c.goalId } })} style={{ minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#E9E7E2' }}><IconTile name="goals" tint="#EFD3C1" /><View style={{ flex: 1 }}><Text>{data.goals.find(g => g.id === c.goalId)?.name ?? 'Savings goal'}</Text><Text style={{ fontSize: 13, color: '#69777A' }}>Goal contribution</Text></View><Text>{formatMoney(c.amountCents)}</Text><Text>›</Text></Pressable>)}
    </View>
    {paycheck.notes ? <Text style={{ color: '#69777A' }}>{paycheck.notes}</Text> : null}
    <Action label={activity ? 'Hide linked activity' : 'View linked activity'} variant="text" onPress={() => setActivity(!activity)} />
    {activity ? <Card>{!transactions.length ? <Text>No linked activity yet.</Text> : transactions.map(t => <Pressable key={t.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/transactions', params: { editId: t.id } })} style={{ paddingVertical: 8, gap: 6 }}><Text>{t.description} · {formatMoney(t.amountCents)}</Text><Text style={{ color: '#69777A', fontSize: 13 }}>{formatDateDisplay(t.date)}</Text></Pressable>)}</Card> : null}
  </Page>;
}
