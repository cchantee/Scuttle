import React from 'react';
import { useRouter } from 'expo-router';
import { useData } from '../src/state/DataProvider';
import { Page, Card, ProgressBar, Action } from '../src/components/ui';
import { Text } from '../src/components/typography';
import { EmptyState } from '../src/components/coastal';
import { goalSummary } from '../src/domain/calculations';
import { formatMoney } from '../src/domain/money';
export default function AddToGoal() {
  const { data } = useData();
  const router = useRouter();
  return <Page title="Add to goal">
    {!data.goals.length ? <><EmptyState message="Your next goal starts here." /></> : null}
    {data.goals.map(goal => <Card key={goal.id}><Text style={{ fontSize: 20 }}>{goal.name}</Text><Text>{formatMoney(goalSummary(data, goal).savedCents)} of {formatMoney(goal.targetCents)}</Text><ProgressBar value={goalSummary(data, goal).savedCents} max={goal.targetCents} /><Action label={`Add to ${goal.name}`} variant="primary" fullWidth onPress={() => router.push({ pathname: '/goal/[id]', params: { id: goal.id, contribute: '1' } })} /></Card>)}
    <Action label="+ Create a new savings goal" variant="secondary" fullWidth onPress={() => router.push({ pathname: '/goal/new', params: { returnTo: 'add-to-goal' } })} />
  </Page>;
}
