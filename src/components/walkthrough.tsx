import { colors } from '../design/theme';
import React, { createContext, useContext, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../design/Text';
import { useRouter } from 'expo-router';
import { useData } from '../state/DataProvider';

const ink = colors.text;
const muted = colors.muted;
export const walkthroughSteps = [
  { route: '/', target: 'nav-home', title: 'Home', body: 'Your paycheck plan and key updates live here.', placement: 'bottom' },
  { route: '/', target: 'home-quick-views', title: 'Quick views', body: 'Switch the summary between paychecks, accounts, and savings.', placement: 'bottom' },
  { route: '/', target: 'home-next-payday', title: 'Next payday', body: 'Set a date and pay schedule for your countdown.', placement: 'bottom' },
  { route: '/', target: 'nav-add', title: 'Add menu', body: 'The plus button opens shortcuts for expenses, income, transfers, and paychecks.', placement: 'top' },
  { route: '/accounts', target: 'accounts-main', title: 'Accounts', body: 'Track cash balances and credit card debt separately.', placement: 'bottom' },
  { route: '/paychecks', target: 'paychecks-main', title: 'Paychecks', body: 'Log income, then budget it across categories.', placement: 'bottom' },
  { route: '/budget', target: 'nav-budget', title: 'Budgets', body: 'Create categories and assign paycheck amounts.', placement: 'bottom' },
  { route: '/transaction/new', target: 'expense-main', title: 'Expenses', body: 'Log a purchase, then choose its category and account.', placement: 'bottom' },
  { route: '/goals', target: 'goals-main', title: 'Savings goals', body: 'Track goal progress with separate contributions.', placement: 'bottom' },
  { route: '/more', target: 'more-main', title: 'More tools', body: 'Find transactions and your financial history here.', placement: 'bottom' },
  { route: '/', target: 'home-quick-actions', title: 'Quick actions', body: 'Start common tasks from Home or the plus button.', placement: 'top' },
  { route: '/', target: 'home-active-budgets', title: 'Active budgets', body: 'See what remains in your current paycheck plan.', placement: 'top' },
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
      <Text style={{ color: muted, fontSize: 12 }}>Step {tour.index + 1} of {walkthroughSteps.length}</Text>
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
