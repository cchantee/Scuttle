import { Text } from './typography';
import React, { createContext, useContext, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter, useIsFocused } from 'expo-router';
import { useData } from '../state/DataProvider';

const ink = '#344447';
const muted = '#69777A';
export const walkthroughSteps = [
  { route: '/', target: 'home-quick-views', title: 'Your paycheck, at a glance', body: 'Open your current plan here. Older paychecks stay in the archive.', placement: 'bottom' },
  { route: '/', target: 'nav-add', title: 'Add something', body: 'Use + for a paycheck, transaction, or savings goal.', placement: 'top' },
  { route: '/paychecks', target: 'paychecks-main', title: 'Plan this paycheck', body: 'Give your current paycheck a plan. View older ones when you need them.', placement: 'bottom' },
  { route: '/accounts', target: 'nav-accounts', title: 'Your accounts', body: 'Check where your money is held.', placement: 'bottom' },
  { route: '/reminders', target: 'reminders-main', title: 'Bills & reminders', body: 'Find due dates here. Reminders also appear when you receive a paycheck.', placement: 'bottom' },
  { route: '/goals', target: 'nav-goals', title: 'Save for what matters', body: 'Track your goals here. You’re ready to explore.', placement: 'bottom' },
];

type TourContextValue = { active: boolean; dismissed: boolean; exit: () => void; index: number; start: () => void; next: () => void; previous: () => void; finish: () => Promise<void> };
const TourContext = createContext<TourContextValue | null>(null);
export function WalkthroughProvider({ children }: React.PropsWithChildren) {
  const router = useRouter();
  const { authConfigured, authUser, completeWalkthrough, reportError } = useData();
  const [active, setActive] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [index, setIndex] = useState(0);
  const goTo = (nextIndex: number) => {
    const step = walkthroughSteps[nextIndex];
    setIndex(nextIndex);
    router.replace(step.route as never);
  };
  const value = useMemo<TourContextValue>(() => ({
    active,
    dismissed,
    exit: () => { setDismissed(true); setActive(false); },
    index,
    start: () => { setDismissed(false); setIndex(0); setActive(true); router.replace('/' as never); },
    next: () => { if (index < walkthroughSteps.length - 1) goTo(index + 1); },
    previous: () => { if (index > 0) goTo(index - 1); },
    finish: async () => { if (authConfigured && authUser) await completeWalkthrough(); setActive(false); router.replace('/' as never); },
  }), [active, dismissed, index, authConfigured, authUser, completeWalkthrough, reportError, router]);
  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}
export function useWalkthrough() { return useContext(TourContext); }

export function TourHighlight({ id, children }: React.PropsWithChildren<{ id: string }>) {
  const tour = useWalkthrough();
  const highlighted = Boolean(tour?.active && walkthroughSteps[tour.index]?.target === id);
  return <View style={highlighted ? { borderWidth: 3, borderColor: '#344447', borderRadius: 14, padding: 5, backgroundColor: '#fff', zIndex: 2, elevation: 8 } : { gap: 16 }}>{children}</View>;
}

export function WalkthroughOverlay({ menuLayer = false }: { menuLayer?: boolean }) {
  const focused = useIsFocused();
  const tour = useWalkthrough();
  const { reportError } = useData();
  if (!tour?.active || !focused) return null;
  const step = walkthroughSteps[tour.index];
  const menuStep = step.target === 'nav-add' || step.target.startsWith('nav-add-');
  if (menuLayer !== menuStep) return null;
  const isLast = tour.index === walkthroughSteps.length - 1;
  return <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: step.placement === 'top' ? 'flex-start' : 'flex-end', paddingHorizontal: 14, paddingTop: step.placement === 'top' ? 56 : 0, paddingBottom: step.placement === 'bottom' ? 94 : 0 }}>
    <View accessibilityRole="summary" style={{ padding: 15, gap: 9, borderWidth: 2, borderColor: ink, borderRadius: 12, backgroundColor: '#fff', shadowColor: '#344447', shadowOpacity: 0.22, shadowRadius: 8, elevation: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Text style={{ color: muted, fontSize: 12 }}>Step {tour.index + 1} of {walkthroughSteps.length}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Exit walkthrough" onPress={tour.exit} hitSlop={4} style={({ pressed }) => ({ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 6, paddingHorizontal: 8, backgroundColor: pressed ? '#DCE7DA' : 'transparent' })}><Text style={{ color: muted, fontSize: 14 }}>Exit</Text></Pressable>
      </View>
      <Text style={{ color: ink, fontSize: 20, fontWeight: '700' }}>{step.title}</Text>
      <Text style={{ color: ink, fontSize: 15, lineHeight: 20 }}>{step.body}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
        {tour.index ? <TourButton label="Previous" onPress={tour.previous} /> : <View />}
        <TourButton label={isLast ? 'Finish' : 'Next'} primary onPress={() => isLast ? void tour.finish().catch(error => reportError(error instanceof Error ? error.message : 'Could not save walkthrough completion.')) : tour.next()} />
      </View>
    </View>
  </View>;
}
function TourButton({ label, onPress, primary = false }: { label: string; onPress: () => void; primary?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 40, minWidth: 84, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: ink, borderRadius: 7, backgroundColor: primary ? ink : '#fff' }}><Text style={{ color: primary ? '#fff' : ink, fontWeight: '600' }}>{label}</Text></Pressable>;
}
