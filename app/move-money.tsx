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
  const [confirming, setConfirming] = useState(false);
  const allocation = data.allocations.find(a => a.id === source);
  const destination = category ? data.categories.find(c => c.id === category)?.name : goal ? data.goals.find(g => g.id === goal)?.name : '';
  const choices = data.allocations.filter(a => !a.subscriptionId && data.paychecks.some(p => p.id === a.paycheckId && !p.budgetArchived && p.status !== 'planned'));
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try { if (await moveBudgetMoney(source, category || undefined, goal || undefined, parseMoney(amount))) { setDone(true); setConfirming(false); setAmount(''); } }
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
      {confirming ? <Card style={{ backgroundColor: '#F5FBF8' }}><Text style={{ fontWeight: '700' }}>Review this change</Text><Text>Move {amount ? formatMoney(parseMoney(amount)) : '$0.00'} from {data.categories.find(c => c.id === allocation?.categoryId)?.name ?? 'your selected category'} to {destination || 'a destination'}.</Text><Text style={{ color: '#5F7378', fontSize: 13 }}>This changes your paycheck plan only. No money leaves your account.</Text><Action label={busy ? 'Moving…' : 'Confirm move'} variant="primary" fullWidth onPress={() => void submit()} /><Action label="Go back" onPress={() => setConfirming(false)} /></Card> : <Action label="Review move" variant="primary" fullWidth onPress={() => { if (!source || !destination || !amount) return reportError('Choose a source, destination, and amount.'); setConfirming(true); }} />}
    </Card>
  </Page>;
}
