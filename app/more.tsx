import { Icon, IconTile, IconName } from '../src/components/icons';
import { colors } from '../src/design/theme';
import { Text } from '../src/components/typography';
import React from 'react';
import { Pressable, View } from 'react-native';
import { Action, Card, Feedback, Page, SectionTitle } from '../src/components/ui';
import { useData } from '../src/state/DataProvider';
import { TourHighlight, useWalkthrough } from '../src/components/walkthrough';
import { useRouter } from 'expo-router';

export default function More() {
  const { authConfigured, authUser, signOut, reportError } = useData();
  const walkthrough = useWalkthrough();
  const router = useRouter();
  return <Page title="Settings"><Feedback /><TourHighlight id="more-main">
    <SectionTitle>Account</SectionTitle>
    <Card style={{ padding: 0, gap: 0 }}>
      <SettingsRow icon="profile" title="Profile" detail="Your details and account" onPress={() => router.push('/profile')} last={authConfigured} />
      {!authConfigured ? <SettingsRow icon="accounts" title="Account setup" detail="Cloud sign-in and sync information" onPress={() => router.push('/sign-in')} last /> : null}
    </Card>

    <SectionTitle>Money tools</SectionTitle>
    <Card style={{ padding: 0, gap: 0 }}>
      <SettingsRow icon="category" title="Budget categories" detail="Categories and paycheck allocations" onPress={() => router.push('/budget')} />
      <SettingsRow icon="transaction" title="Transactions" detail="Record and review activity" onPress={() => router.push('/transactions')} />
      <SettingsRow icon="calendar" title="Financial history" detail="Filter and explore past records" onPress={() => router.push('/history')} last />
    </Card>

    <SectionTitle>App tools</SectionTitle>
    <Card style={{ padding: 0, gap: 0 }}>
      <SettingsRow icon="home" title="Replay walkthrough" detail="A quick tour of Scuttle" onPress={() => { walkthrough?.start(); router.replace('/'); }} last />

    </Card>
    {authConfigured && authUser ? <View style={{ alignSelf: 'center', paddingVertical: 8 }}><Action label="Sign out" destructive onPress={() => { void signOut().catch(e => reportError(e instanceof Error ? e.message : 'Could not sign out.')); }} /></View> : null}
  </TourHighlight>
  </Page>;
}

function SettingsRow({ icon, title, detail, onPress, last = false, expanded }: { icon: IconName; title: string; detail: string; onPress: () => void; last?: boolean; expanded?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={expanded === undefined ? undefined : { expanded }} onPress={onPress} style={({ pressed }) => ({ minHeight: 76, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: last ? 0 : 1, borderColor: colors.border, borderRadius: 10, backgroundColor: pressed ? colors.glass : 'transparent' })}>
    <IconTile name={icon} tint={colors.glass} />
    <View style={{ flex: 1, gap: 4 }}><Text style={{ fontSize: 18 }}>{title}</Text><Text style={{ color: colors.muted, fontSize: 13 }}>{detail}</Text></View>
    {expanded === undefined ? <View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="back" size={16} /></View> : <Text style={{ color: colors.muted, fontSize: 19 }}>{expanded ? '⌃' : '⌄'}</Text>}
  </Pressable>;
}
