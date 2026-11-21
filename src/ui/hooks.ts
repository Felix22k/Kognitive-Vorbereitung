import { liveQuery } from 'dexie';
import { useEffect, useState, useSyncExternalStore } from 'react';

/** Reaktive Datenbankabfrage: rendert neu, wenn sich die Daten ändern. */
export function useLive<T>(query: () => Promise<T>, deps: unknown[], initial: T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const sub = liveQuery(query).subscribe({
      next: (v) => setValue(v),
      error: (e) => console.error(e),
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

function subscribeHash(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

/** Einfacher Hash-Router: liefert die Pfadteile, z. B. ['modul', 'kopfrechnen', 'test']. */
export function useRoute(): string[] {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash);
  const path = hash.replace(/^#\/?/, '').split('?')[0];
  const parts = path.split('/').filter(Boolean);
  return parts.length ? parts : ['heute'];
}

export function navigate(path: string): void {
  window.location.hash = '#/' + path.replace(/^\//, '');
}
