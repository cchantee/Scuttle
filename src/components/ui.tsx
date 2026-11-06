import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Link, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '../state/DataProvider';
import { normalizeDateInput, todayDateInput } from '../domain/date';
import { AccountType, newId } from '../domain/models';
import { parseMoney } from '../domain/money';
import { TourHighlight, walkthroughSteps, WalkthroughOverlay, useWalkthrough } from './walkthrough';
import { Text } from '../design/Text';
import { colors } from '../design/theme';
import { useSavedFeedback } from './saveFeedback';
import { Eyebrow, Wordmark } from './brand';

const ink = colors.text;
const muted = colors.muted;
const line = colors.border;
const surface = colors.surface;
const canvas = colors.paper;
const tabs = [
  { label: 'Home', mark: '⌂', href: '/' }, { label: 'Budget', mark: '▦', href: '/budget' },
  { label: 'Add', mark: '+', href: '/transaction/new' }, { label: 'Activity', mark: '⇄', href: '/history' },
  { label: 'More', mark: '☰', href: '/more' },
] as const;

function BottomNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [addMenuOpen, setAddMenuOpen] = React.useState(false);
  const walkthrough = useWalkthrough();
  const tourAddMenuOpen = Boolean(pathname === '/' && walkthrough?.active && walkthroughSteps[walkthrough.index]?.target === 'nav-add');
  React.useEffect(() => { if (tourAddMenuOpen) setAddMenuOpen(true); else if (walkthrough?.active) setAddMenuOpen(false); }, [tourAddMenuOpen, walkthrough?.active]);
  const addMenuVisible = addMenuOpen || tourAddMenuOpen;
  const choose = (type: 'expense' | 'income' | 'transfer' | 'paycheck') => {
    setAddMenuOpen(false);
    if (type === 'paycheck') router.push({ pathname: '/paychecks', params: { add: '1' } });
    else router.push({ pathname: '/transaction/new', params: { type } });
  };
  return <View style={{ borderTopWidth: 1, borderColor: line, backgroundColor: surface, paddingBottom: Math.max(insets.bottom, 10) }}>
    <View accessibilityRole="tablist" style={{ width: '100%', maxWidth: 680, alignSelf: 'center', flexDirection: 'row', paddingTop: 9 }}>
      {tabs.map(tab => {
        const more = ['/accounts', '/account/', '/goals', '/goal/', '/profile', '/more'];
        const active = tab.href === '/' ? pathname === '/' : tab.label === 'Budget' ? ['/budget', '/paycheck', '/allocation'].some(p => pathname.startsWith(p)) : tab.label === 'Activity' ? ['/history', '/transactions'].includes(pathname) : tab.label === 'More' ? more.some(p => pathname.startsWith(p)) : false;
        return <View key={tab.label} style={{ flex: 1 }}><TourHighlight id={`nav-${tab.label.toLowerCase()}`}><Pressable accessibilityRole={tab.label === 'Add' ? 'button' : 'tab'} accessibilityLabel={tab.label} aria-selected={tab.label === 'Add' ? undefined : active} accessibilityState={tab.label === 'Add' ? { expanded: addMenuVisible } : { selected: active }} onPress={() => tab.label === 'Add' ? setAddMenuOpen(!addMenuOpen) : router.replace(tab.href)} style={({ pressed }) => ({ minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 16, backgroundColor: pressed ? colors.pressed : 'transparent' })}>
          <View style={{ minWidth: 40, minHeight: 30, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: tab.label === 'Add' ? colors.evergreen : active ? colors.subtle : 'transparent' }}><Text style={{ color: tab.label === 'Add' ? colors.lime : active ? colors.teal : muted, fontSize: 24, lineHeight: 30, fontWeight: '600' }}>{tab.mark}</Text></View>
          <Text style={{ fontSize: 11, lineHeight: 17, color: active ? colors.teal : muted, fontWeight: active ? '800' : '500' }}>{tab.label}</Text>
        </Pressable></TourHighlight></View>;
      })}
    </View>
    <Modal visible={addMenuVisible} transparent animationType="slide" onRequestClose={() => setAddMenuOpen(false)}>
      <Pressable accessibilityLabel="Dismiss add menu" onPress={() => setAddMenuOpen(false)} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim }}>
        <Pressable accessibilityViewIsModal onPress={e => e.stopPropagation()} style={{ maxHeight: '90%', padding: 24, paddingBottom: Math.max(insets.bottom, 24), gap: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28, width: '100%', maxWidth: 680, alignSelf: 'center', backgroundColor: canvas }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10 }}><Eyebrow>Make your next move</Eyebrow><Text style={{ fontSize: 27, lineHeight: 35, fontWeight: '800' }}>What would you like to add?</Text>
          {([{ type: 'paycheck', mark: '▣', title: 'Paycheck', detail: 'Add pay and budget it' }, { type: 'expense', mark: '↗', title: 'Expense', detail: 'Record a purchase' }, { type: 'transfer', mark: '⇄', title: 'Transfer', detail: 'Move money or pay a credit card' }, { type: 'income', mark: '↙', title: 'Income', detail: 'Record other income without a paycheck plan' }] as const).map(item => <Pressable key={item.type} accessibilityRole="button" accessibilityLabel={`Add ${item.title}`} onPress={() => choose(item.type)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 15, minHeight: 64, borderRadius: 17, backgroundColor: pressed ? colors.pressed : surface })}><Text style={{ color: colors.teal, fontSize: 25 }}>{item.mark}</Text><View style={{ flex: 1 }}><Text style={{ fontWeight: '700' }}>{item.title}</Text><Text style={{ color: muted, fontSize: 13 }}>{item.detail}</Text></View><Text>›</Text></Pressable>)}
          <Action label="Cancel" fullWidth onPress={() => setAddMenuOpen(false)} /></ScrollView>
        </Pressable>
      </Pressable>
      {tourAddMenuOpen ? <WalkthroughOverlay insideAddMenu /> : null}
    </Modal>
  </View>;
}

export const Page = ({ title, children, showTabs = true, headerRight, footer, showSavedNotice = true }: React.PropsWithChildren<{ title: string; showTabs?: boolean; headerRight?: React.ReactNode; footer?: React.ReactNode; showSavedNotice?: boolean }>) => {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loading, authLoading } = useData();
  const saved = useSavedFeedback();
  const showBack = !['/', '/welcome', '/budget', '/history', '/more'].includes(pathname);
  const backHref = pathname.startsWith('/account/') ? '/accounts' : pathname.startsWith('/allocation/') ? '/budget' : pathname.startsWith('/paycheck/') ? '/paychecks' : pathname.startsWith('/goal/') ? '/goals' : pathname.startsWith('/transaction/') ? '/transactions' : pathname === '/sign-in' || pathname === '/sign-up' ? '/welcome' : '/';
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: canvas }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 22, paddingTop: insets.top + 18, paddingBottom: 32, gap: 16 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
        <View style={{ flex: 1, gap: 8 }}>{showBack ? <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace(backHref)} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}><Text style={{ color: colors.teal, fontWeight: '700' }}>‹  Back</Text></Pressable> : pathname === '/' || pathname === '/welcome' ? <Wordmark /> : null}
          {pathname !== '/welcome' ? <Text accessibilityRole="header" style={{ fontSize: 29, lineHeight: 37, fontWeight: '800', letterSpacing: -1 }}>{title}</Text> : null}</View>{headerRight}
      </View>
      {loading || authLoading ? <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, backgroundColor: colors.subtle, borderRadius: 16 }}><ActivityIndicator color={colors.teal} /><Text>Loading your records…</Text></View> : null}
      {children}
    </ScrollView>
    {footer ? <View style={{ backgroundColor: surface, borderTopWidth: 1, borderColor: line, padding: 16, paddingBottom: showTabs ? 16 : Math.max(insets.bottom, 16) }}><View style={{ width: '100%', maxWidth: 676, alignSelf: 'center', gap: 10 }}>{footer}</View></View> : null}
    {saved && showSavedNotice ? <View accessibilityLiveRegion="polite" style={{ padding: 12, backgroundColor: colors.lime }}><Text style={{ textAlign: 'center', fontWeight: '700' }}>✓ Changes saved{showTabs ? '' : ' successfully'}</Text></View> : null}
    {showTabs ? <BottomNavigation /> : null}<WalkthroughOverlay />
  </KeyboardAvoidingView>;
};

export const SectionTitle = ({ children, right }: React.PropsWithChildren<{ right?: React.ReactNode }>) => <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginTop: 12 }}><Text style={{ fontSize: 19, fontWeight: '800', color: ink, flexShrink: 1 }}>{children}</Text>{right}</View>;

export const Card = ({ children, style }: React.PropsWithChildren<{ style?: object }>) => <View style={[{ borderWidth: 1, borderColor: line, borderRadius: 22, padding: 18, gap: 10, backgroundColor: surface }, style]}>{children}</View>;

export const ProgressBar = ({ value, max }: { value: number; max: number }) => {
  const progress = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return <View accessibilityLabel={value > max ? "Over assigned amount" : "Progress"} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} style={{ height: 8, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.border }}><View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: value > max ? colors.danger : colors.teal, borderRadius: 8 }} /></View>;
};

export const Field = ({ label, value, onChangeText, placeholder, keyboardType = 'default', multiline = false, secureTextEntry = false, autoCapitalize = 'sentences', error, hint }: { error?: string; hint?: string; label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'email-address'; multiline?: boolean; secureTextEntry?: boolean; autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters' }) => {
  const [showPassword, setShowPassword] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  return <View style={{ gap: 5 }}>
    <Text style={{ color: ink, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: error ? colors.danger : focused ? colors.focus : line, borderRadius: 14, paddingRight: secureTextEntry ? 6 : 0, backgroundColor: surface }}>
      <TextInput accessibilityLabel={label} aria-invalid={Boolean(error)} value={value} onChangeText={onChangeText} placeholder={placeholder} keyboardType={keyboardType} multiline={multiline} secureTextEntry={secureTextEntry && !showPassword} autoCapitalize={autoCapitalize} placeholderTextColor={muted} selectionColor={colors.teal} onFocus={() => setFocused(true)} onBlur={() => { setShowPassword(false); setFocused(false); }} style={{ flex: 1, color: ink, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12, minHeight: multiline ? 96 : 50 }} />
      {secureTextEntry ? <Pressable accessibilityRole="button" accessibilityLabel="Hold to show password" accessibilityHint="Password is hidden again when you release" onPressIn={() => setShowPassword(true)} onPressOut={() => setShowPassword(false)} style={{ minWidth: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 21, height: 14, borderWidth: 1.6, borderColor: ink, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ink }} /></View></Pressable> : null}
    </View>
    {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : hint ? <Text style={{ color: muted, fontSize: 13 }}>{hint}</Text> : null}
  </View>;
};

export const DateField = ({ label, value, onChangeText, optional = false }: { label: string; value: string; onChangeText: (value: string) => void; optional?: boolean }) => {
  const { data } = useData();
  const [open, setOpen] = React.useState(false);
  const [visibleMonth, setVisibleMonth] = React.useState(() => {
    const selected = normalizeDateInput(value) ?? normalizeDateInput(todayDateInput(data.user))!;
    const [year, month] = selected.split('-').map(Number);
    return new Date(year, month - 1, 1);
  });
  const selected = normalizeDateInput(value);
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const offset = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - offset + 1;
    return day > 0 && day <= count ? day : null;
  });
  const changeMonth = (amount: number) => setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  const openCalendar = () => {
    const iso = selected ?? normalizeDateInput(todayDateInput(data.user))!;
    const [selectedYear, selectedMonth] = iso.split('-').map(Number);
    setVisibleMonth(new Date(selectedYear, selectedMonth - 1, 1));
    setOpen(true);
  };
  const chooseDay = (day: number) => {
    onChangeText(`${month + 1}/${day}/${year}`);
    setOpen(false);
  };
  return <View style={{ gap: 5 }}>
    <Text style={{ color: ink, fontSize: 13, fontWeight: '700' }}>{label}{optional ? ' (optional)' : ''}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder="M/D/YYYY" keyboardType="numbers-and-punctuation" placeholderTextColor={muted} selectionColor={colors.teal} style={{ flex: 1, color: ink, borderWidth: 1, borderColor: line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, minHeight: 48, backgroundColor: surface }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Choose date from calendar" onPress={openCalendar} style={({ pressed }) => ({ width: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: line, backgroundColor: pressed ? colors.pressed : surface })}><Text style={{ fontSize: 19, color: ink }}>▦</Text></Pressable>
    </View>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <Pressable onPress={() => setOpen(false)} style={{ flex: 1, justifyContent: 'center', padding: 22, backgroundColor: colors.scrim }}>
        <Pressable onPress={event => event.stopPropagation()} style={{ alignSelf: 'flex-end', width: '100%', maxWidth: 370, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: line, backgroundColor: surface, gap: 13 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable accessibilityRole="button" style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Previous month" onPress={() => changeMonth(-1)} hitSlop={8}><Text style={{ fontSize: 22, color: ink }}>‹</Text></Pressable>
            <Text style={{ fontSize: 19, fontWeight: '800', color: ink }}>{visibleMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</Text>
            <Pressable accessibilityRole="button" style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Next month" onPress={() => changeMonth(1)} hitSlop={8}><Text style={{ fontSize: 22, color: ink }}>›</Text></Pressable>
          </View>
          <View style={{ flexDirection: 'row' }}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={{ width: `${100 / 7}%`, textAlign: 'center', color: muted, fontWeight: '600' }}>{day}</Text>)}</View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{cells.map((day, index) => {
            const iso = day ? `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}` : '';
            const active = Boolean(day && iso === selected);
            return <View key={index} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 2 }}>{day ? <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => chooseDay(day)} style={({ pressed }) => ({ width: 40, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: active ? colors.teal : pressed ? colors.pressed : 'transparent' })}><Text style={{ color: active ? colors.onPrimary : ink, fontWeight: active ? '700' : '400' }}>{day}</Text></Pressable> : <View style={{ width: 40, minHeight: 44 }} />}</View>;
          })}</View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Pressable onPress={() => { onChangeText(todayDateInput(data.user)); setOpen(false); }}><Text style={{ color: ink, fontWeight: '600' }}>Today</Text></Pressable>
            <Pressable onPress={() => setOpen(false)}><Text style={{ color: ink }}>Done</Text></Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  </View>;
};

export const Action = ({ label, onPress, destructive = false, variant = 'secondary', fullWidth = false, disabled = false, accessibilityLabel, selected }: { selected?: boolean; accessibilityLabel?: string; label: string; onPress: () => unknown; destructive?: boolean; variant?: 'primary' | 'secondary' | 'text'; fullWidth?: boolean; disabled?: boolean }) => {
  const [busy, setBusy] = React.useState(false);
  const busyRef = React.useRef(false);
  const { reportError } = useData();
  const act = async () => {
    if (busyRef.current || disabled) return;
    busyRef.current = true;
    try { const result = onPress(); if (result && typeof (result as Promise<unknown>).then === 'function') { setBusy(true); await result; } }
    catch (error) { reportError(error instanceof Error ? error.message : 'Could not complete this action. Try again.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  return <Pressable onPress={() => void act()} disabled={busy || disabled} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} aria-disabled={busy || disabled} aria-busy={busy} aria-pressed={selected} accessibilityState={{ disabled: busy || disabled, busy, selected }} style={({ pressed }) => ({ borderWidth: variant === 'text' ? 0 : 1, borderColor: destructive ? colors.danger : variant === 'primary' ? colors.teal : line, borderRadius: 14, minHeight: 48, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, alignSelf: fullWidth ? 'stretch' : 'flex-start', opacity: disabled ? 0.5 : 1, backgroundColor: destructive ? colors.dangerSurface : variant === 'primary' ? (pressed ? colors.evergreen : colors.teal) : variant === 'text' ? 'transparent' : pressed ? colors.pressed : colors.subtle })}><Text style={{ color: destructive ? colors.danger : variant === 'primary' ? colors.onPrimary : variant === 'text' ? colors.teal : ink, fontWeight: '700', textAlign: 'center' }}>{busy ? 'Saving…' : label}</Text></Pressable>;
};

function supportsAccountInterest(type: AccountType) { return type === 'savings' || type === 'high_yield_savings' || type === 'credit_card'; }

type FeatureRoute = '/profile' | '/more' | '/paychecks' | '/budget' | '/transactions' | '/accounts' | '/goals' | '/history';
export const FeatureButton = ({ title, detail, href }: { title: string; detail: string; href: FeatureRoute }) => <Link href={href} asChild><Pressable accessibilityRole="button" style={({ pressed }) => ({ borderWidth: 1, borderColor: line, borderRadius: 18, padding: 18, gap: 5, backgroundColor: pressed ? colors.pressed : surface })}><Text style={{ color: ink, fontWeight: '700', fontSize: 15 }}>{title}</Text><Text style={{ color: muted, fontSize: 13 }}>{detail}</Text></Pressable></Link>;

/** Whole-row access plus contextual actions keeps financial lists scannable. */
export const RecordLine = ({ title, detail, onEdit, onDelete, onView, progress, amount, tone = 'default' }: { title: string; detail: string; onEdit: () => void; onDelete: () => void; onView?: () => void; viewLabel?: string; progress?: { value: number; max: number; label?: string }; amount?: string; tone?: 'default' | 'positive' | 'caution' }) => {
  const [menu, setMenu] = React.useState(false);
  return <Card style={{ padding: 16, gap: 10 }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${title}`} onPress={onView ?? onEdit} style={{ flex: 1, minHeight: 48, gap: 4 }}>
        <Text style={{ color: ink, fontWeight: '700', fontSize: 16 }}>{title}</Text>
        {amount ? <Text style={{ fontWeight: '800', fontSize: 21, lineHeight: 29, color: tone === 'positive' ? colors.teal : tone === 'caution' ? colors.danger : ink, fontVariant: ['tabular-nums'] }}>{amount}</Text> : null}
        <Text style={{ color: muted, fontSize: 13, lineHeight: 20 }}>{detail}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Actions for ${title}`} aria-expanded={menu} onPress={() => setMenu(true)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.subtle }}><Text style={{ fontSize: 22 }}>⋯</Text></Pressable>
    </View>
    {progress ? <><ProgressBar value={progress.value} max={progress.max} /><Text style={{ color: progress.value > progress.max ? colors.danger : muted, fontSize: 12 }}>{progress.label ?? `${progress.max ? Math.round(progress.value / progress.max * 100) : 0}%`}</Text></> : null}
    <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}><Pressable onPress={() => setMenu(false)} style={{ flex: 1, justifyContent: 'center', padding: 22, backgroundColor: colors.scrim }}><Pressable accessibilityViewIsModal onPress={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, alignSelf: 'center', backgroundColor: surface, padding: 22, gap: 12, borderRadius: 24 }}><Text style={{ fontSize: 21, fontWeight: '700' }}>{title}</Text><Action label="Edit" fullWidth onPress={() => { setMenu(false); onEdit(); }} /><Action label="Delete record…" destructive fullWidth onPress={() => { setMenu(false); onDelete(); }} /><Action label="Cancel" variant="text" fullWidth onPress={() => setMenu(false)} /></Pressable></Pressable></Modal>
  </Card>;
};

export function Disclosure({ title, children, initiallyOpen = false }: React.PropsWithChildren<{ title: string; initiallyOpen?: boolean }>) {
  const [open, setOpen] = React.useState(initiallyOpen);
  return <View style={{ gap: 12 }}><Pressable accessibilityRole="button" accessibilityLabel={title} aria-expanded={open} accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: line, gap: 12 }}><Text style={{ fontWeight: '700' }}>{title}</Text><Text style={{ color: colors.teal }}>{open ? '−' : '+'}</Text></Pressable>{open ? children : null}</View>;
}

export const SelectId = ({ label, choices, value, onChange, create }: { label: string; choices: { id: string; title: string }[]; value: string; onChange: (id: string) => void; create?: 'category' | 'account' }) => {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [accountType, setAccountType] = React.useState<AccountType>('checking');
  const [balance, setBalance] = React.useState('0.00');
  const [interestRate, setInterestRate] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [createError, setCreateError] = React.useState('');
  const { saveRecord } = useData();
  const selected = choices.find(choice => choice.id === value);
  const startCreate = () => { setName(''); setAccountType('checking'); setBalance('0.00'); setInterestRate(''); setNotes(''); setCreateError(''); setCreateOpen(true); };
  const createRecord = async () => {
    const cleanName = name.trim();
    if (!cleanName) { setCreateError(create === 'account' ? 'Enter an account name.' : 'Enter a category name.'); return; }
    let id = newId();
    let saved = false;
    try {
      if (create === 'account') saved = await saveRecord('accounts', { id, name: cleanName, type: accountType, initialBalanceCents: parseMoney(balance), interestRatePercent: supportsAccountInterest(accountType) && interestRate.trim() !== '' ? Number(interestRate) : undefined, notes: notes.trim() || undefined });
      else if (create === 'category') saved = await saveRecord('categories', { id, name: cleanName });
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Could not create this item.');
      return;
    }
    if (!saved) { setCreateError('Could not create this item. Check the message on the screen and try again.'); return; }
    onChange(id); setOpen(false); setCreateOpen(false);
  };
  const accountTypes: { id: AccountType; title: string }[] = [
    { id: 'checking', title: 'Checking' }, { id: 'savings', title: 'Savings' },
    { id: 'high_yield_savings', title: 'High-yield savings' }, { id: 'cash', title: 'Cash' },
    { id: 'credit_card', title: 'Credit card' },
  ];
  return <View style={{ gap: 5 }}><Text style={{ color: ink, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    <Action fullWidth accessibilityLabel={`${label}: ${selected?.title ?? 'Choose'}`} label={`${selected?.title ?? 'Choose…'}   ⌄`} onPress={() => { setSearch(''); setOpen(true); }} />
    <Modal visible={open && !createOpen} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <Pressable onPress={() => setOpen(false)} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim }}>
        <Pressable accessibilityViewIsModal onPress={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 680, maxHeight: '85%', alignSelf: 'center', backgroundColor: canvas, padding: 22, borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: 12 }}>
          <Text accessibilityRole="header" style={{ fontWeight: '800', fontSize: 22 }}>{label}</Text>
          {choices.length > 5 ? <Field label={`Search ${label.toLowerCase()}`} value={search} onChangeText={setSearch} placeholder="Type a name" /> : null}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6, paddingBottom: 12 }}>
            {choices.filter(choice => choice.title.toLowerCase().includes(search.trim().toLowerCase())).map(choice => <Pressable key={choice.id} accessibilityRole="button" accessibilityLabel={choice.title} accessibilityState={{ selected: value === choice.id }} aria-selected={value === choice.id} onPress={() => { onChange(choice.id); setOpen(false); }} style={{ padding: 15, minHeight: 52, borderRadius: 14, backgroundColor: value === choice.id ? colors.lime : surface }}><Text style={{ color: ink }}>{value === choice.id ? '✓  ' : ''}{choice.title}</Text></Pressable>)}
            {choices.length === 0 ? <Text style={{ color: muted }}>No choices yet.{create ? ` Create a ${create} below.` : ''}</Text> : choices.filter(c => c.title.toLowerCase().includes(search.trim().toLowerCase())).length === 0 ? <Text style={{ color: muted }}>No matching choices.</Text> : null}
          </ScrollView>
          {create ? <Action label={`Create new ${create}`} fullWidth onPress={startCreate} /> : null}
          {value ? <Action label="Clear selection" variant="text" fullWidth onPress={() => { onChange(''); setOpen(false); }} /> : null}
          <Action label="Done" fullWidth onPress={() => setOpen(false)} />
        </Pressable>
      </Pressable>
    </Modal>
    {create ? <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
      <Pressable onPress={() => setCreateOpen(false)} style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: colors.scrim }}>
        <Pressable onPress={event => event.stopPropagation()} style={{ width: '100%', maxWidth: 400, maxHeight: '85%', alignSelf: 'center', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: line, backgroundColor: surface, gap: 10 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: ink }}>Create {create}</Text>
            <Field label={create === 'account' ? 'Account name' : 'Category name'} value={name} onChangeText={setName} />
            {create === 'account' ? <>
              <Text style={{ color: ink, fontSize: 13 }}>Account type</Text>
              {accountTypes.map(type => <Action key={type.id} label={`${accountType === type.id ? '✓ ' : ''}${type.title}`} onPress={() => setAccountType(type.id)} />)}
              <Field label={accountType === 'credit_card' ? 'Starting amount owed' : 'Starting account balance'} value={balance} onChangeText={setBalance} keyboardType="decimal-pad" />
              {supportsAccountInterest(accountType) ? <><Field label={accountType === 'credit_card' ? 'Interest rate (APR %, optional)' : 'Interest rate (APY %, optional)'} value={interestRate} onChangeText={setInterestRate} keyboardType="decimal-pad" placeholder="e.g. 4.25" /><Text style={{ color: muted, fontSize: 12 }}>Used for Scuttle’s interest estimate. Changes apply from today.</Text></> : null}
              <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
            </> : null}
            {createError ? <Text accessibilityRole="alert" style={{ color: ink }}>{createError}</Text> : null}
            <Action label={`Create ${create}`} variant="primary" fullWidth onPress={() => createRecord()} />
            <Action label="Cancel" onPress={() => setCreateOpen(false)} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal> : null}
  </View>;
};

export const Feedback = () => { const { error, clearError } = useData(); const connectionError = /network|fetch|offline|connection/i.test(error ?? ''); return <Modal visible={Boolean(error)} transparent animationType="fade" onRequestClose={clearError}>
  <View style={{ flex: 1, justifyContent: 'center', padding: 22, backgroundColor: colors.scrim }}>
    <View accessibilityRole="alert" style={{ width: '100%', maxWidth: 420, alignSelf: 'center', padding: 18, gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: surface }}>
      <Text style={{ color: ink, fontSize: 18, fontWeight: '700' }}>{connectionError ? 'Couldn’t reach cloud storage' : 'Let’s check that'}</Text>
      <Text style={{ color: colors.danger, lineHeight: 23 }}>{error}</Text>
      {connectionError ? <Text style={{ color: muted }}>Your change was not confirmed as saved. Check your connection, then return to the form and retry. Scuttle does not queue offline cloud changes.</Text> : null}
      <Action label="Return and try again" variant="primary" fullWidth onPress={clearError} />
    </View>
  </View>
</Modal>; };
export const LocalNotice = () => { const { authConfigured, authUser } = useData(); return <Text style={{ color: muted, fontSize: 12 }}>{authConfigured ? `Signed in${authUser?.email ? ` as ${authUser.email}` : ''}. Records sync to your account.` : 'Local device data. Cloud sync and sign-in are not configured.'}</Text>; };
