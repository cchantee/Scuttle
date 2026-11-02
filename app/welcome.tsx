import React from 'react';
import { View } from 'react-native';
import { Text } from '../src/design/Text';
import { colors } from '../src/design/theme';
import { Redirect, useRouter } from 'expo-router';
import { Action, Feedback, Page } from '../src/components/ui';
import { Eyebrow, Mascot } from '../src/components/brand';
import { useData } from '../src/state/DataProvider';

export default function Welcome() {
  const { authConfigured, authLoading, authUser } = useData();
  const router = useRouter();
  if (authConfigured && authLoading) return <Page title="Scuttle" showTabs={false} />;
  if (authConfigured && authUser) return <Redirect href="/" />;
  return <Page title="Scuttle" showTabs={false}><Feedback />
    <View style={{ backgroundColor: colors.evergreen, borderRadius: 28, padding: 24, gap: 18 }}>
      <Eyebrow light>Your money. Your pace.</Eyebrow>
      <Text style={{ fontSize: 34, lineHeight: 41, fontWeight: '800', letterSpacing: -1.8, color: colors.paper }}>Make every paycheck <Text style={{ fontSize: 34, lineHeight: 41, fontWeight: '800', color: colors.lime }}>go further.</Text></Text>
      <Text style={{ color: colors.mutedOnDark, fontSize: 16, lineHeight: 26 }}>Give your money a plan, keep spending in sight, and build toward what matters.</Text>
      <View style={{ backgroundColor: colors.lime, borderRadius: 22, padding: 22, gap: 12 }}><Mascot size={50} mood="ready" /><Text style={{ fontSize: 21, lineHeight: 29, fontWeight: '800' }}>A little clarity, every payday.</Text><Text>Money moves. You’ve got this.</Text></View>
      <Text style={{ color: colors.mutedOnDark }}>Plan it. Assign it. Make your next move.</Text>
    </View>
    {authConfigured ? <><Action label="Get started" variant="primary" fullWidth onPress={() => router.push('/sign-up')} /><Action label="Already have an account? Sign in" fullWidth onPress={() => router.push('/sign-in')} /><Text style={{ color: colors.muted, textAlign: 'center', fontSize: 13 }}>This build saves records to your signed-in cloud account.</Text></> : <><Action label="Get started on this device" variant="primary" fullWidth onPress={() => router.replace('/')} /><Text style={{ color: colors.muted, fontSize: 13 }}>No sign-in needed. Records stay on this device; cloud sync is not configured.</Text></>}
  </Page>;
}
