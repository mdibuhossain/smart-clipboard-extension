/**
 * FilterPanel.jsx
 *
 * Collapsible filter sidebar with type checkboxes, tag pills, and toggles
 * for "pinned only" / "favorites only". Designed to live to the left of
 * the clipboard list inside the popup.
 */

import React, { useMemo } from 'react';
import TagBadge from './TagBadge.jsx';

const TYPE_OPTIONS = [
  { id: 'text',  label: 'Text',  icon: '📝' },
  { id: 'url',   label: 'URLs',  icon: '🔗' },
  { id: 'code',  label: 'Code',  icon: '💻' },
  { id: 'image', label: 'Image', icon: '🖼️' },
  { id: 'emoji', label: 'Emoji', icon: '😀' },
  { id: 'html',  label: 'HTML',  icon: '🧩' }
];

export default function FilterPanel({ items, filters, onChange, onClose }) {
  const allTags = useMemo(() => {
    const counts = new Map();
    for (const it of items) for (const t of (it.tags || [])) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 24)
      .map(([tag, n]) => ({ tag, n }));
  }, [items]);

  const toggleType = (id) => {
    const next = new Set(filters.types || []);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange({ ...filters, types: Array.from(next) });
  };
  const toggleTag = (tag) => {
    const next = new Set(filters.tags || []);
    next.has(tag) ? next.delete(tag) : next.add(tag);
    onChange({ ...filters, tags: Array.from(next) });
  };
  const clearAll = () => onChange({ types: [], tags: [], pinnedOnly: false, favoritesOnly: false });

  return (
    <aside className="absolute inset-y-0 left-0 w-56 bg-slate-900/95 ring-1 ring-slate-700/60 backdrop-blur z-40 flex flex-col animate-slideUp">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
        <h4 className="text-[12px] uppercase tracking-wide text-slate-400 font-semibold">Filters</h4>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-sm" aria-label="Close filters">×</button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        <section>
          <h5 className="text-[10px] uppercase text-slate-500 font-bold mb-1.5">Quick</h5>
          <label className="flex items-center gap-2 text-[12px] text-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!filters.pinnedOnly}
              onChange={(e) => onChange({ ...filters, pinnedOnly: e.target.checked })}
              className="accent-brand-500"
            />
            📌 Pinned only
          </label>
          <label className="flex items-center gap-2 mt-1 text-[12px] text-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!filters.favoritesOnly}
              onChange={(e) => onChange({ ...filters, favoritesOnly: e.target.checked })}
              className="accent-brand-500"
            />
            ⭐ Favorites only
          </label>
        </section>

        <section>
          <h5 className="text-[10px] uppercase text-slate-500 font-bold mb-1.5">Types</h5>
          <div className="flex flex-col gap-1">
            {TYPE_OPTIONS.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-[12px] text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filters.types?.includes(t.id)}
                  onChange={() => toggleType(t.id)}
                  className="accent-brand-500"
                />
                <span className="opacity-80">{t.icon}</span>
                {t.label}
              </label>
            ))}
          </div>
        </section>

        <section>
          <h5 className="text-[10px] uppercase text-slate-500 font-bold mb-1.5">Tags</h5>
          {allTags.length === 0 ? (
            <p className="text-[11px] text-slate-500">No tags yet</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {allTags.map(({ tag, n }) => {
                const active = filters.tags?.includes(tag);
                return (
                  <button
                    type="button"
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`text-[11px] rounded-full px-2 py-0.5 ring-1 transition-colors ${active ? 'bg-brand-500/30 ring-brand-400 text-brand-100' : 'bg-slate-800 ring-slate-700 text-slate-300 hover:ring-slate-500'}`}
                    title={`${tag} — ${n} item${n === 1 ? '' : 's'}`}
                  >
                    {tag} <span className="opacity-50">{n}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div className="px-3 py-2 border-t border-slate-800 flex items-center justify-between">
        <button onClick={clearAll} className="text-[11px] text-slate-400 hover:text-white">Clear all</button>
        <span className="text-[10px] text-slate-500">{items.length} items</span>
      </div>
    </aside>
  );
}
