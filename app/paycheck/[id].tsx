import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '../../src/design/Text';
import { colors } from '../../src/design/theme';
import { Action, Card, Disclosure, Feedback, Page, ProgressBar, RecordLine, SectionTitle } from '../../src/components/ui';
import { Metric } from '../../src/components/brand';
import { allocatedForPaycheck, allocationSummary, unallocatedForPaycheck } from '../../src/domain/calculations';
import { formatMoney } from '../../src/domain/money';
import { formatDateDisplay } from '../../src/domain/date';
import { useData } from '../../src/state/DataProvider';
import { useCrud } from '../../src/components/hooks';

export default function PaycheckDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, saveRecord } = useData();
  const router = useRouter();
  const paycheckCrud = useCrud('paychecks');
  const allocationCrud = useCrud('allocations');
  const contributionCrud = useCrud('contributions');
  const transactionCrud = useCrud('transactions');
  const p = data.paychecks.find(p => p.id === id);
  if (!p) return <Page title="Paycheck"><Text>Paycheck not found.</Text><Action label="All paychecks" onPress={() => router.replace('/paychecks')} /></Page>;
  const categories = data.allocations.filter(a => a.paycheckId === id);
  const goals = data.contributions.filter(c => c.paycheckId === id);
  const ids = new Set(categories.map(a => a.id));
  const transactions = data.transactions.filter(t => t.paycheckId === id || (t.allocationId && ids.has(t.allocationId))).sort((a, b) => b.date.localeCompare(a.date));
  const planned = p.status === 'planned';
  const plan = () => router.push({ pathname: '/paycheck/plan/[id]', params: { id: p.id } });
  return <Page title={p.source || 'Paycheck'}><Feedback />
    <Text style={{ color: colors.muted }}>{planned ? 'Planned for' : 'Received'} {formatDateDisplay(p.receivedAt)}{p.budgetArchived ? ' · Budget archived' : ''}</Text>
    <Card><Text style={{ color: colors.muted }}>{planned ? 'Expected income' : 'Paycheck amount'}</Text><Text style={{ fontSize: 32, lineHeight: 40, fontWeight: '800' }}>{formatMoney(p.amountCents)}</Text><ProgressBar value={allocatedForPaycheck(data, p.id)} max={p.amountCents} /><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}><Metric label="Budgeted" amount={formatMoney(allocatedForPaycheck(data, p.id))} /><Metric label="Left to budget" amount={formatMoney(unallocatedForPaycheck(data, p.id))} caution={unallocatedForPaycheck(data, p.id) < 0} /></View><Text style={{ color: colors.muted, fontSize: 13 }}>{planned ? 'Planned money is not available to spend.' : p.accountId ? `Deposit recorded in ${data.accounts.find(a => a.id === p.accountId)?.name || 'account'}. Budget edits do not change this balance.` : 'Budget only · no account deposit recorded.'}</Text></Card>
    {planned ? <Action label="Mark as received" variant="primary" fullWidth onPress={() => router.push({ pathname: '/paycheck/plan/[id]', params: { id: p.id, receive: '1' } })} /> : null}
    <Action label={categories.length || goals.length ? 'Edit paycheck plan' : 'Budget this paycheck'} variant={planned ? 'secondary' : 'primary'} fullWidth onPress={plan} />
    {p.plannedAmountCents !== undefined ? <Text style={{ color: colors.muted }}>Planned {formatMoney(p.plannedAmountCents)} · Received {formatMoney(p.amountCents)} · Difference {formatMoney(p.amountCents - p.plannedAmountCents)}</Text> : null}
    <SectionTitle>Spending categories</SectionTitle>
    {!categories.length ? <Text style={{ color: colors.muted }}>No categories yet. Add them in the paycheck plan.</Text> : null}
    {categories.map(a => { const summary = allocationSummary(data, a); return <RecordLine key={a.id} title={data.categories.find(c => c.id === a.categoryId)?.name || 'Category'} amount={formatMoney(summary.remainingCents)} tone={summary.remainingCents < 0 ? 'caution' : 'default'} detail={`${planned ? 'Planned' : 'Remaining'} · ${formatMoney(a.amountCents)} budgeted · ${formatMoney(summary.spentCents)} spent`} onView={() => router.push({ pathname: '/allocation/[id]', params: { id: a.id } })} onEdit={plan} onDelete={() => allocationCrud.confirmDelete(a.id)} />; })}
    <SectionTitle>Savings goals</SectionTitle>
    {goals.length ? goals.map(c => <RecordLine key={c.id} title={data.goals.find(g => g.id === c.goalId)?.name || 'Goal'} amount={formatMoney(c.amountCents)} detail={`${planned ? 'Planned' : 'Set aside'} · no account transfer`} onView={() => router.push({ pathname: '/goal/[id]', params: { id: c.goalId } })} onEdit={plan} onDelete={() => contributionCrud.confirmDelete(c.id)} />) : <Text style={{ color: colors.muted }}>Add an existing savings goal in the paycheck plan.</Text>}
    <Disclosure title="Paycheck details & account"><Text>{p.notes || 'No note added.'}</Text>{p.plannedAmountCents !== undefined ? <Text>Originally planned: {formatMoney(p.plannedAmountCents)} · Actual: {formatMoney(p.amountCents)} · Difference: {formatMoney(p.amountCents - p.plannedAmountCents)}</Text> : null}{p.remainingAccountId ? <Text>Remaining funds held in {data.accounts.find(a => a.id === p.remainingAccountId)?.name || 'account'}.</Text> : null}<Action label="Edit details or move remaining funds" onPress={() => router.push({ pathname: '/paychecks', params: { paycheckId: p.id } })} /><Action label={p.budgetArchived ? 'Restore budget' : 'Archive budget'} onPress={() => saveRecord('paychecks', { ...p, budgetArchived: !p.budgetArchived })} /><Action label="Delete paycheck…" destructive onPress={() => paycheckCrud.confirmDelete(p.id)} /></Disclosure>
    {p.originalPlan ? <Disclosure title="Original plan before receipt"><Text>{formatDateDisplay(p.originalPlan.date)} · {formatMoney(p.originalPlan.amountCents)}</Text>{p.originalPlan.allocations.map(a => <Text key={a.id}>{data.categories.find(c => c.id === a.categoryId)?.name || 'Category'}: {formatMoney(a.amountCents)}</Text>)}{p.originalPlan.goals.map(c => <Text key={c.id}>{data.goals.find(g => g.id === c.goalId)?.name || 'Goal'}: {formatMoney(c.amountCents)}</Text>)}</Disclosure> : null}
    <Disclosure title={`Allocation history (${p.allocationHistory?.length ?? 0})`}>{(p.allocationHistory ?? []).map(h => <Text key={h.id}>{formatDateDisplay(h.date)} · {h.description}</Text>)}</Disclosure>
    <Disclosure title={`Linked activity (${transactions.length})`}>{transactions.map(t => <RecordLine key={t.id} title={t.description} detail={`${formatDateDisplay(t.date)} · ${t.type}`} amount={formatMoney(t.amountCents)} onEdit={() => router.push({ pathname: '/transactions', params: { editId: t.id } })} onDelete={() => transactionCrud.confirmDelete(t.id)} />)}</Disclosure>
  </Page>;
}
