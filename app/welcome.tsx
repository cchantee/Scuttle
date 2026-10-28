import React from 'react';
import { Text, View } from 'react-native';
import { Link, Redirect } from 'expo-router';
import { Action, Card, Feedback, Page } from '../src/components/ui';
import { useData } from '../src/state/DataProvider';

export default function Welcome() {
  const { authConfigured, authLoading, authUser } = useData();
  if (authConfigured && authLoading) return <Page title="Scuttle" showTabs={false}><Text>Loading…</Text></Page>;
  if (authConfigured && authUser) return <Redirect href="/" />;
  return <Page title="Scuttle" showTabs={false}><Feedback />
    <View style={{ flex: 1, justifyContent: 'center', gap: 14, minHeight: 440 }}>
      <Text style={{ fontSize: 17, color: '#555' }}>Make every paycheck count.</Text>
      <Card>
        <Text style={{ color: '#171717', fontSize: 18, fontWeight: '700' }}>Welcome to Scuttle</Text>
        <Text style={{ color: '#555' }}>Plan your paychecks, track account activity, and keep your goals in view.</Text>
        <Link href="/sign-in" asChild><Action label="Sign in" variant="primary" fullWidth onPress={() => {}} /></Link>
        <Link href="/sign-up" asChild><Action label="Create an account" fullWidth onPress={() => {}} /></Link>
      </Card>
      {!authConfigured ? <Card><Text style={{ color: '#555' }}>Cloud sign-in is not configured on this build. You can continue with local device data.</Text><Link href="/" asChild><Action label="Continue in local mode" onPress={() => {}} /></Link></Card> : null}
    </View>
  </Page>;
}
