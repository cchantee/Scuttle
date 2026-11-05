import { Text } from '../src/components/typography';
import React from 'react';

import { Action, Card, Feedback, Page } from '../src/components/ui';
import { useData } from '../src/state/DataProvider';

export default function Profile() {
  const { data, authConfigured, authUser, signOut, reportError } = useData();
  const name = authUser?.displayName || data.user.displayName || 'User';
  return <Page title="Profile">
    <Feedback />
    <Card>
      <Text style={{ fontWeight: '700', fontSize: 18, color: '#344447' }}>{name}</Text>
      {authUser?.email ? <Text style={{ color: '#69777A' }}>{authUser.email}</Text> : null}
      <Text style={{ color: '#69777A' }}>{authConfigured ? 'Scuttle account' : 'Local profile'}</Text>
    </Card>
    {authConfigured && authUser ? <Action label="Sign out" fullWidth onPress={() => { void signOut().catch(e => reportError(e instanceof Error ? e.message : 'Could not sign out.')); }} /> : <Text style={{ color: '#69777A' }}>Cloud sign-in is not configured.</Text>}
  </Page>;
}
