import React from 'react';
import { Redirect, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const samples = [
  'scuttle',
  'make every paycheck count.',
  'Good morning!',
  'Available to Spend',
  '$1,842.00',
  'Your money has a plan.',
];
const fonts = [
  { source: require('../assets/fonts/coastal-musk/CoastalMusk.ttf'), name: 'Coastal Musk', family: 'Coastal Musk', note: 'Regular · 400. Personal-use demo; permission for this study confirmed by you.' },
  { source: require('../assets/fonts/mayonice/Mayonice.ttf'), name: 'Mayonice', family: 'Mayonice', note: 'Regular · 400. Supplied note permits personal and commercial use.' },
  { source: require('../assets/fonts/playful-lines/PlayfulLines.otf'), name: 'Playful Lines', family: 'Playful Lines', note: 'Regular · 400. Personal-use license; permission for this study confirmed by you.' },
  { source: require('../assets/fonts/stay-playful/StayPlayful.ttf'), name: 'Stay Playful', family: 'Stay Playful', note: 'Regular · 400. No license in archive; permission for this study confirmed by you.' },
] as const;

// This route and its entry point are development-only. Fonts have no global roles.
export default function TypographyPreview() {
  if (!__DEV__) return <Redirect href="/welcome" />;
  return <Preview />;
}

function Preview() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return <View style={styles.page}>
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/welcome')} style={styles.back}>
        <Text style={styles.label}>‹ Back to Scuttle</Text>
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>Typography Preview</Text>
      <Text style={styles.label}>Human-only design · development preview</Text>
      <Text style={styles.body}>Each approved font uses the same six samples at the same size. No typography roles have been assigned. Only supplied regular faces are used; no synthetic bold or italic.</Text>
      <View style={styles.swatches} accessibilityLabel="Scuttle preview palette">
        {['#FAF9F6', '#344447', '#8FB3C0', '#DCE7DA', '#D58A71'].map(color => <View key={color} style={[styles.swatch, { backgroundColor: color }]} />)}
      </View>
      {fonts.map(font => <FontCard key={font.family} font={font} />)}
      <Text style={styles.body}>After reviewing, choose fonts for: wordmark, page headings, section headings, body text, financial figures, and mascot messages.</Text>
    </ScrollView>
  </View>;
}

function FontCard({ font }: { font: typeof fonts[number] }) {
  const [attempt, setAttempt] = React.useState(0);
  return <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.fontName}>{font.name}</Text>
    <Text style={styles.body}>{font.note}</Text>
    <FontSamples key={attempt} font={font} retry={() => setAttempt(value => value + 1)} />
  </View>;
}

function FontSamples({ font, retry }: { font: typeof fonts[number]; retry: () => void }) {
  const [loaded, error] = useFonts({ [font.family]: font.source });
  if (error) return <View style={{ gap: 12 }}>
    <Text accessibilityRole="alert" style={styles.body}>{font.name} could not download from the Expo server. Check that your phone can reach your Mac, then retry.</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Retry loading ${font.name}`} onPress={retry} style={styles.back}><Text style={styles.label}>Retry font download</Text></Pressable>
  </View>;
  if (!loaded) return <View accessibilityRole="progressbar" accessibilityLabel={`Loading ${font.name}`}><ActivityIndicator color="#344447" /><Text style={styles.body}>Loading font…</Text></View>;
  return <>{samples.map(sample => <Text key={sample} selectable style={[styles.sample, { fontFamily: font.family }]}>{sample}</Text>)}</>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FAF9F6' },
  content: { paddingHorizontal: 20, gap: 16, width: '100%', maxWidth: 720, alignSelf: 'center' },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingRight: 16 },
  title: { color: '#344447', fontSize: 26, fontWeight: '600' },
  label: { color: '#344447', fontSize: 16 },
  body: { color: '#344447', fontSize: 15, lineHeight: 23 },
  swatches: { flexDirection: 'row', gap: 12 },
  swatch: { width: 32, height: 32, borderWidth: 1, borderColor: '#E9E7E2', borderRadius: 6 },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9E7E2', borderRadius: 10, padding: 16, gap: 14 },
  fontName: { color: '#344447', fontSize: 20, fontWeight: '600' },
  sample: { color: '#344447', fontSize: 28, paddingVertical: 8 },
});
