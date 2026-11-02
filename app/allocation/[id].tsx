import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '../../src/design/Text';
import { colors } from '../../src/design/theme';
import { Action, Card, Feedback, Page, ProgressBar, RecordLine, SectionTitle } from '../../src/components/ui';
import { allocationSummary } from '../../src/domain/calculations';
import { formatMoney } from '../../src/domain/money';
import { formatDateDisplay } from '../../src/domain/date';
import { useData } from '../../src/state/DataProvider';
import { useCrud } from '../../src/components/hooks';
export default function AllocationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useData();
  const router = useRouter();
  const crud = useCrud('transactions');
  const a = data.allocations.find(a => a.id === id);
  if (!a) return <Page title="Budget category"><Text>This category allocation could not be found.</Text></Page>;
  const p = data.paychecks.find(p => p.id === a.paycheckId);
  const summary = allocationSummary(data, a);
  const transactions = data.transactions.filter(t => t.allocationId === a.id).sort((a, b) => b.date.localeCompare(a.date));
  const planned = p?.status === 'planned';
  return <Page title={data.categories.find(c => c.id === a.categoryId)?.name || 'Category'}><Feedback />
    <Text style={{ color: colors.muted }}>{p?.source || 'Paycheck'} · {p ? formatDateDisplay(p.receivedAt) : 'Missing paycheck'}</Text>
    <Card><Text style={{ color: colors.muted }}>{planned ? 'Planned category amount' : summary.remainingCents < 0 ? 'Over budget by' : 'Remaining in this category'}</Text><Text style={{ color: summary.remainingCents < 0 ? colors.danger : colors.text, fontSize: 32, lineHeight: 41, fontWeight: '800' }}>{formatMoney(Math.abs(summary.remainingCents))}</Text><ProgressBar value={summary.spentCents} max={a.amountCents} /><Text>{formatMoney(a.amountCents)} budgeted · {formatMoney(summary.spentCents)} spent</Text></Card>
    {planned ? <Text style={{ color: colors.muted }}>This paycheck has not arrived. Planned amounts are not available to spend.</Text> : p?.budgetArchived ? <Text style={{ color: colors.muted }}>This budget is archived. Restore it from Budget to use it for new spending.</Text> : <Action label="Log spending in this category" variant="primary" fullWidth onPress={() => router.push({ pathname: '/transaction/new', params: { type: 'expense', allocationId: a.id, accountId: p?.remainingAccountId || p?.accountId } })} />}
    <Action label="Adjust paycheck plan" onPress={() => router.push({ pathname: '/paycheck/plan/[id]', params: { id: a.paycheckId } })} />
    <SectionTitle>Spending history</SectionTitle>
    {!transactions.length ? <Text style={{ color: colors.muted }}>No spending recorded in this category yet.</Text> : null}
    {transactions.map(t => <RecordLine key={t.id} title={t.description} amount={formatMoney(t.amountCents)} detail={formatDateDisplay(t.date)} onEdit={() => router.push({ pathname: '/transactions', params: { editId: t.id } })} onDelete={() => crud.confirmDelete(t.id)} />)}
  </Page>;
}
