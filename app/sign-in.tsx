import { colors } from '../src/design/theme';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../src/design/Text';
import { Redirect, usePathname, useRouter } from 'expo-router';
import { Action, Feedback, Field, Page } from '../src/components/ui';
import { cloudConfigurationHelp } from '../src/backend/supabase';
import { useData } from '../src/state/DataProvider';

export default function SignIn() {
  const { authConfigured, authLoading, authUser, signIn, signUp, reportError } = useData();
  const pathname = usePathname();
  const router = useRouter();
  const registering = pathname === '/sign-up';
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);

  useEffect(() => { setMessage(''); setConfirmationPending(false); }, [pathname]);

  if (authConfigured && authUser && !authLoading) return <Redirect href={authUser.walkthroughNeeded ? { pathname: '/', params: { walkthrough: '1' } } : '/'} />;

  const submit = async () => {
    setMessage('');
    setBusy(true);
    try {
      if (registering) {
        if (!fullName.trim()) throw new Error('Enter your name.');
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        const created = await signUp(email, password, fullName);
        if (created.hasSession) {
          router.replace({ pathname: '/', params: { walkthrough: '1' } });
          return;
        }
        setConfirmationPending(true);
        setMessage('Account created. Confirm your email, then sign in to begin the Scuttle walkthrough.');
      } else {
        const result = await signIn(email, password);
        router.replace(result.walkthroughNeeded ? { pathname: '/', params: { walkthrough: '1' } } : '/');
      }
    } catch (error) {
      reportError(error instanceof Error ? error.message : 'Could not authenticate. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return <Page title={registering ? 'Create account' : 'Sign in'} showTabs={false}><Feedback />
    <Text style={{ color: colors.muted, fontSize: 17 }}>A little clarity, every payday.</Text>
    {authLoading ? <Text>Checking sign-in…</Text> : null}
    {!authConfigured ? <View style={{ gap: 8 }}>
      <Text>Cloud sign-in and cross-device sync need backend setup. Scuttle currently runs in local device mode.</Text>
      <Text>{cloudConfigurationHelp()}</Text>
    </View> : <>
      <Text>{registering ? 'Create an account to sync your financial records across devices.' : 'Sign in to access your saved financial records.'}</Text>
      {registering ? <Field label="Full name" value={fullName} onChangeText={setFullName} autoCapitalize="words" /> : null}
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
      {registering ? <Field label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" /> : null}
      <Action label={busy ? 'Please wait…' : registering ? 'Create account' : 'Sign in'} variant="primary" fullWidth disabled={busy} onPress={() => submit()} />
      <Action label={registering ? 'Already have an account? Sign in' : 'New to Scuttle? Create an account'} onPress={() => router.push(registering ? '/sign-in' : '/sign-up')} />
      {confirmationPending ? <Action label="Continue to sign in" onPress={() => router.replace('/sign-in')} /> : null}
      {message ? <Text accessibilityRole="alert">{message}</Text> : null}
    </>}
  </Page>;
}
