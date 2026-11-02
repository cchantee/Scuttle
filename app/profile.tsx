import { colors } from '../src/design/theme';
import React from 'react';
import { Text } from '../src/design/Text';
import { Action, Card, Feedback, Page } from '../src/components/ui';
import { useData } from '../src/state/DataProvider';

export default function Profile() {
  const { data, authConfigured, authUser, signOut, reportError } = useData();
  const name = authUser?.displayName || data.user.displayName || 'User';
  return <Page title="Profile">
    <Feedback />
    <Card>
      <Text style={{ fontWeight: '700', fontSize: 18, color: colors.text }}>{name}</Text>
      {authUser?.email ? <Text style={{ color: colors.muted }}>{authUser.email}</Text> : null}
      <Text style={{ color: colors.muted }}>{authConfigured ? 'Scuttle account' : 'Local profile'}</Text>
    </Card>
    {authConfigured && authUser ? <Action label="Sign out" fullWidth onPress={() => { void signOut().catch(e => reportError(e instanceof Error ? e.message : 'Could not sign out.')); }} /> : <Text style={{ color: colors.muted }}>Cloud sign-in is not configured.</Text>}
  </Page>;
}
