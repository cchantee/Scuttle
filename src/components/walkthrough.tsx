import { colors } from '../design/theme';
import React, { createContext, useContext, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../design/Text';
import { useRouter } from 'expo-router';
import { useData } from '../state/DataProvider';

const ink = colors.text;
const muted = colors.muted;
export const walkthroughSteps = [
  { route: '/', target: 'home-quick-views', title: 'Two different balances', body: 'Your category budget is what you planned to spend. Account balances reflect money you recorded in your accounts.', placement: 'bottom' },
  { route: '/', target: 'nav-add', title: 'One place to add activity', body: 'Add a paycheck, log spending or income, or record a transfer. Transfers are not expenses.', placement: 'top' },
  { route: '/paychecks', target: 'paychecks-main', title: 'Budget a paycheck in one pass', body: 'Add your pay, enter category and goal amounts together, and save one plan. Planned pay stays separate until you receive it.', placement: 'bottom' },
  { route: '/budget', target: 'nav-budget', title: 'Check spending at a glance', body: 'Review remaining category money. Planned and archived budgets have their own tabs.', placement: 'bottom' },
  { route: '/more', target: 'more-main', title: 'Accounts, goals, and settings', body: 'Open account balances, savings goals, and other tools here. You can replay this short tour at any time.', placement: 'bottom' },
];

type TourContextValue = { active: boolean; index: number; start: () => void; next: () => void; previous: () => void; finish: () => Promise<void> };
const TourContext = createContext<TourContextValue | null>(null);
export function WalkthroughProvider({ children }: React.PropsWithChildren) {
  const router = useRouter();
  const { authConfigured, authUser, completeWalkthrough, reportError } = useData();
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const goTo = (nextIndex: number) => {
    const step = walkthroughSteps[nextIndex];
    setIndex(nextIndex);
    router.replace(step.route as never);
  };
  const value = useMemo<TourContextValue>(() => ({
    active,
    index,
    start: () => { setIndex(0); setActive(true); router.replace('/' as never); },
    next: () => { if (index < walkthroughSteps.length - 1) goTo(index + 1); },
    previous: () => { if (index > 0) goTo(index - 1); },
    finish: async () => { if (authConfigured && authUser) await completeWalkthrough(); setActive(false); router.replace('/' as never); },
  }), [active, index, authConfigured, authUser, completeWalkthrough, reportError, router]);
  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}
export function useWalkthrough() { return useContext(TourContext); }

export function TourHighlight({ id, children }: React.PropsWithChildren<{ id: string }>) {
  const tour = useWalkthrough();
  const highlighted = Boolean(tour?.active && walkthroughSteps[tour.index]?.target === id);
  return <View style={highlighted ? { borderWidth: 3, borderColor: colors.teal, borderRadius: 14, padding: 5, backgroundColor: colors.surface, zIndex: 2, elevation: 8 } : { gap: 16 }}>{children}</View>;
}

export function WalkthroughOverlay() {
  const tour = useWalkthrough();
  const { reportError } = useData();
  if (!tour?.active) return null;
  const step = walkthroughSteps[tour.index];
  const isLast = tour.index === walkthroughSteps.length - 1;
  return <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: step.placement === 'top' ? 'flex-start' : 'flex-end', paddingHorizontal: 14, paddingTop: step.placement === 'top' ? 56 : 0, paddingBottom: step.placement === 'bottom' ? 94 : 0 }}>
    <View accessibilityRole="summary" style={{ padding: 15, gap: 9, borderWidth: 2, borderColor: ink, borderRadius: 12, backgroundColor: colors.surface, shadowColor: colors.text, shadowOpacity: 0.22, shadowRadius: 8, elevation: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><TourButton label="Skip tour" onPress={() => void tour.finish().catch(error => reportError(error instanceof Error ? error.message : 'Could not save walkthrough completion.'))} /><Text style={{ color: muted, fontSize: 12 }}>Step {tour.index + 1} of {walkthroughSteps.length}</Text></View>
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
  return <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 48, minWidth: 84, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: ink, borderRadius: 7, backgroundColor: primary ? ink : colors.surface }}><Text style={{ color: primary ? colors.surface : ink, fontWeight: '600' }}>{label}</Text></Pressable>;
}
