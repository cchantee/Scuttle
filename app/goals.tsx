import React, { useState } from 'react';
import { Text } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Action, DateField, Field, Feedback, Page, RecordLine } from '../src/components/ui';
import { useCrud } from '../src/components/hooks';
import { goalSummary, pendingForGoal } from '../src/domain/calculations';
import { formatMoney, parseMoney } from '../src/domain/money';
import { useData } from '../src/state/DataProvider';
import { formatDateInput, normalizeDateInput } from '../src/domain/date';

export default function Goals() {
  const crud = useCrud('goals');
  const { data, reportError } = useData();
  const router = useRouter();
  const pathname = usePathname();
  const [formOpen, setFormOpen] = useState(pathname === '/goal/new');
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [initial, setInitial] = useState('0.00');
  const [targetDate, setTargetDate] = useState('');
  const reset = () => { setName(''); setTarget(''); setInitial('0.00'); setTargetDate(''); crud.cancel(); setFormOpen(false); if (pathname === '/goal/new') router.replace('/goals'); };
  const save = async () => {
    try {
      const targetCents = parseMoney(target);
      if (targetCents <= 0) return reportError('Target amount must be greater than zero.');
      const normalizedTargetDate = targetDate ? normalizeDateInput(targetDate) : undefined;
      if (targetDate && !normalizedTargetDate) return reportError('Enter a valid target date as M/D/YYYY.');
      const ok = await crud.submit({ name: name.trim(), targetCents, initialSavedCents: parseMoney(initial), targetDate: normalizedTargetDate });
      if (ok) reset();
    } catch (e) { reportError(e instanceof Error ? e.message : 'Enter valid amounts.'); }
  };

  return <Page title={pathname === '/goal/new' ? 'Create goal' : 'Goals'}><Feedback />
    {!formOpen ? <Action label="+ Create goal" variant="primary" fullWidth onPress={() => router.push('/goal/new')} /> : <>
      <Field label="Goal name" value={name} onChangeText={setName} />
      <Field label="Target amount" value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
      <Field label="Current saved amount (optional)" value={initial} onChangeText={setInitial} keyboardType="decimal-pad" />
      <DateField label="Target date" value={targetDate} onChangeText={setTargetDate} optional />
      <Action label="Save goal" variant="primary" fullWidth onPress={() => void save()} />
      <Action label="Cancel" onPress={reset} />
    </>}
    {!data.goals.length ? <Text>Goals can collect contributions across multiple paychecks.</Text> : null}
    {data.goals.map(goal => {
      const summary = goalSummary(data, goal);
      const pending = pendingForGoal(data, goal.id);
      return <RecordLine key={goal.id} title={goal.name} detail={`${formatMoney(summary.savedCents)} saved / ${formatMoney(goal.targetCents)} · ${formatMoney(summary.remainingCents)} to go${pending ? ` · ${formatMoney(pending)} pending` : ''}${goal.targetDate ? ` · Target ${formatDateInput(goal.targetDate)}` : ''}`} progress={{ value: summary.savedCents, max: goal.targetCents, label: `${summary.progressPercent.toFixed(0)}%` }} onView={() => router.push({ pathname: '/goal/[id]', params: { id: goal.id } })} onEdit={() => { setName(goal.name); setTarget((goal.targetCents / 100).toFixed(2)); setInitial((goal.initialSavedCents / 100).toFixed(2)); setTargetDate(goal.targetDate ? formatDateInput(goal.targetDate) : ''); crud.setEditingId(goal.id); setFormOpen(true); }} onDelete={() => crud.confirmDelete(goal.id)} />;
    })}
  </Page>;
}
