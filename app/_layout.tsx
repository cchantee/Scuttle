import { LoadingRecords } from '../src/components/LoadingRecords';
import React from 'react';
import { useFonts } from 'expo-font';
import { Pressable, View, Text as NativeText } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { fontAssets, colors } from '../src/design/theme';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DataProvider } from '../src/state/DataProvider';
import { useData } from '../src/state/DataProvider';
import { WalkthroughProvider } from '../src/components/walkthrough';

export const unstable_settings = { anchor: 'welcome' };

function Routes() {
  const { authConfigured, authUser } = useData();
  return <WalkthroughProvider><Stack screenOptions={{ headerShown: false }}>
    <Stack.Protected guard={__DEV__}>
      <Stack.Screen name="typography-preview" />
    </Stack.Protected>
    <Stack.Screen name="welcome" />
    <Stack.Screen name="sign-in" options={{ title: 'Account' }} />
    <Stack.Screen name="sign-up" options={{ title: 'Create account' }} />
    <Stack.Protected guard={!authConfigured || Boolean(authUser)}>
      <Stack.Screen name="move-money" />
      <Stack.Screen name="add-to-goal" />
      <Stack.Screen name="index" options={{ title: 'Dashboard' }} />
      <Stack.Screen name="paychecks" />
      <Stack.Screen name="budget" />
      <Stack.Screen name="transactions" />
      <Stack.Screen name="accounts" />
      <Stack.Screen name="goals" />
      <Stack.Screen name="history" />
      <Stack.Screen name="more" />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
      <Stack.Screen name="account/[id]" options={{ title: 'Account details' }} />
      <Stack.Screen name="paycheck/[id]" options={{ title: 'Paycheck details' }} />
      <Stack.Screen name="allocation/[id]" options={{ title: 'Budget details' }} />
      <Stack.Screen name="goal/[id]" options={{ title: 'Goal details' }} />
      <Stack.Screen name="goal/new" options={{ title: 'Create goal' }} />
      <Stack.Screen name="transaction/new" options={{ title: 'Add transaction' }} />
    </Stack.Protected>
  </Stack></WalkthroughProvider>;
}

function LoadedApp({ retry }: { retry: () => void }) {
  const [loaded, error] = useFonts(fontAssets);
  if (!loaded && !error) return <LoadingRecords label="Loading Scuttle…" />;
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.background, padding: 32, justifyContent: 'center', gap: 16 }}><NativeText style={{ color: colors.text }}>{error ? 'Scuttle could not load its fonts. Check your connection to Expo and reopen the app.' : 'Loading Scuttle…'}</NativeText>{error ? <Pressable accessibilityRole="button" onPress={retry} style={{ minHeight: 44, justifyContent: 'center' }}><NativeText style={{ color: colors.text }}>Retry font download</NativeText></Pressable> : null}</View>;
  return <SafeAreaProvider><StatusBar style="dark" /><DataProvider><Routes /></DataProvider></SafeAreaProvider>;
}

export default function RootLayout() { const [attempt, setAttempt] = React.useState(0); return <LoadedApp key={attempt} retry={() => setAttempt(n => n + 1)} />; }
