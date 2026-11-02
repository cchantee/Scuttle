import React from 'react';
import { Text } from 'react-native';
import { Action, Card, Feedback, Page } from '../src/components/ui';
import { useData } from '../src/state/DataProvider';

export default function Profile() {
  const { data, authConfigured, authUser, signOut, reportError } = useData();
  const name = authUser?.displayName || data.user.displayName || 'User';
  return <Page title="Profile">
    <Feedback />
    <Card>
      <Text style={{ fontWeight: '700', fontSize: 18, color: '#171717' }}>{name}</Text>
      {authUser?.email ? <Text style={{ color: '#626262' }}>{authUser.email}</Text> : null}
      <Text style={{ color: '#626262' }}>{authConfigured ? 'Scuttle account' : 'Local profile'}</Text>
    </Card>
    {authConfigured && authUser ? <Action label="Sign out" fullWidth onPress={() => { void signOut().catch(e => reportError(e instanceof Error ? e.message : 'Could not sign out.')); }} /> : <Text style={{ color: '#626262' }}>Cloud sign-in is not configured.</Text>}
  </Page>;
}
