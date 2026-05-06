/**
 * useTheme.js
 *
 * Dark/light mode hook. Persists choice to chrome.storage.local (with a
 * graceful fallback to localStorage when the extension APIs aren't around,
 * e.g. during component testing). Defaults to dark — that's the design.
 */

import { useCallback, useEffect, useState } from 'react';

const KEY = 'scm.theme';
const DEFAULT_THEME = 'dark';

async function readStored() {
  try {
    if (chrome?.storage?.local) {
      const got = await chrome.storage.local.get(KEY);
      return got?.[KEY] || null;
    }
  } catch (_) { /* fall through */ }
  try { return localStorage.getItem(KEY); } catch { return null; }
}

async function writeStored(value) {
  try {
    if (chrome?.storage?.local) {
      await chrome.storage.local.set({ [KEY]: value });
      return;
    }
  } catch (_) { /* fall through */ }
  try { localStorage.setItem(KEY, value); } catch { /* noop */ }
}

export function useTheme() {
  const [theme, setTheme] = useState(DEFAULT_THEME);

  useEffect(() => {
    let alive = true;
    (async () => {
      const stored = await readStored();
      if (alive && (stored === 'light' || stored === 'dark')) setTheme(stored);
    })();
    return () => { alive = false; };
  }, []);

  // Reflect into the document <html> class so Tailwind dark: variants apply.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      writeStored(next);
      return next;
    });
  }, []);

  return { theme, toggleTheme, setTheme: (next) => { writeStored(next); setTheme(next); } };
}
