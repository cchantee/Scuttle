import { SaveFeedbackProvider } from '../src/components/saveFeedback';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../src/design/theme';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DataProvider } from '../src/state/DataProvider';
import { useData } from '../src/state/DataProvider';
import { WalkthroughProvider } from '../src/components/walkthrough';

export const unstable_settings = { anchor: 'welcome' };

function Routes() {
  const { authConfigured, authUser } = useData();
  return <SaveFeedbackProvider><WalkthroughProvider><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
    <Stack.Screen name="welcome" />
    <Stack.Screen name="sign-in" options={{ title: 'Account' }} />
    <Stack.Screen name="sign-up" options={{ title: 'Create account' }} />
    <Stack.Protected guard={!authConfigured || Boolean(authUser)}>
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
  </Stack></WalkthroughProvider></SaveFeedbackProvider>;
}

export default function RootLayout() {
  return <SafeAreaProvider><DataProvider><Routes /></DataProvider></SafeAreaProvider>;
}
