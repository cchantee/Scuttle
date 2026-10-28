import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppData, emptyData } from '../domain/models';
import { CollectionName, removeRecord, upsertRecord } from '../domain/store';
import { AsyncStorageAdapter } from '../storage/asyncStorage';

interface DataContextValue {
  data: AppData; loading: boolean; error: string | null; status: string | null; saveRecord: (collection: CollectionName, record: any) => Promise<boolean>;
  deleteRecord: (collection: CollectionName, id: string) => Promise<boolean>; clearError: () => void;
}
const Context = createContext<DataContextValue | null>(null);
const storage = new AsyncStorageAdapter();

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData());
  const dataRef = useRef(data);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    storage.load().then(saved => { if (saved) { dataRef.current = saved; setData(saved); } }).catch(e => setError(e instanceof Error ? e.message : 'Could not load saved data.')).finally(() => setLoading(false));
  }, []);

  const enqueue = useCallback((operation: () => Promise<boolean>) => {
    const result = queue.current.then(operation, operation);
    queue.current = result.catch(() => undefined);
    return result;
  }, []);
  const commit = useCallback(async (next: AppData) => {
    try { await storage.save(next); dataRef.current = next; setData(next); setError(null); setStatus('Saved to this device.'); return true; }
    catch { setError('Could not save your change. Check device storage and try again.'); return false; }
  }, []);
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
  const value = useMemo(() => ({ data, loading, error, status, saveRecord, deleteRecord, clearError: () => { setError(null); setStatus(null); } }), [data, loading, error, status, saveRecord, deleteRecord]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useData() { const value = useContext(Context); if (!value) throw new Error('useData must be used inside DataProvider'); return value; }
