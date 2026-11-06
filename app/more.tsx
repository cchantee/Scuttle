import { colors } from '../src/design/theme';
import React from 'react';
import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Text } from '../src/design/Text';
import { Action, Card, Disclosure, FeatureButton, Feedback, Page, LocalNotice } from '../src/components/ui';
import { useData } from '../src/state/DataProvider';
import { TourHighlight, useWalkthrough } from '../src/components/walkthrough';
import { useRouter } from 'expo-router';

export default function More() {
  const { authConfigured, authUser, signOut, reportError } = useData();
  const walkthrough = useWalkthrough();
  const router = useRouter();
  return <Page title="Settings & more"><Feedback /><TourHighlight id="more-main">
    <Card><Text style={{ color: colors.teal, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 }}>YOUR SPACE</Text><Text style={{ fontSize: 22, fontWeight: '800' }}>{authConfigured ? 'Connected to your account' : 'On this device'}</Text><LocalNotice /><Text style={{ color: colors.muted }}>Scuttle tracks the activity you record. It does not connect to your bank.</Text></Card>
    <FeatureButton title="Accounts" detail="Cash, savings, credit card debt, and interest." href="/accounts" />
    <FeatureButton title="Savings goals" detail="Build toward what matters, one contribution at a time." href="/goals" />
    <FeatureButton title="Paychecks" detail="Plan future pay, confirm receipt, and adjust allocations." href="/paychecks" />
    <FeatureButton title="Profile" detail="Your name and account details." href="/profile" />
    <Action label="Replay app walkthrough" onPress={() => { walkthrough?.start(); router.replace('/'); }} />

    <FeatureButton title="Budget categories" detail="Manage categories and paycheck allocations." href="/budget" />
    <FeatureButton title="Transactions & recurring bills" detail="Manage activity and scheduled reminders." href="/transactions" />
    {authConfigured && authUser ? <Action label="Sign out" onPress={() => { void signOut().catch(e => reportError(e instanceof Error ? e.message : 'Could not sign out.')); }} /> : null}
    {!authConfigured ? <Text style={{ color: colors.muted, fontSize: 13 }}>This build stores records on this device. Cloud sign-in is not configured.</Text> : null}
  </TourHighlight>
  </Page>;
}
