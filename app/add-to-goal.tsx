import React from 'react';
import { useRouter } from 'expo-router';
import { useData } from '../src/state/DataProvider';
import { Page, Card, Action } from '../src/components/ui';
import { Text } from '../src/components/typography';
import { EmptyState } from '../src/components/coastal';
import { goalSummary } from '../src/domain/calculations';
import { formatMoney } from '../src/domain/money';
export default function AddToGoal() {
  const { data } = useData();
  const router = useRouter();
  return <Page title="Add to goal"><Text>Choose the goal you want to contribute to.</Text>
    {!data.goals.length ? <><EmptyState message="Your next goal starts here." /><Action label="Create a goal" variant="primary" onPress={() => router.push('/goal/new')} /></> : null}
    {data.goals.map(goal => <Card key={goal.id}><Text style={{ fontSize: 20 }}>{goal.name}</Text><Text>{formatMoney(goalSummary(data, goal).savedCents)} of {formatMoney(goal.targetCents)}</Text><Action label={`Add to ${goal.name}`} onPress={() => router.push({ pathname: '/goal/[id]', params: { id: goal.id, contribute: '1' } })} /></Card>)}
  </Page>;
}
