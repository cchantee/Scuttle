import React, { useState } from 'react';
import { useData } from '../src/state/DataProvider';
import { Action, Card, Feedback, Field, Page, SelectId } from '../src/components/ui';
import { Text } from '../src/components/typography';
import { Completion } from '../src/components/coastal';
import { allocationSummary } from '../src/domain/calculations';
import { formatMoney, parseMoney } from '../src/domain/money';

export default function MoveMoney() {
  const { data, moveBudgetMoney, reportError } = useData();
  const [source, setSource] = useState('');
  const [category, setCategory] = useState('');
  const [goal, setGoal] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const allocation = data.allocations.find(a => a.id === source);
  const choices = data.allocations.filter(a => !a.subscriptionId && data.paychecks.some(p => p.id === a.paycheckId && !p.budgetArchived && p.status !== 'planned'));
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try { if (await moveBudgetMoney(source, category || undefined, goal || undefined, parseMoney(amount))) { setDone(true); setAmount(''); } }
    catch (e) { reportError(e instanceof Error ? e.message : 'Enter a valid amount.'); }
    finally { setBusy(false); }
  };
  return <Page title="Move money"><Feedback />
    <Text>Move unspent money in your paycheck plan. Your account balance stays the same.</Text>
    {done ? <Completion message="Your money has a plan." /> : null}
    <Card>
      <SelectId label="From budget category" choices={choices.map(a => ({ id: a.id, title: `${data.categories.find(c => c.id === a.categoryId)?.name ?? 'Category'} · ${formatMoney(allocationSummary(data, a).remainingCents)} left` }))} value={source} onChange={value => { setSource(value); setCategory(''); setGoal(''); setDone(false); }} />
      <SelectId label="To budget category" choices={data.categories.filter(c => c.id !== allocation?.categoryId).map(c => ({ id: c.id, title: c.name }))} value={category} onChange={value => { setCategory(value); setGoal(''); }} />
      <Text>or</Text>
      <SelectId label="To savings goal" choices={data.goals.map(g => ({ id: g.id, title: g.name }))} value={goal} onChange={value => { setGoal(value); setCategory(''); }} />
      <Field label="Amount to move" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
      <Action label={busy ? 'Moving…' : 'Move money'} variant="primary" fullWidth onPress={() => void submit()} />
    </Card>
  </Page>;
}
