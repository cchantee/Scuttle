import React, { useRef, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { useLocalSearchParams, usePreventRemove, useRouter } from 'expo-router';
import { Text } from '../../../src/design/Text';
import { colors } from '../../../src/design/theme';
import { Action, Card, DateField, Disclosure, Feedback, Field, Page, SectionTitle, SelectId } from '../../../src/components/ui';
import { useData } from '../../../src/state/DataProvider';
import { AppData, BudgetAllocation, newId, Paycheck, SavingsContribution } from '../../../src/domain/models';
import { paycheckPlanFingerprint } from '../../../src/domain/paycheckPlan';
import { spentForAllocation } from '../../../src/domain/calculations';
import { formatMoney, parseMoney } from '../../../src/domain/money';
import { formatDateDisplay, normalizeDateInput, todayDateInput, todayISODate } from '../../../src/domain/date';

type CategoryDraft = { record: BudgetAllocation; amount: string; existing: boolean };
type GoalDraft = { record: SavingsContribution; amount: string; existing: boolean };
const cents = (value: string): number | null => { try { return value.trim() ? parseMoney(value) : 0; } catch { return null; } };

export default function PaycheckPlanRoute() {
  const { id, receive } = useLocalSearchParams<{ id: string; receive?: string }>();
  const { data, loading } = useData();
  const paycheck = data.paychecks.find(p => p.id === id);
  if (loading) return <Page title="Paycheck plan" showTabs={false} />;
  if (!paycheck) return <Page title="Paycheck not found"><Text>Return to Paychecks to choose another record.</Text></Page>;
  return <PlanEditor key={`${id}-${receive ?? ''}`} initialData={data} paycheck={paycheck} receiving={receive === '1'} />;
}
function PlanEditor({ initialData, paycheck, receiving }: { initialData: AppData; paycheck: Paycheck; receiving: boolean }) {
  const { data, paycheckOperation, error } = useData();
  const router = useRouter();
  const fingerprint = useRef(paycheckPlanFingerprint(initialData, paycheck.id));
  const operationId = useRef(newId());
  const [categories, setCategories] = useState<CategoryDraft[]>(() => {
    const existing = initialData.allocations.filter(a => a.paycheckId === paycheck.id).map(record => ({ record, amount: (record.amountCents / 100).toFixed(2), existing: true }));
    const suggestions = initialData.categories.filter(c => !existing.some(a => a.record.categoryId === c.id)).slice(0, existing.length ? 0 : 5).map(c => ({ record: { id: newId(), paycheckId: paycheck.id, categoryId: c.id, amountCents: 0 }, amount: '', existing: false }));
    return [...existing, ...suggestions];
  });
  const [goals, setGoals] = useState<GoalDraft[]>(() => initialData.contributions.filter(c => c.paycheckId === paycheck.id).map(record => ({ record, amount: (record.amountCents / 100).toFixed(2), existing: true })));
  const [actual, setActual] = useState((paycheck.amountCents / 100).toFixed(2));
  const [account, setAccount] = useState('');
  const [date, setDate] = useState(todayDateInput());
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const disablePrevention = usePreventRemove(dirty, ({ repeat }) => {
    const discard = () => { setDirty(false); repeat(); };
    if (Platform.OS === 'web') { if (globalThis.confirm('Discard your unsaved plan changes?')) discard(); }
    else Alert.alert('Discard plan changes?', 'Your saved paycheck will stay as it was.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: discard }]);
  });
  const all = [...categories, ...goals];
  const validAmounts = all.every(row => cents(row.amount) !== null);
  const total = all.reduce((sum, row) => sum + (cents(row.amount) ?? 0), 0);
  const income = receiving ? cents(actual) : paycheck.amountCents;
  const left = income === null ? null : income - total;
  const belowSpent = categories.some(row => (cents(row.amount) ?? 0) < spentForAllocation(data, row.record.id));
  const blocked = !validAmounts || income === null || income <= 0 || left === null || left < 0 || belowSpent || (receiving && (!account || !normalizeDateInput(date)));
  const change = () => { setDirty(true); setMessage(''); };
  const save = async () => {
    if (busy.current) return;
    if (!dirty && !receiving) { router.replace({ pathname: '/paycheck/[id]', params: { id: paycheck.id } }); return; }
    if (blocked) { setMessage('Check the amounts and required fields before saving.'); return; }
    busy.current = true; setSaving(true); setMessage('');
    try {
      const ok = await paycheckOperation({ type: 'savePlan', id: operationId.current, paycheckId: paycheck.id, expectedPlan: fingerprint.current,
        allocations: categories.filter(row => row.existing || (cents(row.amount) ?? 0) > 0).map(row => ({ ...row.record, amountCents: cents(row.amount)! })),
        goals: goals.filter(row => row.existing || (cents(row.amount) ?? 0) > 0).map(row => ({ ...row.record, amountCents: cents(row.amount)! })),
        receipt: receiving ? { amountCents: income!, accountId: account, date: normalizeDateInput(date)! } : undefined,
      });
      if (ok) { setDirty(false); disablePrevention(); router.replace({ pathname: '/paycheck/[id]', params: { id: paycheck.id } }); }
      else setMessage('Your changes are still here. Review the error, then retry. If the paycheck changed elsewhere, go back and reopen it.');
    } finally { busy.current = false; setSaving(false); }
  };
  return <Page title={receiving ? 'Receive & budget' : 'Budget this paycheck'} showTabs={false} showSavedNotice={false} footer={<>
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}><Text style={{ fontWeight: '700' }}>{left !== null && left < 0 ? 'Over paycheck by' : 'Left to budget'}</Text><Text style={{ color: left !== null && left < 0 ? colors.danger : colors.teal, fontWeight: '800', fontSize: 22, lineHeight: 29 }}>{!validAmounts || left === null ? 'Check amounts' : formatMoney(Math.abs(left))}</Text></View>
    {receiving && (!account || !normalizeDateInput(date)) ? <Text style={{ color: colors.danger, fontSize: 13 }}>{!account ? 'Choose a deposit account above to confirm receipt.' : 'Enter a valid receipt date above.'}</Text> : null}
    {dirty ? <Text style={{ color: colors.muted, fontSize: 12 }}>Unsaved plan · all amounts save together</Text> : null}
    <Action label={saving ? 'Saving plan…' : receiving ? 'Confirm receipt & save plan' : dirty ? 'Save plan' : 'Done'} variant="primary" fullWidth disabled={blocked || saving} onPress={save} />
  </>}><Feedback />
    <Text style={{ color: colors.muted }}>{paycheck.source || 'Paycheck'} · {formatDateDisplay(paycheck.receivedAt)} · {formatMoney(paycheck.amountCents)} {paycheck.status === 'planned' ? 'expected' : 'received'}</Text>
    {receiving ? <Card><Field label="Actual amount received ($)" value={actual} onChangeText={v => { setActual(v); change(); }} keyboardType="decimal-pad" error={cents(actual) === null || (cents(actual) ?? 0) <= 0 ? 'Enter an amount greater than zero.' : undefined} /><SelectId label="Deposit into" choices={data.accounts.filter(a => a.type !== 'credit_card').map(a => ({ id: a.id, title: a.name }))} value={account} onChange={v => { setAccount(v); change(); }} create="account" /><DateField label="Date received" value={date} onChangeText={v => { setDate(v); change(); }} /><Text style={{ color: colors.muted, fontSize: 13 }}>Adjust the amounts below if your pay changed. Receipt and this plan save together; the original plan stays in history.</Text></Card> : null}
    {paycheck.status === 'planned' && !receiving ? <Text style={{ color: colors.muted }}>This is a plan for future income. It will not add money to your accounts or spending budget.</Text> : null}
    <Text>Choose category and goal amounts. Extra money can stay unassigned.</Text>
    <SectionTitle>Everyday spending</SectionTitle>
    {categories.map(row => {
      const spent = spentForAllocation(data, row.record.id);
      const value = cents(row.amount);
      const name = data.categories.find(c => c.id === row.record.categoryId)?.name || 'Missing category';
      return <View key={row.record.id} style={{ gap: 8, paddingVertical: 4 }}>{row.record.subscriptionId ? <><Text style={{ fontWeight: '700' }}>{name} · recurring bill</Text><Text>{formatMoney(row.record.amountCents)} · managed in Budget</Text></> : <Field label={`${name} ($)`} value={row.amount} onChangeText={v => { setCategories(rows => rows.map(r => r.record.id === row.record.id ? { ...r, amount: v } : r)); change(); }} keyboardType="decimal-pad" placeholder="0.00" error={value === null ? 'Use dollars and up to two decimal places.' : value < spent ? `Keep at least ${formatMoney(spent)} for recorded spending.` : undefined} hint={spent ? `${formatMoney(spent)} already spent · ${formatMoney((value ?? 0) - spent)} remaining after this edit` : undefined} />}</View>;
    })}
    {!categories.length ? <Text style={{ color: colors.muted }}>Add a category below to start your plan.</Text> : null}
    <SelectId label="Add a category" choices={data.categories.filter(c => !categories.some(row => row.record.categoryId === c.id)).map(c => ({ id: c.id, title: c.name }))} value="" onChange={id => { if (!id) return; setCategories(rows => rows.some(r => r.record.categoryId === id) ? rows : [...rows, { record: { id: newId(), paycheckId: paycheck.id, categoryId: id, amountCents: 0 }, amount: '', existing: false }]); change(); }} create="category" />
    <SectionTitle>Savings goals</SectionTitle>
    {goals.map(row => <View key={row.record.id} style={{ gap: 8, paddingVertical: 4 }}><Field label={`${data.goals.find(g => g.id === row.record.goalId)?.name || 'Missing goal'} ($)`} value={row.amount} onChangeText={v => { setGoals(rows => rows.map(r => r.record.id === row.record.id ? { ...r, amount: v } : r)); change(); }} keyboardType="decimal-pad" placeholder="0.00" error={cents(row.amount) === null ? 'Enter a valid amount.' : undefined} /></View>)}
    <SelectId label="Add a savings goal" choices={data.goals.filter(g => !goals.some(row => row.record.goalId === g.id)).map(g => ({ id: g.id, title: g.name }))} value="" onChange={id => { if (!id) return; setGoals(rows => rows.some(r => r.record.goalId === id) ? rows : [...rows, { record: { id: newId(), paycheckId: paycheck.id, goalId: id, amountCents: 0, date: todayISODate(), status: 'allocated' }, amount: '', existing: false }]); change(); }} />
    {!data.goals.length ? <Text style={{ color: colors.muted, fontSize: 13 }}>No goals yet. You can save this plan now and create a goal from More later.</Text> : null}
    <Text style={{ color: colors.muted, fontSize: 13 }}>Budget edits and goal allocations do not move money between accounts. Set a goal row to zero to return it to unassigned funds.</Text>
    {left !== null && left < 0 ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>Reduce your amounts by {formatMoney(-left)} to fit this paycheck.</Text> : null}
    {message && !error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{message}</Text> : null}
    <Disclosure title="How to move money in this plan"><Text>Lower a category or goal amount and increase another by the same amount, then save once. A category cannot go below what you have already spent. Blank new rows are skipped.</Text></Disclosure>
  </Page>;
}
