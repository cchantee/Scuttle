import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Link, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Action, Feedback } from '../src/components/ui';
import { Text } from '../src/components/typography';
import { Crab, Shoreline } from '../src/components/coastal';
import { colors } from '../src/design/theme';
import { useData } from '../src/state/DataProvider';

export default function Welcome() {
  const { authConfigured, authLoading, authUser } = useData();
  const [intro, setIntro] = useState(true);
  const insets = useSafeAreaInsets();
  useEffect(() => { const timer = setTimeout(() => setIntro(false), 1600); return () => clearTimeout(timer); }, []);
  if (intro) return <View accessibilityLabel="Scuttle shoreline welcome" style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }}><Crab animate size={100} /><Shoreline /></View>;
  if (authLoading) return <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}><Text>Loading Scuttle…</Text></View>;
  if (authConfigured && authUser) return <Redirect href="/" />;
  return <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingHorizontal: 28, justifyContent: 'center', gap: 24 }}><Feedback />
    <View style={{ alignItems: 'center', gap: 14 }}><Crab animate size={86} /><Text role="wordmark" accessibilityRole="header" style={{ fontSize: 65 }}>scuttle</Text><Text role="message" style={{ fontSize: 25, textAlign: 'center' }}>make every paycheck count.</Text><Shoreline /></View>
    <View style={{ gap: 12, width: '100%', maxWidth: 420, alignSelf: 'center' }}>
      <Link href="/sign-in" asChild><Action label="Sign in" variant="primary" fullWidth onPress={() => {}} /></Link>
      <Link href="/sign-up" asChild><Action label="Create an account" fullWidth onPress={() => {}} /></Link>
      {!authConfigured ? <Link href="/" asChild><Action label="Continue in local mode" fullWidth onPress={() => {}} /></Link> : null}
    </View>
  </View>;
}
