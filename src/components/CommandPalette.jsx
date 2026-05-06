/**
 * CommandPalette.jsx
 *
 * Spotlight/Raycast-style overlay search. Triggered by ⌘K / Ctrl+K.
 *
 *   - Free-text query searches the clipboard list with the same
 *     useSearch ranking the main grid uses.
 *   - Arrow keys navigate, Enter copies, Escape closes.
 *   - Closes on click-outside.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearch, buildHighlights } from '../hooks/useSearch.js';

const TYPE_ICONS = { text: '📝', url: '🔗', code: '💻', image: '🖼️', emoji: '😀', html: '🧩' };

export default function CommandPalette({ open, onClose, items, onCopy }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  const { results } = useSearch(items, query, {});
  const top = useMemo(() => results.slice(0, 30), [results]);

  // Focus + reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Keep selection in range when results change
  useEffect(() => {
    if (active >= top.length) setActive(0);
  }, [top.length, active]);

  if (!open) return null;

  const handleKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(top.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = top[active];
      if (item) { onCopy?.(item); onClose(); }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-slate-900/95 ring-1 ring-slate-700 shadow-cardLg overflow-hidden animate-pop"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-3 py-2 border-b border-slate-800">
          <span className="text-slate-400 text-sm mr-2">🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search and copy…"
            className="flex-1 bg-transparent outline-none text-[13px] text-slate-100 placeholder:text-slate-500"
          />
          <button onClick={onClose} className="text-[10px] text-slate-500 ring-1 ring-slate-700 rounded px-1.5 py-0.5">Esc</button>
        </div>

        <div className="max-h-72 overflow-y-auto">
          {top.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12px] text-slate-500">No matches</div>
          ) : (
            top.map((item, idx) => {
              const isActive = idx === active;
              const segs = buildHighlights(truncate(item.content || '', 120), query);
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => { onCopy?.(item); onClose(); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${isActive ? 'bg-brand-600/30' : 'hover:bg-slate-800/60'}`}
                >
                  <span className="text-base w-5 text-center">{TYPE_ICONS[item.type] || '📦'}</span>
                  <span className="flex-1 min-w-0 text-[12px] text-slate-200 truncate">
                    {segs.map((s, i) => s.match
                      ? <mark key={i} className="bg-brand-500/40 text-white rounded px-0.5">{s.text}</mark>
                      : <React.Fragment key={i}>{s.text}</React.Fragment>)}
                  </span>
                  {item.tags?.[0] && (
                    <span className="text-[10px] text-slate-400 ring-1 ring-slate-700 rounded-full px-1.5 py-0.5">
                      {item.tags[0]}
                    </span>
                  )}
                  {isActive && (
                    <span className="text-[10px] text-slate-400 ml-1">↵</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-slate-800 px-3 py-1.5 flex items-center gap-3 text-[10px] text-slate-500">
          <Kbd>↑</Kbd><Kbd>↓</Kbd><span>navigate</span>
          <Kbd>↵</Kbd><span>copy</span>
          <Kbd>Esc</Kbd><span>close</span>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }) {
  return <span className="font-mono ring-1 ring-slate-700 rounded px-1 py-0.5">{children}</span>;
}
function truncate(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }
