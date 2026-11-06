import { Text } from './typography';
import React, { createContext, useContext, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter, useIsFocused } from 'expo-router';
import { useData } from '../state/DataProvider';

const ink = '#344447';
const muted = '#69777A';
export const walkthroughSteps = [
  { route: '/', target: 'nav-home', title: 'Home', body: 'Your paycheck plan and key updates live here.', placement: 'bottom' },
  { route: '/', target: 'home-quick-views', title: 'View Focus', body: 'Switch between your paycheck, account balances, and money set aside for goals, including labeled reservations.', placement: 'bottom' },
  { route: '/', target: 'home-next-payday', title: 'Next payday', body: 'Set a date and pay schedule for your countdown.', placement: 'bottom' },
  { route: '/', target: 'nav-add', title: 'Add menu', body: 'Use + to add transactions, plan paychecks, manage budgets, or fund goals.', placement: 'top' },
  { route: '/', target: 'nav-add-transaction', title: 'Add Transaction', body: 'Record spending or income with an amount, date, and account.', placement: 'top' },
  { route: '/', target: 'nav-add-paycheck', title: 'Add Paycheck', body: 'Plan upcoming pay or record a paycheck you have received.', placement: 'top' },
  { route: '/', target: 'nav-add-budget', title: 'Budget', body: 'Create categories, assign paycheck money, and plan upcoming bills.', placement: 'top' },
  { route: '/', target: 'nav-add-move', title: 'Move Money', body: 'Reassign unspent budget money to a category or goal without moving account funds.', placement: 'top' },
  { route: '/', target: 'nav-add-goal', title: 'Add to Goal', body: 'Choose a savings goal and add a contribution.', placement: 'top' },
  { route: '/accounts', target: 'nav-accounts', title: 'Accounts', body: 'Track cash balances and credit card debt separately.', placement: 'bottom' },
  { route: '/paychecks', target: 'paychecks-main', title: 'Paychecks', body: 'Log income, then budget it across categories.', placement: 'bottom' },
  { route: '/budget', target: 'budget-main', title: 'Budgets', body: 'Create categories and assign paycheck amounts.', placement: 'bottom' },
  { route: '/transaction/new', target: 'expense-main', title: 'Expenses', body: 'Log a purchase, then choose its category and account.', placement: 'bottom' },
  { route: '/goals', target: 'nav-goals', title: 'Savings goals', body: 'Track goal progress with separate contributions.', placement: 'bottom' },
  { route: '/more', target: 'more-main', title: 'More tools', body: 'Find transactions and your financial history here.', placement: 'bottom' },
  { route: '/', target: 'home-quick-actions', title: 'Quick navigation', body: 'At the bottom of Home, open Budget, Transactions, or History.', placement: 'top' },
  { route: '/', target: 'home-active-budgets', title: 'Active budgets', body: 'See what remains in your current paycheck plan.', placement: 'top' },
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
