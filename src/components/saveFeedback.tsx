import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useData } from '../state/DataProvider';
const SavedContext = createContext(false);
/** A presentation observer: persists across route changes without changing storage behavior. */
export function SaveFeedbackProvider({ children }: React.PropsWithChildren) {
  const { data, loading, authLoading, error } = useData();
  const previous = useRef(data);
  const ready = useRef(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (loading || authLoading) { ready.current = false; setSaved(false); }
    else if (!ready.current) ready.current = true;
    else if (previous.current !== data && !error) setSaved(true);
    previous.current = data;
  }, [data, loading, authLoading, error]);
  useEffect(() => { if (saved) { const timer = setTimeout(() => setSaved(false), 3500); return () => clearTimeout(timer); } }, [saved, data]);
  return <SavedContext.Provider value={saved}>{children}</SavedContext.Provider>;
}
export const useSavedFeedback = () => useContext(SavedContext);
