import React, { useState } from 'react';
import { Link } from 'expo-router';
import { Modal, Pressable, Text, View } from 'react-native';
import { Action, Card, FeatureButton, Feedback, Page } from '../src/components/ui';
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
  return <Page title="Settings & more"><Feedback /><TourHighlight id="more-main">
    <Action label="Replay app walkthrough" onPress={() => { walkthrough?.start(); router.replace('/'); }} />
    <Card>
      <Text style={{ fontWeight: '700', fontSize: 16 }}>Sample data</Text>
      <Text>{sampleDataExists ? 'Sample records have already been added to this profile.' : 'Add example paychecks, budgets, accounts, transactions, and savings goals so you can explore the app.'}</Text>
      {sampleDataNotice ? <Text>{sampleDataNotice}</Text> : null}
      {!sampleDataExists ? <Action label="Load sample data" onPress={() => setConfirmSampleData(true)} /> : null}
      {sampleDataExists ? <Action label="Delete all sample data" destructive onPress={() => setConfirmDeleteSampleData(true)} /> : null}
    </Card>
    <FeatureButton title="Budget categories" detail="Manage categories and paycheck allocations." href="/budget" />
    <FeatureButton title="Transactions" detail="Search, record, edit, and review activity." href="/transactions" />
    <FeatureButton title="Financial history" detail="Filter activity by date, paycheck, category, or account." href="/history" />
    {authConfigured && authUser ? <Action label="Sign out" onPress={() => { void signOut().catch(e => reportError(e instanceof Error ? e.message : 'Could not sign out.')); }} /> : null}
    {!authConfigured ? <Link href="/sign-in">Account setup</Link> : null}
  </TourHighlight>
  <Modal visible={confirmSampleData} transparent animationType="fade" onRequestClose={() => setConfirmSampleData(false)}>
    <Pressable onPress={() => setConfirmSampleData(false)} style={{ flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(0,0,0,0.32)' }}>
      <Pressable onPress={event => event.stopPropagation()} style={{ alignSelf: 'center', width: '100%', maxWidth: 370, padding: 17, borderWidth: 1, borderColor: '#dedede', borderRadius: 13, backgroundColor: '#fff', gap: 12 }}>
        <Text style={{ color: '#161616', fontSize: 18, fontWeight: '700' }}>Load sample data?</Text>
        <Text style={{ color: '#333', lineHeight: 20 }}>This adds connected example records to {authConfigured ? 'your signed-in profile' : 'this device'} without replacing your existing records. {authConfigured ? 'The sample data will sync with your account.' : ''}</Text>
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
          <Action label="Cancel" onPress={() => setConfirmSampleData(false)} />
          <Action label={loadingSamples ? 'Loading…' : 'Add sample data'} variant="primary" onPress={() => void addSampleData()} />
        </View>
      </Pressable>
    </Pressable>
  </Modal>
  <Modal visible={confirmDeleteSampleData} transparent animationType="fade" onRequestClose={() => setConfirmDeleteSampleData(false)}>
    <Pressable onPress={() => setConfirmDeleteSampleData(false)} style={{ flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(0,0,0,0.32)' }}>
      <Pressable onPress={event => event.stopPropagation()} style={{ alignSelf: 'center', width: '100%', maxWidth: 370, padding: 17, borderWidth: 1, borderColor: '#dedede', borderRadius: 13, backgroundColor: '#fff', gap: 12 }}>
        <Text style={{ color: '#161616', fontSize: 18, fontWeight: '700' }}>Delete all sample data?</Text>
        <Text style={{ color: '#333', lineHeight: 20 }}>This removes the sample accounts, paychecks, budgets, transactions, goals, and contributions from {authConfigured ? 'your signed-in profile' : 'this device'}. Your other records are kept. Deletion is blocked if one of your records depends on sample data.</Text>
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
          <Action label="Cancel" onPress={() => setConfirmDeleteSampleData(false)} />
          <Action label={deletingSamples ? 'Deleting…' : 'Delete sample data'} variant="primary" destructive onPress={() => void removeSampleRecords()} />
        </View>
      </Pressable>
    </Pressable>
  </Modal>
  </Page>;
}
