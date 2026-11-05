import Svg, { Circle } from 'react-native-svg';
import { Icon, IconTile, IconName } from './icons';
import { colors } from '../design/theme';
import { Text, TextInput } from './typography';
import React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Link, usePathname, useIsFocused } from 'expo-router';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '../state/DataProvider';
import { normalizeDateInput, todayDateInput } from '../domain/date';
import { AccountType, newId } from '../domain/models';
import { parseMoney } from '../domain/money';
import { TourHighlight, walkthroughSteps, WalkthroughOverlay, useWalkthrough } from './walkthrough';

const ink = '#344447';
const muted = '#69777A';
const line = '#E9E7E2';
const surface = '#fff';
const canvas = '#FAF9F6';
const tabs = [
  { label: 'Home', icon: 'home', href: '/' },
  { label: 'Accounts', icon: 'accounts', href: '/accounts' },
  { label: 'Add', icon: 'plus', href: '/transaction/new' },
  { label: 'Paycheck', icon: 'paycheck', href: '/paychecks' },
  { label: 'Goals', icon: 'goals', href: '/goals' },
] as const;

function BottomNavigation() {
  const focused = useIsFocused();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = React.useState(false);
  const walkthrough = useWalkthrough();
  const tourTarget = walkthrough?.active ? walkthroughSteps[walkthrough.index]?.target : undefined;
  const tourMenu = Boolean(focused && pathname === '/' && (tourTarget === 'nav-add' || tourTarget?.startsWith('nav-add-')));
  const visible = focused && (open || tourMenu);
  React.useEffect(() => { if (walkthrough?.active) setOpen(false); }, [walkthrough?.active, walkthrough?.index]);
  React.useEffect(() => setOpen(false), [pathname]);
  const choose = (action: 'transaction' | 'paycheck' | 'budget' | 'move' | 'goal') => {
    if (tourMenu) return;
    setOpen(false);
    if (action === 'transaction') router.push('/transaction/new');
    if (action === 'paycheck') router.push({ pathname: '/paychecks', params: { add: '1' } });
    if (action === 'budget') router.push('/budget');
    if (action === 'move') router.push('/move-money');
    if (action === 'goal') router.push('/add-to-goal');
  };
  return <View style={{ backgroundColor: canvas, borderTopWidth: 1, borderColor: line }}>
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8, paddingBottom: Math.max(insets.bottom, 10), backgroundColor: canvas }}>
      {tabs.map(tab => {
        const add = tab.label === 'Add';
        const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href) || (tab.label === 'Paycheck' && pathname.startsWith('/paycheck/'));
        return <TourHighlight key={tab.label} id={`nav-${tab.label.toLowerCase()}`}><Pressable
          accessibilityRole={add ? 'button' : 'tab'} accessibilityLabel={add ? 'Quick actions' : tab.label}
          accessibilityState={add ? { expanded: visible } : { selected: active }}
          onPress={() => add ? setOpen(!open) : router.replace(tab.href)}
          style={({ pressed }) => ({ minWidth: 58, minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 4, opacity: pressed ? .65 : 1 })}>
          <View style={{ width: add ? 46 : 34, height: add ? 46 : 28, borderRadius: add ? 23 : 6, backgroundColor: add ? colors.glass : active ? colors.mist : 'transparent', alignItems: 'center', justifyContent: 'center' }}><Icon name={tab.icon} size={add ? 28 : 22} /></View>
          {!add ? <Text style={{ fontSize: 12, color: active ? ink : muted, textDecorationLine: active ? 'underline' : 'none' }}>{tab.label}</Text> : null}
        </Pressable></TourHighlight>;
      })}
    </View>
    {visible ? <Modal transparent animationType="none" visible onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close quick actions" onPress={() => { if (!tourMenu) setOpen(false); }} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
        <View accessibilityViewIsModal style={{ width: 264, maxWidth: '90%', marginBottom: Math.max(insets.bottom, 10) + 70, padding: 8, borderWidth: 1, borderColor: line, borderRadius: 12, backgroundColor: surface, shadowColor: ink, shadowOpacity: .08, shadowRadius: 8, elevation: 3 }}>
          <TourHighlight id="nav-add-transaction"><AddMenuItem label="Add Transaction" icon="transaction" tint={colors.glass} onPress={() => choose('transaction')} /></TourHighlight>
          <TourHighlight id="nav-add-paycheck"><AddMenuItem label="Add Paycheck" icon="paycheck" tint={colors.mist} onPress={() => choose('paycheck')} /></TourHighlight>
          <TourHighlight id="nav-add-budget"><AddMenuItem label="Budget" icon="category" tint={colors.glass} onPress={() => choose('budget')} /></TourHighlight>
          <TourHighlight id="nav-add-move"><AddMenuItem label="Move Money" icon="move" tint={colors.shell} onPress={() => choose('move')} /></TourHighlight>
          <TourHighlight id="nav-add-goal"><AddMenuItem label="Add to Goal" icon="goals" tint={colors.sand} onPress={() => choose('goal')} /></TourHighlight>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close quick actions" onPress={() => { if (!tourMenu) setOpen(false); }} style={{ position: 'absolute', bottom: Math.max(insets.bottom, 10) + 8, width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glass }}><Icon name="plus" size={28} /></Pressable>
        {tourMenu ? <WalkthroughOverlay menuLayer /> : null}
      </View>
    </Modal> : null}
  </View>;
}
function AddMenuItem({ label, icon, tint, onPress }: { label: string; icon: IconName; tint: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 12, padding: 8, borderRadius: 8, backgroundColor: pressed ? colors.background : surface })}><IconTile name={icon} tint={tint} /><Text style={{ fontSize: 17 }}>{label}</Text></Pressable>;
}

export const Page = ({ title, children, showTabs = true, headerRight, footer }: React.PropsWithChildren<{ title: string; showTabs?: boolean; headerRight?: React.ReactNode; footer?: React.ReactNode }>) => {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const root = ['/', '/accounts', '/paychecks', '/goals'].includes(pathname);
  const backHref = pathname.startsWith('/account/') ? '/accounts' : pathname.startsWith('/allocation/') ? '/budget' : pathname.startsWith('/paycheck/') ? '/paychecks' : pathname.startsWith('/goal/') ? '/goals' : pathname.startsWith('/transaction/') ? '/transactions' : '/';
  return <View style={{ flex: 1, backgroundColor: canvas }}>
    <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 12, backgroundColor: canvas }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}>
        {!root ? <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace(backHref)} style={{ minHeight: 44, minWidth: 40, justifyContent: 'center' }}><Icon name="back" /></Pressable> : null}
        <Text accessibilityRole="header" role={title.startsWith('Good morning') ? 'greeting' : 'default'} style={{ fontSize: title.startsWith('Good morning') ? 21 : 25, flex: 1 }}>{title}</Text>
        {headerRight ?? (root ? <Pressable accessibilityRole="button" accessibilityLabel="More and settings" onPress={() => router.push('/more')} style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="more" /></Pressable> : null)}
      </View>
    </View>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: showTabs ? 28 : insets.bottom + 24, gap: 16, width: '100%', maxWidth: 720, alignSelf: 'center' }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>{children}</ScrollView>
    {footer ? <View style={{ paddingHorizontal: 20, paddingVertical: 12, paddingBottom: showTabs ? 12 : insets.bottom + 12, backgroundColor: canvas }}>{footer}</View> : null}
    {showTabs ? <BottomNavigation /> : null}<WalkthroughOverlay />
  </View>;
};

export const SectionTitle = ({ children, right }: React.PropsWithChildren<{ right?: React.ReactNode }>) => <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}><Text style={{ fontSize: 17, fontWeight: '700', color: ink }}>{children}</Text>{right}</View>;

export const Card = ({ children, style }: React.PropsWithChildren<{ style?: object }>) => <View style={[{ borderWidth: 1, borderColor: '#E9E7E2', borderRadius: 10, padding: 16, gap: 12, backgroundColor: surface }, style]}>{children}</View>;

export const ProgressBar = ({ value, max, color = colors.blue }: { value: number; max: number; color?: string }) => {
  const progress = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} style={{ height: 7, borderRadius: 4, overflow: 'hidden', backgroundColor: '#ECEBE7' }}><View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: color, borderRadius: 4 }} /></View>;
};

export const Field = ({ label, value, onChangeText, placeholder, keyboardType = 'default', multiline = false, secureTextEntry = false, autoCapitalize = 'sentences' }: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'email-address'; multiline?: boolean; secureTextEntry?: boolean; autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters' }) => {
  const [showPassword, setShowPassword] = React.useState(false);
  return <View style={{ gap: 5 }}>
    <Text style={{ color: ink, fontSize: 15 }}>{label}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: line, borderRadius: 9, paddingRight: secureTextEntry ? 6 : 0, backgroundColor: surface }}>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} keyboardType={keyboardType} multiline={multiline} secureTextEntry={secureTextEntry && !showPassword} autoCapitalize={autoCapitalize} placeholderTextColor="#888" selectionColor={ink} onBlur={() => setShowPassword(false)} style={{ flex: 1, color: ink, paddingHorizontal: 12, paddingVertical: 9, fontSize: 16, minHeight: multiline ? 96 : 48 }} />
      {secureTextEntry ? <Pressable accessibilityRole="button" accessibilityLabel="Hold to show password" accessibilityHint="Password is hidden again when you release" onPressIn={() => setShowPassword(true)} onPressOut={() => setShowPassword(false)} style={{ minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 21, height: 14, borderWidth: 1.6, borderColor: ink, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ink }} /></View></Pressable> : null}
    </View>
  </View>;
};

export const DateField = ({ label, value, onChangeText, optional = false }: { label: string; value: string; onChangeText: (value: string) => void; optional?: boolean }) => {
  const [open, setOpen] = React.useState(false);
  const [visibleMonth, setVisibleMonth] = React.useState(() => {
    const selected = normalizeDateInput(value) ?? normalizeDateInput(todayDateInput())!;
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
    const iso = selected ?? normalizeDateInput(todayDateInput())!;
    const [selectedYear, selectedMonth] = iso.split('-').map(Number);
    setVisibleMonth(new Date(selectedYear, selectedMonth - 1, 1));
    setOpen(true);
  };
  const chooseDay = (day: number) => {
    onChangeText(`${month + 1}/${day}/${year}`);
    setOpen(false);
  };
  return <View style={{ gap: 5 }}>
    <Text style={{ color: ink, fontSize: 15 }}>{label}{optional ? ' (optional)' : ''}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder="M/D/YYYY" keyboardType="numbers-and-punctuation" placeholderTextColor="#888" selectionColor={ink} style={{ flex: 1, color: ink, borderWidth: 1, borderColor: line, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, minHeight: 42, backgroundColor: surface }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Choose date from calendar" onPress={openCalendar} style={({ pressed }) => ({ width: 44, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: line, backgroundColor: pressed ? '#DCE7DA' : surface })}><Text style={{ fontSize: 19, color: ink }}>▦</Text></Pressable>
    </View>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <Pressable onPress={() => setOpen(false)} style={{ flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(0,0,0,0.32)' }}>
        <Pressable onPress={event => event.stopPropagation()} style={{ alignSelf: 'flex-end', width: '100%', maxWidth: 370, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: line, backgroundColor: surface, gap: 13 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable accessibilityLabel="Previous month" onPress={() => changeMonth(-1)} hitSlop={8} style={{ padding: 6 }}><Text style={{ fontSize: 22, color: ink }}>‹</Text></Pressable>
            <Text style={{ fontSize: 17, fontWeight: '700', color: ink }}>{visibleMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</Text>
            <Pressable accessibilityLabel="Next month" onPress={() => changeMonth(1)} hitSlop={8} style={{ padding: 6 }}><Text style={{ fontSize: 22, color: ink }}>›</Text></Pressable>
          </View>
          <View style={{ flexDirection: 'row' }}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={{ width: `${100 / 7}%`, textAlign: 'center', color: muted, fontWeight: '600' }}>{day}</Text>)}</View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{cells.map((day, index) => {
            const iso = day ? `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}` : '';
            const active = Boolean(day && iso === selected);
            return <View key={index} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 2 }}>{day ? <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => chooseDay(day)} style={({ pressed }) => ({ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: active ? '#8FB3C0' : pressed ? '#D9DFE6' : 'transparent' })}><Text style={{ color: ink, fontWeight: active ? '700' : '400' }}>{day}</Text></Pressable> : <View style={{ width: 36, height: 36 }} />}</View>;
          })}</View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Pressable onPress={() => { onChangeText(todayDateInput()); setOpen(false); }}><Text style={{ color: ink, fontWeight: '600' }}>Today</Text></Pressable>
            <Pressable onPress={() => setOpen(false)}><Text style={{ color: ink }}>Done</Text></Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  </View>;
};

export const Action = ({ label, onPress, destructive = false, variant = 'secondary', fullWidth = false }: { label: string; onPress: () => void; destructive?: boolean; variant?: 'primary' | 'secondary' | 'text'; fullWidth?: boolean }) => <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ borderWidth: variant === 'text' ? 0 : 1, borderColor: variant === 'primary' ? '#8FB3C0' : line, borderRadius: 9, minHeight: 46, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 9, alignSelf: fullWidth ? 'stretch' : 'flex-start', backgroundColor: variant === 'primary' ? (pressed ? '#69777A' : '#344447') : pressed ? '#DCE7DA' : surface })}><Text style={{ color: variant === 'primary' ? '#fff' : destructive ? '#344447' : ink, fontWeight: variant === 'primary' ? '700' : '500', textDecorationLine: destructive ? 'underline' : 'none' }}>{label}</Text></Pressable>;

function supportsAccountInterest(type: AccountType) { return type === 'savings' || type === 'high_yield_savings' || type === 'credit_card'; }

type FeatureRoute = '/profile' | '/paychecks' | '/budget' | '/transactions' | '/accounts' | '/goals' | '/history';
export const FeatureButton = ({ title, detail, href }: { title: string; detail: string; href: FeatureRoute }) => <Link href={href} asChild><Pressable accessibilityRole="button" style={({ pressed }) => ({ borderWidth: 1, borderColor: line, borderRadius: 12, padding: 13, gap: 5, backgroundColor: pressed ? '#DCE7DA' : surface })}><Text style={{ color: ink, fontWeight: '700', fontSize: 15 }}>{title}</Text><Text style={{ color: muted, fontSize: 13 }}>{detail}</Text></Pressable></Link>;

export const RecordLine = ({ title, detail, onEdit, onDelete, onView, progress, icon = 'transaction', amount }: { title: string; detail: string; onEdit: () => void; onDelete: () => void; onView?: () => void; viewLabel?: string; progress?: { value: number; max: number; label?: string; color?: string }; icon?: IconName; amount?: string }) => {
  const [menu, setMenu] = React.useState(false);
  return <View style={{ borderWidth: icon === 'goals' ? 1 : 0, borderBottomWidth: 1, borderColor: line, borderRadius: icon === 'goals' ? 10 : 0, backgroundColor: icon === 'goals' ? surface : 'transparent', padding: icon === 'goals' ? 14 : 2, paddingVertical: 10, gap: 8 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${title}`} onPress={onView ?? onEdit} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
        <IconTile name={icon} tint={icon === 'goals' ? colors.glass : colors.mist} />
        <View style={{ flex: 1, gap: 5 }}><Text style={{ fontSize: 17 }}>{title}</Text><Text style={{ color: muted, fontSize: 14, lineHeight: 21 }}>{detail}</Text></View>
      </Pressable>
      {amount ? <Text role="money" style={{ fontSize: 20, maxWidth: '40%' }}>{amount}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={`Actions for ${title}`} accessibilityState={{ expanded: menu }} onPress={() => setMenu(!menu)} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Icon name="more" size={20} /></Pressable>
    </View>
    {progress ? <><ProgressBar value={progress.value} max={progress.max} color={progress.color ?? (icon === 'goals' ? colors.teal : colors.blue)} /><Text style={{ color: muted, fontSize: 13 }}>{progress.label ?? `${progress.max ? Math.round(progress.value / progress.max * 100) : 0}%`}</Text></> : null}
    {menu ? <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}><Action label="Edit" onPress={() => { setMenu(false); onEdit(); }} /><Action label="Delete" destructive onPress={() => { setMenu(false); onDelete(); }} /></View> : null}
  </View>;
};

export const SelectId = ({ label, choices, value, onChange, create }: { label: string; choices: { id: string; title: string }[]; value: string; onChange: (id: string) => void; create?: 'category' | 'account' }) => {
  const [open, setOpen] = React.useState(false);
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
  return <View style={{ gap: 5 }}><Text style={{ color: ink, fontSize: 15 }}>{label}</Text>
    <Action label={`${selected?.title ?? 'Choose…'}   ⌄`} onPress={() => setOpen(!open)} />
    {open ? <View style={{ borderWidth: 1, borderColor: line, borderRadius: 9, overflow: 'hidden', backgroundColor: surface }}>
      {choices.map(choice => <Pressable key={choice.id} onPress={() => { onChange(value === choice.id ? '' : choice.id); setOpen(false); }} style={{ padding: 11, borderBottomWidth: 1, borderBottomColor: line, backgroundColor: value === choice.id ? '#DCE7DA' : surface }}><Text style={{ color: ink }}>{value === choice.id ? '✓  ' : ''}{choice.title}{value === choice.id ? '  ·  tap to clear' : ''}</Text></Pressable>)}
      {create ? <Pressable accessibilityRole="button" onPress={startCreate} style={({ pressed }) => ({ padding: 11, backgroundColor: pressed ? '#DCE7DA' : surface })}><Text style={{ color: ink, fontWeight: '600' }}>＋ Create new {create}</Text></Pressable> : choices.length === 0 ? <Text style={{ color: muted, padding: 11 }}>No records available. Create one first.</Text> : null}
    </View> : null}
    {create ? <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
      <Pressable onPress={() => setCreateOpen(false)} style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.32)' }}>
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
            <Action label={`Create ${create}`} variant="primary" fullWidth onPress={() => void createRecord()} />
            <Action label="Cancel" onPress={() => setCreateOpen(false)} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal> : null}
  </View>;
};

export const Feedback = () => { const { error, clearError } = useData(); return <Modal visible={Boolean(error)} transparent animationType="fade" onRequestClose={clearError}>
  <View style={{ flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(0,0,0,0.38)' }}>
    <View accessibilityRole="alert" style={{ width: '100%', maxWidth: 420, alignSelf: 'center', padding: 18, gap: 12, borderWidth: 1, borderColor: '#d2d2d2', borderRadius: 12, backgroundColor: surface }}>
      <Text style={{ color: ink, fontSize: 18, fontWeight: '700' }}>Something needs attention</Text>
      <Text style={{ color: ink, lineHeight: 21 }}>{error}</Text>
      <Action label="Got it" variant="primary" fullWidth onPress={clearError} />
    </View>
  </View>
</Modal>; };
export const LocalNotice = () => { const { authConfigured, authUser } = useData(); return <Text style={{ color: muted, fontSize: 12 }}>{authConfigured ? `Signed in${authUser?.email ? ` as ${authUser.email}` : ''}. Records sync to your account.` : 'Local device data. Cloud sync and sign-in are not configured.'}</Text>; };

export function ProgressRing({ value, max }: { value: number; max: number }) {
  const progress = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const circumference = 2 * Math.PI * 34;
  return <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} style={{ width: 86, height: 86, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={86} height={86} viewBox="0 0 86 86" style={{ position: 'absolute' }}><Circle cx={43} cy={43} r={34} fill="none" stroke={colors.track} strokeWidth={7} /><Circle cx={43} cy={43} r={34} fill="none" stroke={colors.teal} strokeWidth={7} strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - progress)} strokeLinecap="round" rotation={-90} origin="43,43" /></Svg>
    <Text style={{ fontSize: 21 }}>{Math.round(progress * 100)}%</Text>
  </View>;
}
