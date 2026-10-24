import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Bookmark { id: string; roleTitle: string; status: 'active' | 'completed'; language: 'ar' | 'en'; savedAt: string; score?: number | null }
interface Ctx { bookmarks: Bookmark[]; loaded: boolean; upsert: (b: Omit<Bookmark, 'savedAt'>) => void; remove: (id: string) => void }
const KEY = 'miraa.bookmarks.v1';
const BookmarksContext = createContext<Ctx | null>(null);

export function BookmarksProvider({ children }: { children: React.ReactNode }) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => { if (raw) { try { setBookmarks(JSON.parse(raw) as Bookmark[]); } catch { /* corrupted store */ } } })
      .finally(() => setLoaded(true));
  }, []);
  const persist = useCallback((next: Bookmark[]) => { AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined); }, []);
  const upsert = useCallback((b: Omit<Bookmark, 'savedAt'>) => {
    setBookmarks((prev) => {
      const existing = prev.find((p) => p.id === b.id);
      const same = existing && existing.status === b.status && existing.roleTitle === b.roleTitle && existing.score === b.score;
      if (same) return prev;
      const next = [{ ...b, savedAt: existing?.savedAt ?? new Date().toISOString() }, ...prev.filter((p) => p.id !== b.id)].slice(0, 40);
      persist(next);
      return next;
    });
  }, [persist]);
  const remove = useCallback((id: string) => {
    setBookmarks((prev) => { const next = prev.filter((p) => p.id !== id); persist(next); return next; });
    AsyncStorage.removeItem(draftKey(id)).catch(() => undefined);
  }, [persist]);
  const value = useMemo(() => ({ bookmarks, loaded, upsert, remove }), [bookmarks, loaded, upsert, remove]);
  return <BookmarksContext.Provider value={value}>{children}</BookmarksContext.Provider>;
}
export function useBookmarks() {
  const c = useContext(BookmarksContext);
  if (!c) throw new Error('useBookmarks outside provider');
  return c;
}
export const draftKey = (id: string) => 'miraa.draft.' + id;
