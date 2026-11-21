import type { Settings } from '../core/types';

const KEY = 'pfv-theme';

export function resolveTheme(t: Settings['theme']): 'light' | 'dark' {
  if (t === 'hell') return 'light';
  if (t === 'dunkel') return 'dark';
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

/** Setzt das Farbschema und merkt es lokal, damit beim Laden nichts aufblitzt. */
export function applyTheme(t: Settings['theme']): void {
  const resolved = resolveTheme(t);
  document.documentElement.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', resolved === 'light' ? '#F3F4F6' : '#2B2D31');
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* Speicher nicht verfügbar: dann eben ohne Vorab-Merken */
  }
}
