import { Icon, IconTile, IconName } from '../src/components/icons';
import { colors } from '../src/design/theme';
import { Text } from '../src/components/typography';
import React, { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Action, Card, Feedback, Page, SectionTitle } from '../src/components/ui';
import { useData } from '../src/state/DataProvider';
import { TourHighlight, useWalkthrough } from '../src/components/walkthrough';
import { useRouter } from 'expo-router';
import { hasSampleData } from '../src/domain/demoData';

export default function More() {
  const { data, authConfigured, authUser, signOut, reportError, loadSampleData, deleteSampleData } = useData();
  const walkthrough = useWalkthrough();
  const router = useRouter();
  const [confirmSampleData, setConfirmSampleData] = useState(false);
  const [confirmDeleteSampleData, setConfirmDeleteSampleData] = useState(false);
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [deletingSamples, setDeletingSamples] = useState(false);
  const [sampleToolsOpen, setSampleToolsOpen] = useState(false);
  const [sampleDataNotice, setSampleDataNotice] = useState('');
  const sampleDataExists = hasSampleData(data);
  const addSampleData = async () => {
    if (loadingSamples) return;
    setLoadingSamples(true);
    try {
      if (await loadSampleData()) router.replace('/');
    } finally { setConfirmSampleData(false); setLoadingSamples(false); }
  };
  const removeSampleRecords = async () => {
    if (deletingSamples) return;
    setDeletingSamples(true);
    try {
      if (await deleteSampleData()) setSampleDataNotice('All sample records were deleted.');
    } finally { setConfirmDeleteSampleData(false); setDeletingSamples(false); }
  };
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
      <SettingsRow icon="home" title="Replay walkthrough" detail="A quick tour of Scuttle" onPress={() => { walkthrough?.start(); router.replace('/'); }} />
      <SettingsRow icon="paycheck" title="Sample data" detail={sampleDataExists ? 'Example records are loaded' : 'Explore with example records'} expanded={sampleToolsOpen} onPress={() => setSampleToolsOpen(!sampleToolsOpen)} last />
      {sampleToolsOpen ? <View style={{ padding: 16, paddingTop: 0, gap: 12 }}>
        <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21 }}>{sampleDataExists ? 'Remove the example records when you are ready. Your own records are kept.' : 'Add example accounts, paychecks, budgets, and goals without replacing your records.'}</Text>
        {sampleDataNotice ? <Text accessibilityLiveRegion="polite" style={{ fontSize: 14 }}>{sampleDataNotice}</Text> : null}
        {sampleDataExists ? <Action label="Delete sample data" destructive onPress={() => setConfirmDeleteSampleData(true)} /> : <Action label="Load sample data" onPress={() => setConfirmSampleData(true)} />}
      </View> : null}
    </Card>
    {authConfigured && authUser ? <View style={{ alignSelf: 'center', paddingVertical: 8 }}><Action label="Sign out" destructive onPress={() => { void signOut().catch(e => reportError(e instanceof Error ? e.message : 'Could not sign out.')); }} /></View> : null}
  </TourHighlight>
  <Modal visible={confirmSampleData} transparent animationType="fade" onRequestClose={() => setConfirmSampleData(false)}>
    <Pressable onPress={() => setConfirmSampleData(false)} style={{ flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(0,0,0,0.32)' }}>
      <Pressable onPress={event => event.stopPropagation()} style={{ alignSelf: 'center', width: '100%', maxWidth: 370, padding: 17, borderWidth: 1, borderColor: '#E9E7E2', borderRadius: 13, backgroundColor: '#fff', gap: 12 }}>
        <Text style={{ color: '#344447', fontSize: 18, fontWeight: '700' }}>Load sample data?</Text>
        <Text style={{ color: '#344447', lineHeight: 20 }}>This adds connected example records to {authConfigured ? 'your signed-in profile' : 'this device'} without replacing your existing records. {authConfigured ? 'The sample data will sync with your account.' : ''}</Text>
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
          <Action label="Cancel" onPress={() => setConfirmSampleData(false)} />
          <Action label={loadingSamples ? 'Loading…' : 'Add sample data'} variant="primary" onPress={() => void addSampleData()} />
        </View>
      </Pressable>
    </Pressable>
  </Modal>
  <Modal visible={confirmDeleteSampleData} transparent animationType="fade" onRequestClose={() => setConfirmDeleteSampleData(false)}>
    <Pressable onPress={() => setConfirmDeleteSampleData(false)} style={{ flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(0,0,0,0.32)' }}>
      <Pressable onPress={event => event.stopPropagation()} style={{ alignSelf: 'center', width: '100%', maxWidth: 370, padding: 17, borderWidth: 1, borderColor: '#E9E7E2', borderRadius: 13, backgroundColor: '#fff', gap: 12 }}>
        <Text style={{ color: '#344447', fontSize: 18, fontWeight: '700' }}>Delete all sample data?</Text>
        <Text style={{ color: '#344447', lineHeight: 20 }}>This removes the sample accounts, paychecks, budgets, transactions, goals, and contributions from {authConfigured ? 'your signed-in profile' : 'this device'}. Your other records are kept. Deletion is blocked if one of your records depends on sample data.</Text>
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
          <Action label="Cancel" onPress={() => setConfirmDeleteSampleData(false)} />
          <Action label={deletingSamples ? 'Deleting…' : 'Delete sample data'} variant="primary" destructive onPress={() => void removeSampleRecords()} />
        </View>
      </Pressable>
    </Pressable>
  </Modal>
  </Page>;
}

function SettingsRow({ icon, title, detail, onPress, last = false, expanded }: { icon: IconName; title: string; detail: string; onPress: () => void; last?: boolean; expanded?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={expanded === undefined ? undefined : { expanded }} onPress={onPress} style={({ pressed }) => ({ minHeight: 76, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: last ? 0 : 1, borderColor: colors.border, borderRadius: 10, backgroundColor: pressed ? colors.glass : 'transparent' })}>
    <IconTile name={icon} tint={colors.glass} />
    <View style={{ flex: 1, gap: 4 }}><Text style={{ fontSize: 18 }}>{title}</Text><Text style={{ color: colors.muted, fontSize: 13 }}>{detail}</Text></View>
    {expanded === undefined ? <View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="back" size={16} /></View> : <Text style={{ color: colors.muted, fontSize: 19 }}>{expanded ? '⌃' : '⌄'}</Text>}
  </Pressable>;
}
