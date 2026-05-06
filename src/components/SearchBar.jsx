/**
 * SearchBar.jsx
 *
 * The popup's primary input. Two responsibilities:
 *   1. Drive `query` state in the parent.
 *   2. Expose a "⌘K / Ctrl+K" hint and trigger to open the CommandPalette.
 *
 * Keeps focus management quiet — popup auto-focuses this on mount.
 */

import React, { useEffect, useRef } from 'react';

export default function SearchBar({ value, onChange, onOpenPalette, autoFocus = true }) {
  const ref = useRef(null);

  useEffect(() => {
    if (autoFocus) {
      // Delay so the popup's enter animation finishes first.
      const t = setTimeout(() => ref.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  return (
    <div className="relative flex items-center">
      <span className="absolute left-2.5 text-slate-400 text-sm pointer-events-none">🔍</span>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search content, tags, or domains…"
        className="w-full pl-8 pr-16 py-2 rounded-md bg-slate-800/70 ring-1 ring-slate-700 focus:ring-brand-400 focus:bg-slate-800 outline-none text-[13px] text-slate-100 placeholder:text-slate-500 transition-all"
      />
      <button
        type="button"
        onClick={onOpenPalette}
        title="Open command palette (⌘K)"
        className="absolute right-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-slate-400 ring-1 ring-slate-700 hover:text-slate-100 hover:ring-slate-500"
      >
        <span className="font-mono">⌘K</span>
      </button>
    </div>
  );
}
