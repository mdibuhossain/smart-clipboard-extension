/**
 * TagEditor.jsx
 *
 * Inline tag editor. Renders the existing tags as TagBadges and an input
 * to add new tags. Suggests tags from the union of all tags currently in
 * the clipboard list as the user types.
 */

import React, { useMemo, useRef, useState } from 'react';
import TagBadge from './TagBadge.jsx';

export default function TagEditor({ tags = [], onChange, suggestions = [] }) {
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  const filteredSuggestions = useMemo(() => {
    const q = draft.trim().toLowerCase();
    if (!q) return [];
    return suggestions
      .filter((s) => !tags.includes(s) && s.toLowerCase().includes(q))
      .slice(0, 6);
  }, [draft, suggestions, tags]);

  const commit = (value) => {
    const v = (value || draft).trim();
    if (!v) return;
    if (tags.includes(v)) { setDraft(''); return; }
    onChange?.([...tags, v]);
    setDraft('');
  };

  const removeTag = (t) => onChange?.(tags.filter((x) => x !== t));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <TagBadge key={t} tag={t} onRemove={removeTag} />
      ))}
      <div className="relative">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            else if (e.key === 'Backspace' && !draft && tags.length) {
              onChange?.(tags.slice(0, -1));
            } else if (e.key === 'Escape') {
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder="+ tag"
          className="bg-transparent outline-none text-[11px] placeholder:text-slate-500 text-slate-200 w-16 focus:w-24 transition-all"
        />
        {open && filteredSuggestions.length > 0 && (
          <div className="absolute z-30 mt-1 w-40 max-h-40 overflow-auto rounded-md bg-slate-900/95 ring-1 ring-slate-700 shadow-cardLg animate-fadeIn">
            {filteredSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(s)}
                className="block w-full text-left px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700/60"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
