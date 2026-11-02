import React from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Link, usePathname } from 'expo-router';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '../state/DataProvider';
import { normalizeDateInput, todayDateInput } from '../domain/date';
import { AccountType, newId } from '../domain/models';
import { parseMoney } from '../domain/money';
import { TourHighlight, walkthroughSteps, WalkthroughOverlay, useWalkthrough } from './walkthrough';

const ink = '#161616';
const muted = '#666';
const line = '#dedede';
const surface = '#fff';
const canvas = '#f7f7f7';
const tabs = [
  { label: 'Home', mark: '⌂', href: '/' }, { label: 'Accounts', mark: '▤', href: '/accounts' },
  { label: 'Add', mark: '＋', href: '/transaction/new' }, { label: 'Budget', mark: '＄', href: '/budget' }, { label: 'Goals', mark: '◎', href: '/goals' },
] as const;

function BottomNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [addMenuOpen, setAddMenuOpen] = React.useState(false);
  const walkthrough = useWalkthrough();
  const tourAddMenuOpen = Boolean(pathname === '/' && walkthrough?.active && walkthroughSteps[walkthrough.index]?.target === 'nav-add');
  React.useEffect(() => {
    if (tourAddMenuOpen) setAddMenuOpen(true);
    else if (walkthrough?.active) setAddMenuOpen(false);
  }, [tourAddMenuOpen, walkthrough?.active]);
  const addMenuVisible = addMenuOpen || tourAddMenuOpen;
  const chooseAddAction = (action: 'expense' | 'paycheck' | 'budget') => {
    setAddMenuOpen(false);
    if (action === 'expense') router.push('/transaction/new');
    if (action === 'paycheck') router.push({ pathname: '/paychecks', params: { add: '1' } });
    if (action === 'budget') router.push({ pathname: '/budget', params: { add: '1' } });
  };
  return <View accessibilityRole="tablist" style={{ flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderColor: line, paddingTop: 7, paddingBottom: Math.max(insets.bottom, 6), backgroundColor: surface }}>
    {tabs.map(tab => {
      const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
      const add = tab.href === '/transaction/new';
      if (add) return <TourHighlight key={tab.href} id="nav-add"><Pressable accessibilityRole="button" accessibilityLabel="Add" accessibilityState={{ expanded: addMenuVisible }} onPress={() => setAddMenuOpen(!addMenuOpen)} style={{ alignItems: 'center', justifyContent: 'center', minWidth: 58, paddingHorizontal: 5, paddingVertical: 2 }}>
        <Text style={{ width: 34, height: 34, textAlign: 'center', textAlignVertical: 'center', borderRadius: 18, overflow: 'hidden', color: '#fff', backgroundColor: ink, fontSize: 25, lineHeight: 34 }}>＋</Text>
      </Pressable></TourHighlight>;
      return <TourHighlight key={tab.href} id={`nav-${tab.label.toLowerCase()}`}><Link href={tab.href} replace asChild><Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} style={{ alignItems: 'center', justifyContent: 'center', minWidth: 58, paddingHorizontal: 5, paddingVertical: 2 }}>
        <Text style={{ color: ink, fontSize: 19, lineHeight: 22, fontWeight: active ? '700' : '400' }}>{tab.mark}</Text>
        <Text style={{ color: active ? ink : muted, fontSize: 10, fontWeight: active ? '700' : '400' }}>{tab.label}</Text>
      </Pressable></Link></TourHighlight>;
    })}
    {addMenuVisible ? <View style={{ position: 'absolute', bottom: 55, alignSelf: 'center', width: 242, padding: 8, gap: 4, borderWidth: 1, borderColor: line, borderRadius: 12, backgroundColor: surface, zIndex: 20, elevation: 7, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 9, shadowOffset: { width: 0, height: 3 } }}>
      <AddMenuItem label="Log expense" onPress={() => chooseAddAction('expense')} />
      <AddMenuItem label="Log paycheck" onPress={() => chooseAddAction('paycheck')} />
      <AddMenuItem label="Budget funds" onPress={() => chooseAddAction('budget')} />
    </View> : null}
  </View>;
}

function AddMenuItem({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={event => { event.stopPropagation(); onPress(); }} style={({ pressed }) => ({ minHeight: 42, justifyContent: 'center', paddingHorizontal: 11, borderRadius: 8, backgroundColor: pressed ? '#ededed' : surface })}><Text style={{ color: ink, fontWeight: '600' }}>{label}</Text></Pressable>;
}

export const Page = ({ title, children, showTabs = true, headerRight }: React.PropsWithChildren<{ title: string; showTabs?: boolean; headerRight?: React.ReactNode }>) => {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showBack = pathname !== '/' && pathname !== '/welcome';
  const backHref = pathname.startsWith('/account/') ? '/accounts' : pathname.startsWith('/allocation/') ? '/budget' : pathname.startsWith('/paycheck/') ? '/paychecks' : pathname.startsWith('/goal/') ? '/goals' : pathname.startsWith('/transaction/') ? '/transactions' : pathname === '/sign-in' || pathname === '/sign-up' ? '/welcome' : '/';
  const goBack = () => router.canGoBack() ? router.back() : router.replace(backHref);
  return <View style={{ flex: 1, backgroundColor: canvas }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 14, paddingBottom: 22, gap: 12 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      {showBack ? <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 9, marginBottom: 1 }}><View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 9 }}><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} hitSlop={8} style={{ paddingVertical: 4, paddingRight: 7 }}><Text style={{ color: ink, fontSize: 25, lineHeight: 29 }}>‹</Text></Pressable><Text style={{ fontSize: 21, fontWeight: '700', color: ink, flexShrink: 1 }}>{title}</Text></View>{headerRight}</View> : <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 1 }}><Text style={{ fontSize: 23, fontWeight: '700', color: ink, flexShrink: 1 }}>{title}</Text>{headerRight}</View>}{children}
    </ScrollView>{showTabs ? <BottomNavigation /> : null}<WalkthroughOverlay />
  </View>;
};

export const SectionTitle = ({ children, right }: React.PropsWithChildren<{ right?: React.ReactNode }>) => <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}><Text style={{ fontSize: 17, fontWeight: '700', color: ink }}>{children}</Text>{right}</View>;

export const Card = ({ children, style }: React.PropsWithChildren<{ style?: object }>) => <View style={[{ borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 13, padding: 13, gap: 8, backgroundColor: surface }, style]}>{children}</View>;

export const ProgressBar = ({ value, max }: { value: number; max: number }) => {
  const progress = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} style={{ height: 8, borderRadius: 8, overflow: 'hidden', backgroundColor: '#e3e3e3' }}><View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: '#858585', borderRadius: 8 }} /></View>;
};

export const Field = ({ label, value, onChangeText, placeholder, keyboardType = 'default', multiline = false, secureTextEntry = false, autoCapitalize = 'sentences' }: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'email-address'; multiline?: boolean; secureTextEntry?: boolean; autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters' }) => {
  const [showPassword, setShowPassword] = React.useState(false);
  return <View style={{ gap: 5 }}>
    <Text style={{ color: ink, fontSize: 13 }}>{label}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: line, borderRadius: 9, paddingRight: secureTextEntry ? 6 : 0, backgroundColor: surface }}>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} keyboardType={keyboardType} multiline={multiline} secureTextEntry={secureTextEntry && !showPassword} autoCapitalize={autoCapitalize} placeholderTextColor="#888" selectionColor={ink} onBlur={() => setShowPassword(false)} style={{ flex: 1, color: ink, paddingHorizontal: 12, paddingVertical: 9, minHeight: multiline ? 76 : 42 }} />
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
    <Text style={{ color: ink, fontSize: 13 }}>{label}{optional ? ' (optional)' : ''}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder="M/D/YYYY" keyboardType="numbers-and-punctuation" placeholderTextColor="#888" selectionColor={ink} style={{ flex: 1, color: ink, borderWidth: 1, borderColor: line, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, minHeight: 42, backgroundColor: surface }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Choose date from calendar" onPress={openCalendar} style={({ pressed }) => ({ width: 44, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: line, backgroundColor: pressed ? '#ededed' : surface })}><Text style={{ fontSize: 19, color: ink }}>▦</Text></Pressable>
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
            return <View key={index} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 2 }}>{day ? <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => chooseDay(day)} style={({ pressed }) => ({ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: active ? '#858585' : pressed ? '#eee' : 'transparent' })}><Text style={{ color: active ? '#fff' : ink, fontWeight: active ? '700' : '400' }}>{day}</Text></Pressable> : <View style={{ width: 36, height: 36 }} />}</View>;
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

export const Action = ({ label, onPress, destructive = false, variant = 'secondary', fullWidth = false }: { label: string; onPress: () => void; destructive?: boolean; variant?: 'primary' | 'secondary' | 'text'; fullWidth?: boolean }) => <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ borderWidth: variant === 'text' ? 0 : 1, borderColor: variant === 'primary' ? '#858585' : line, borderRadius: 9, minHeight: 40, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 9, alignSelf: fullWidth ? 'stretch' : 'flex-start', backgroundColor: variant === 'primary' ? (pressed ? '#707070' : '#898989') : pressed ? '#ededed' : surface })}><Text style={{ color: variant === 'primary' ? '#fff' : destructive ? '#444' : ink, fontWeight: variant === 'primary' ? '700' : '500', textDecorationLine: destructive ? 'underline' : 'none' }}>{label}</Text></Pressable>;

function supportsAccountInterest(type: AccountType) { return type === 'savings' || type === 'high_yield_savings' || type === 'credit_card'; }

type FeatureRoute = '/paychecks' | '/budget' | '/transactions' | '/accounts' | '/goals' | '/history';
export const FeatureButton = ({ title, detail, href }: { title: string; detail: string; href: FeatureRoute }) => <Link href={href} asChild><Pressable accessibilityRole="button" style={({ pressed }) => ({ borderWidth: 1, borderColor: line, borderRadius: 12, padding: 13, gap: 5, backgroundColor: pressed ? '#f0f0f0' : surface })}><Text style={{ color: ink, fontWeight: '700', fontSize: 15 }}>{title}</Text><Text style={{ color: muted, fontSize: 13 }}>{detail}</Text></Pressable></Link>;

export const RecordLine = ({ title, detail, onEdit, onDelete, onView, viewLabel = 'View details  ›', progress }: { title: string; detail: string; onEdit: () => void; onDelete: () => void; onView?: () => void; viewLabel?: string; progress?: { value: number; max: number; label?: string } }) => <Card>
  <Text style={{ color: ink, fontWeight: '700', fontSize: 15 }}>{title}</Text>{progress ? <><ProgressBar value={progress.value} max={progress.max} /><Text style={{ color: muted, fontSize: 12 }}>{progress.label ?? `${progress.max ? Math.round(progress.value / progress.max * 100) : 0}%`}</Text></> : null}<Text style={{ color: muted, lineHeight: 19 }}>{detail}</Text>
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 2 }}>{onView ? <Action label={viewLabel} onPress={onView} /> : null}<Action label="Edit" onPress={onEdit} /><Action label="Delete" destructive onPress={onDelete} /></View>
</Card>;

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
  return <View style={{ gap: 5 }}><Text style={{ color: ink, fontSize: 13 }}>{label}</Text>
    <Action label={`${selected?.title ?? 'Choose…'}   ⌄`} onPress={() => setOpen(!open)} />
    {open ? <View style={{ borderWidth: 1, borderColor: line, borderRadius: 9, overflow: 'hidden', backgroundColor: surface }}>
      {choices.map(choice => <Pressable key={choice.id} onPress={() => { onChange(value === choice.id ? '' : choice.id); setOpen(false); }} style={{ padding: 11, borderBottomWidth: 1, borderBottomColor: line, backgroundColor: value === choice.id ? '#f0f0f0' : surface }}><Text style={{ color: ink }}>{value === choice.id ? '✓  ' : ''}{choice.title}{value === choice.id ? '  ·  tap to clear' : ''}</Text></Pressable>)}
      {create ? <Pressable accessibilityRole="button" onPress={startCreate} style={({ pressed }) => ({ padding: 11, backgroundColor: pressed ? '#ededed' : surface })}><Text style={{ color: ink, fontWeight: '600' }}>＋ Create new {create}</Text></Pressable> : choices.length === 0 ? <Text style={{ color: muted, padding: 11 }}>No records available. Create one first.</Text> : null}
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
