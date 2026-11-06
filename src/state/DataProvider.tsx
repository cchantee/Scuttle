import { addSampleData, removeSampleData } from '../domain/demoData';
import { AppState } from 'react-native';
import { goalFundsHeld } from '../domain/goalFunds';
import { applyPaycheckOperation, PaycheckOperation } from '../domain/paycheckOperations';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppData, emptyData, PaydayFrequency, Transaction, newId } from '../domain/models';
import { CollectionName, completeGoalContributionInAccount, removeRecord, StorageAdapter, transferGoalContribution, upsertRecord } from '../domain/store';
import { AsyncStorageAdapter } from '../storage/asyncStorage';
import { isCloudConfigured, supabase } from '../backend/supabase';
import { SupabaseStorageAdapter } from '../storage/supabaseStorage';
import { normalizeDateInput } from '../domain/date';
import { newestPaychecks, remainingForPaycheck } from '../domain/calculations';
import { nextInterestPostingTransaction } from '../domain/interest';
import { todayISODate } from '../domain/date';

interface DataContextValue {
  loadSampleData: () => Promise<boolean>;
  deleteSampleData: () => Promise<boolean>;
  paycheckOperation: (operation: PaycheckOperation) => Promise<boolean>;
  data: AppData; loading: boolean; error: string | null; saveRecord: (collection: CollectionName, record: any) => Promise<boolean>;
  deleteRecord: (collection: CollectionName, id: string) => Promise<boolean>; clearError: () => void;
  reportError: (message: string) => void; movePaycheckToAccount: (paycheckId: string, accountId: string) => Promise<boolean>;
  planSubscription: (subscriptionId: string) => Promise<boolean>;
  settleGoalContribution: (contributionId: string, transaction: Transaction) => Promise<boolean>;
  completeGoalContributionInAccount: (contributionId: string) => Promise<boolean>;
  postMonthlyInterest: (accountId: string) => Promise<boolean>;
  saveNextPayday: (date?: string, frequency?: PaydayFrequency, intervalDays?: number) => Promise<boolean>;
  authConfigured: boolean; authLoading: boolean; authUser: { id: string; email?: string; displayName?: string; walkthroughNeeded: boolean } | null;
  signIn: (email: string, password: string) => Promise<{ userId: string; walkthroughNeeded: boolean }>; signUp: (email: string, password: string, displayName: string) => Promise<{ userId: string; hasSession: boolean }>; completeWalkthrough: () => Promise<void>; signOut: () => Promise<void>;
}
const Context = createContext<DataContextValue | null>(null);
const localStorage = new AsyncStorageAdapter();
function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return fallback;
}
function toAuthUser(user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null | undefined) {
  if (!user) return null;
  const displayName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : undefined;
  return { id: user.id, email: user.email, displayName, walkthroughNeeded: user.user_metadata?.scuttle_walkthrough_complete === false };
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData());
  const dataRef = useRef(data);
  const storageRef = useRef<StorageAdapter>(localStorage);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(isCloudConfigured);
  const [authUser, setAuthUser] = useState<{ id: string; email?: string; displayName?: string; walkthroughNeeded: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!isCloudConfigured || !supabase) { setAuthLoading(false); return; }
    let active = true;
    supabase.auth.getSession().then(({ data: result, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      setAuthUser(toAuthUser(result.session?.user));
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(toAuthUser(session?.user));
      setAuthLoading(false);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  // Reset markers are admin-owned metadata, separate from the financial fixture.
  useEffect(() => {
    if (!supabase || authUser?.email?.toLowerCase() !== 'jordan.taylor@example.com') return;
    const client = supabase;
    let active = true, checking = false;
    const baseline = client.auth.getSession().then(({ data }) => data.session?.user.app_metadata?.scuttle_study_reset);
    const checkReset = async () => {
      if (!active || checking) return;
      checking = true;
      try {
        const original = await baseline;
        const { data: result, error } = await client.auth.getUser();
        if (active && !error && result.user && result.user.app_metadata?.scuttle_study_reset !== original) {
          await client.auth.signOut({ scope: 'local' });
          if (active) { setAuthUser(null); dataRef.current = emptyData(); setData(emptyData()); }
        }
      } catch { /* Retry when connectivity returns. */ } finally { checking = false; }
    };
    void checkReset();
    const timer = setInterval(() => void checkReset(), 15000);
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') void checkReset(); });
    return () => { active = false; clearInterval(timer); foreground.remove(); };
  }, [authUser?.id]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const blank = isCloudConfigured && authUser
      ? { ...emptyData(), user: { id: authUser.id, displayName: authUser.displayName ?? authUser.email ?? '' } }
      : emptyData();
    dataRef.current = blank;
    setData(blank);
    const adapter: StorageAdapter = isCloudConfigured && authUser
      ? new SupabaseStorageAdapter(authUser.id)
      : localStorage;
    storageRef.current = adapter;
    if (isCloudConfigured && !authUser) {
      setLoading(authLoading);
      return () => { active = false; };
    }
    adapter.load().then(saved => {
      if (!active) return;
      const next = saved ?? emptyData();
      dataRef.current = next;
      setData(next);
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not load saved data.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authUser?.id, authLoading]);

  const enqueue = useCallback((operation: () => Promise<boolean>) => {
    const result = queue.current.then(operation, operation);
    queue.current = result.catch(() => undefined);
    return result;
  }, []);
  const commit = useCallback(async (next: AppData) => {
    try {
      if (loading) { setError('Wait for Scuttle to finish loading your records before saving.'); return false; }
      if (isCloudConfigured && !authUser) { setError('Sign in before saving financial records.'); return false; }
      if (isCloudConfigured && dataRef.current.user.id !== authUser?.id) { setError('Your account changed. Reload your records before saving.'); return false; }
      await storageRef.current.save(next);
      dataRef.current = next; setData(next); setError(null);
      return true;
    } catch (e) {
      setError(errorMessage(e, 'Could not save your change. Check your connection and try again.'));
      return false;
    }
  }, [authUser, loading]);
  const paycheckOperation = useCallback((operation: PaycheckOperation) => enqueue(async () => {
    const result = applyPaycheckOperation(dataRef.current, operation);
    if (result.error) { setError(result.error); return false; }
    return commit(result.data);
  }), [enqueue, commit]);
  const saveRecord = useCallback((collection: CollectionName, record: any) => enqueue(async () => {
    const result = upsertRecord(dataRef.current, collection, record);
    if (result.error) { setError(result.error); return false; }
    return commit(result.data);
  }), [enqueue, commit]);
  const deleteRecord = useCallback((collection: CollectionName, id: string) => enqueue(async () => {
    const result = removeRecord(dataRef.current, collection, id);
    if (result.error) { setError(result.error); return false; }
    return commit(result.data);
  }), [enqueue, commit]);
  const movePaycheckToAccount = useCallback((paycheckId: string, accountId: string) => enqueue(async () => {
    const paycheck = dataRef.current.paychecks.find(item => item.id === paycheckId);
    if (!paycheck) { setError('This paycheck could not be found.'); return false; }
    if (paycheck.status === 'planned') { setError('Mark this paycheck as received first.'); return false; }
    if (!dataRef.current.accounts.some(item => item.id === accountId)) { setError('Choose an account that still exists.'); return false; }
    const remaining = remainingForPaycheck(dataRef.current, paycheckId);
    if (remaining <= 0) { setError('This paycheck has no unspent amount left to move. Its linked allocations and expenses remain in the budget history.'); return false; }
    const currentAccountId = paycheck.remainingAccountId ?? paycheck.accountId;
    if (!currentAccountId) {
      const updatedPaycheck = { ...paycheck, accountId, accountCreditCents: remaining, remainingAccountId: accountId };
      const result = upsertRecord(dataRef.current, 'paychecks', updatedPaycheck);
      if (result.error) { setError(result.error); return false; }
      return commit(result.data);
    }
    if (currentAccountId === accountId) return true;
    const date = paycheck.receivedAt;
    const linkedAllocationIds = new Set(dataRef.current.allocations.filter(item => item.paycheckId === paycheck.id).map(item => item.id));
    const linkedExpenseCount = dataRef.current.transactions.filter(item => item.type === 'expense' && item.allocationId && linkedAllocationIds.has(item.allocationId)).length;
    const transfer: Transaction = { id: newId(), type: 'transfer', description: `Move remaining funds from ${paycheck.source || 'paycheck'}`, amountCents: remaining, date, accountId: currentAccountId, toAccountId: accountId, paycheckId: paycheck.id, notes: `Retained ${linkedAllocationIds.size} linked allocation(s) and ${linkedExpenseCount} linked expense transaction(s) for paycheck ${paycheck.id}.` };
    const transactionResult = upsertRecord(dataRef.current, 'transactions', transfer);
    if (transactionResult.error) { setError(transactionResult.error); return false; }
    const paycheckResult = upsertRecord(transactionResult.data, 'paychecks', { ...paycheck, remainingAccountId: accountId });
    if (paycheckResult.error) { setError(paycheckResult.error); return false; }
    return commit(paycheckResult.data);
  }), [enqueue, commit]);
  const planSubscription = useCallback((subscriptionId: string) => enqueue(async () => {
    const current = dataRef.current;
    const subscription = current.transactions.find(item => item.id === subscriptionId && item.type === 'subscription');
    if (!subscription) { setError('This subscription could not be found.'); return false; }
    if (!subscription.categoryId || !current.categories.some(item => item.id === subscription.categoryId)) { setError('Choose a budget category for this subscription before adding it to a paycheck plan.'); return false; }
    const paycheck = newestPaychecks(current.paychecks.filter(item => !item.budgetArchived))[0];
    if (!paycheck) { setError('Add a paycheck before planning this subscription.'); return false; }
    if (current.allocations.some(item => item.subscriptionId === subscription.id && item.paycheckId === paycheck.id)) { setError('This subscription is already included in that paycheck plan.'); return false; }
    const result = upsertRecord(current, 'allocations', { id: newId(), paycheckId: paycheck.id, categoryId: subscription.categoryId, amountCents: subscription.amountCents, subscriptionId: subscription.id });
    if (result.error) { setError(result.error); return false; }
    return commit(result.data);
  }), [enqueue, commit]);
  const settleGoalContribution = useCallback((contributionId: string, transaction: Transaction) => enqueue(async () => {
    const current = dataRef.current;
    const contribution = current.contributions.find(item => item.id === contributionId);
    if (!contribution || !goalFundsHeld(current, contribution)) { setError('This goal contribution is no longer pending.'); return false; }
    const result = transferGoalContribution(current, contributionId, transaction);
    if (result.error) { setError(result.error); return false; }
    return commit(result.data);
  }), [enqueue, commit]);
  const completeGoalContribution = useCallback((contributionId: string) => enqueue(async () => {
    const result = completeGoalContributionInAccount(dataRef.current, contributionId);
    if (result.error) { setError(result.error); return false; }
    return commit(result.data);
  }), [enqueue, commit]);
  const postMonthlyInterest = useCallback((accountId: string) => enqueue(async () => {
    const current = dataRef.current;
    const account = current.accounts.find(item => item.id === accountId);
    if (!account) { setError('This account could not be found.'); return false; }
    const transaction = nextInterestPostingTransaction(current, account, todayISODate(current.user), newId());
    if (!transaction) { setError('There is no completed monthly interest amount to post yet.'); return false; }
    const result = upsertRecord(current, 'transactions', transaction);
    if (result.error) { setError(result.error); return false; }
    return commit(result.data);
  }), [enqueue, commit]);
  const saveNextPayday = useCallback((date?: string, frequency?: PaydayFrequency, intervalDays?: number) => enqueue(async () => {
    const normalized = date ? normalizeDateInput(date) ?? undefined : undefined;
    if (date && !normalized) { setError('Enter a valid next payday date.'); return false; }
    if (normalized && !frequency) { setError('Choose how often you are paid.'); return false; }
    if (frequency === 'custom' && (!Number.isInteger(intervalDays) || !intervalDays || intervalDays < 1 || intervalDays > 365)) { setError('For Other, enter a repeat interval from 1 to 365 days.'); return false; }
    return commit({ ...dataRef.current, user: { ...dataRef.current.user, nextPayday: normalized, paydayFrequency: normalized ? frequency : undefined, paydayIntervalDays: normalized && frequency === 'custom' ? intervalDays : undefined } });
  }), [enqueue, commit]);
  const loadSampleData = useCallback(() => enqueue(async () => {
    const result = addSampleData(dataRef.current);
    if (result.error) { setError(result.error); return false; }
    return commit(result.data);
  }), [enqueue, commit]);
  const deleteSampleData = useCallback(() => enqueue(async () => {
    const result = removeSampleData(dataRef.current);
    if (result.error) { setError(result.error); return false; }
    return commit(result.data);
  }), [enqueue, commit]);
  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Cloud accounts are not configured for this project.');
    const { data: result, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) throw authError;
    if (!result.user) throw new Error('Sign-in did not return a user account.');
    return { userId: result.user.id, walkthroughNeeded: result.user.user_metadata?.scuttle_walkthrough_complete === false };
  }, []);
  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    if (!supabase) throw new Error('Cloud accounts are not configured for this project.');
    const { data: result, error: authError } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: displayName.trim(), scuttle_walkthrough_complete: false } } });
    if (authError) throw authError;
    if (!result.user) throw new Error('Account creation did not return a user account.');
    return { userId: result.user.id, hasSession: Boolean(result.session) };
  }, []);
  const completeWalkthrough = useCallback(async () => {
    if (!supabase || !authUser) throw new Error('Sign in to save your walkthrough progress.');
    const { data: result, error: authError } = await supabase.auth.updateUser({ data: { scuttle_walkthrough_complete: true } });
    if (authError) throw authError;
    setAuthUser(toAuthUser(result.user));
  }, [authUser]);
  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error: authError } = await supabase.auth.signOut();
    if (authError) throw authError;
  }, []);
  const value = useMemo(() => ({ loadSampleData, deleteSampleData, data, loading, error, paycheckOperation, saveRecord, deleteRecord, saveNextPayday, clearError: () => setError(null), reportError: (message: string) => setError(message), movePaycheckToAccount, planSubscription, settleGoalContribution, completeGoalContributionInAccount: completeGoalContribution, postMonthlyInterest, authConfigured: isCloudConfigured, authLoading, authUser, signIn, signUp, completeWalkthrough, signOut }), [loadSampleData, deleteSampleData, data, loading, error, paycheckOperation, saveRecord, deleteRecord, saveNextPayday, movePaycheckToAccount, planSubscription, settleGoalContribution, completeGoalContribution, postMonthlyInterest, authLoading, authUser, signIn, signUp, completeWalkthrough, signOut]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useData() { const value = useContext(Context); if (!value) throw new Error('useData must be used inside DataProvider'); return value; }
