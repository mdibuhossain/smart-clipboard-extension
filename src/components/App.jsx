/**
 * App.jsx
 *
 * Root popup component. Composes the toolbar, search, filter sidebar,
 * the (virtualized) clipboard list, the command palette, the analytics
 * panel, and the settings modal. Wires everything to the data hooks.
 *
 * Keyboard shortcuts (handled here, popup-wide):
 *   ⌘K / Ctrl+K → open Command Palette
 *   ↑ / ↓       → move card focus
 *   Enter       → copy focused card
 *   Delete      → delete focused card
 *   P           → pin/unpin focused card
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import SearchBar from './SearchBar.jsx';
import Toolbar from './Toolbar.jsx';
import FilterPanel from './FilterPanel.jsx';
import ClipboardCard from './ClipboardCard.jsx';
import CommandPalette from './CommandPalette.jsx';
import EmptyState from './EmptyState.jsx';
import AnalyticsPanel from './AnalyticsPanel.jsx';
import SettingsModal from './SettingsModal.jsx';
import { useClipboard } from '../hooks/useClipboard.js';
import { useSearch } from '../hooks/useSearch.js';
import { useTheme } from '../hooks/useTheme.js';
import { ToastProvider, useToast } from './Toast.jsx';

function AppShell() {
  const {
    items, loading, reload,
    deleteItem, togglePin, toggleFavorite, setTags,
    copyToClipboard, captureFromClipboard,
    clearAll, exportJSON, exportMarkdown, importJSON
  } = useClipboard();

  const { theme, toggleTheme } = useTheme();
  const { push } = useToast();

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ types: [], tags: [], pinnedOnly: false, favoritesOnly: false });
  const [viewMode, setViewMode] = useState('list');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const listRef = useRef(null);

  const { results } = useSearch(items, query, filters);

  // Group by sessionGroup → array of [sessionKey, items[]] for rendering.
  const grouped = useMemo(() => groupBySession(results), [results]);

  // All known tags for the inline TagEditor's suggestion dropdown.
  const allTags = useMemo(() => {
    const set = new Set();
    for (const it of items) for (const t of (it.tags || [])) set.add(t);
    return Array.from(set);
  }, [items]);

  // Reset focus when filters/query change
  useEffect(() => { setFocusIndex(0); }, [query, filters.types, filters.tags, filters.pinnedOnly, filters.favoritesOnly]);

  // ----- keyboard shortcuts -----
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      const inEditable = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;

      // ⌘K / Ctrl+K — always opens palette, even from inputs.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (paletteOpen || analyticsOpen || settingsOpen) return;
      if (inEditable) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIndex((i) => Math.min(results.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        const item = results[focusIndex];
        if (item) handleCopy(item);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const item = results[focusIndex];
        if (item) handleDelete(item.id);
      } else if (e.key === 'p' || e.key === 'P') {
        const item = results[focusIndex];
        if (item) togglePin(item);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, focusIndex, paletteOpen, analyticsOpen, settingsOpen]);

  const handleCopy = async (item) => {
    const ok = await copyToClipboard(item);
    push(ok ? 'Copied to clipboard!' : 'Copy failed', { kind: ok ? 'success' : 'error' });
  };

  const handleDelete = async (id) => {
    const ok = await deleteItem(id);
    if (ok) push('Item deleted', { kind: 'info' });
  };

  const handleManualCapture = async () => {
    const r = await captureFromClipboard();
    if (r.ok) push('Captured!', { kind: 'success' });
    else if (r.reason === 'empty') push('Clipboard is empty', { kind: 'warn' });
    else push('Could not read clipboard. Click in the popup first.', { kind: 'error' });
  };

  const handleClearAll = async () => {
    if (!confirm('Delete every item permanently? This cannot be undone.')) return;
    await clearAll();
    push('All items cleared', { kind: 'info' });
  };

  const handleImport = async (file) => {
    const stats = await importJSON(file);
    if (stats.error) push(`Import failed: ${stats.error}`, { kind: 'error' });
    else push(`Imported ${stats.imported}, skipped ${stats.skipped}`, { kind: 'success' });
  };

  return (
    <div className="relative h-full w-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* Header */}
      <header className="px-3 pt-3 pb-2 border-b border-slate-800 bg-slate-950/95 backdrop-blur sticky top-0 z-20">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center text-sm shadow-soft">📋</div>
            <div className="leading-tight">
              <div className="text-[12px] font-semibold">Smart Clipboard</div>
              <div className="text-[9px] text-slate-400">Manager</div>
            </div>
          </div>
          <div className="flex-1" />
          <Toolbar
            viewMode={viewMode} setViewMode={setViewMode}
            theme={theme} toggleTheme={toggleTheme}
            onOpenFilters={() => setFiltersOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenAnalytics={() => setAnalyticsOpen(true)}
            onCapture={handleManualCapture}
            onExportJSON={exportJSON}
            onExportMarkdown={exportMarkdown}
            onImportJSON={handleImport}
            onClearAll={handleClearAll}
            itemCount={items.length}
          />
        </div>
        <SearchBar value={query} onChange={setQuery} onOpenPalette={() => setPaletteOpen(true)} />
        {(filters.types.length > 0 || filters.tags.length > 0 || filters.pinnedOnly || filters.favoritesOnly) && (
          <div className="mt-2 flex items-center gap-1 flex-wrap">
            <span className="text-[10px] text-slate-400">Active:</span>
            {filters.pinnedOnly && <Chip onClear={() => setFilters({ ...filters, pinnedOnly: false })}>📌 pinned</Chip>}
            {filters.favoritesOnly && <Chip onClear={() => setFilters({ ...filters, favoritesOnly: false })}>⭐ favorites</Chip>}
            {filters.types.map((t) => (
              <Chip key={`t-${t}`} onClear={() => setFilters({ ...filters, types: filters.types.filter((x) => x !== t) })}>{t}</Chip>
            ))}
            {filters.tags.map((t) => (
              <Chip key={`tag-${t}`} onClear={() => setFilters({ ...filters, tags: filters.tags.filter((x) => x !== t) })}>#{t}</Chip>
            ))}
          </div>
        )}
      </header>

      {/* Body */}
      <main ref={listRef} className="relative flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <SkeletonList count={3} />
        ) : results.length === 0 ? (
          <EmptyState onCapture={handleManualCapture} isFiltered={!!query || filters.tags.length > 0 || filters.types.length > 0 || filters.pinnedOnly || filters.favoritesOnly} />
        ) : (
          <VirtualGroups
            grouped={grouped}
            viewMode={viewMode}
            allTags={allTags}
            focusIndex={focusIndex}
            query={query}
            results={results}
            onCopy={handleCopy}
            onTogglePin={togglePin}
            onToggleFavorite={toggleFavorite}
            onChangeTags={setTags}
            onDelete={handleDelete}
            onClick={(it) => setFocusIndex(results.findIndex((r) => r.id === it.id))}
          />
        )}
      </main>

      {/* Footer with shortcut hints */}
      <footer className="border-t border-slate-800 px-3 py-1.5 text-[10px] text-slate-500 flex items-center gap-3">
        <Kbd>⌘K</Kbd>palette
        <Kbd>↑↓</Kbd>nav
        <Kbd>↵</Kbd>copy
        <Kbd>P</Kbd>pin
        <Kbd>Del</Kbd>delete
        <span className="ml-auto">v1.0.0</span>
      </footer>

      {filtersOpen && (
        <FilterPanel items={items} filters={filters} onChange={setFilters} onClose={() => setFiltersOpen(false)} />
      )}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={items} onCopy={handleCopy} />
      {analyticsOpen && <AnalyticsPanel items={items} onClose={() => setAnalyticsOpen(false)} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} onSettingsChanged={() => reload()} />}
    </div>
  );
}

/**
 * Renders grouped session blocks. A poor-man's windowing approach: we
 * only mount cards for groups that are currently expanded — sessions
 * older than the first three are collapsed by default.
 */
function VirtualGroups({
  grouped, viewMode, allTags, focusIndex, query, results,
  onCopy, onTogglePin, onToggleFavorite, onChangeTags, onDelete, onClick
}) {
  const [collapsed, setCollapsed] = useState(() => {
    const out = new Set();
    grouped.forEach((g, idx) => { if (idx > 2) out.add(g.key); });
    return out;
  });

  const toggle = (key) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {grouped.map((group) => {
        const isCollapsed = collapsed.has(group.key);
        const span = formatRange(group.start, group.end);
        return (
          <section key={group.key}>
            <button
              type="button"
              onClick={() => toggle(group.key)}
              className="w-full flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-500 hover:text-slate-300 mb-1.5"
            >
              <span>{isCollapsed ? '▸' : '▾'}</span>
              <span>{span}</span>
              <span className="opacity-60">·</span>
              <span>{group.items.length} items</span>
              <span className="flex-1 h-px bg-slate-800 ml-2" />
            </button>
            {!isCollapsed && (
              <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-2.5' : 'flex flex-col gap-2'}>
                {group.items.map((it) => {
                  const idx = results.findIndex((r) => r.id === it.id);
                  return (
                    <ClipboardCard
                      key={it.id}
                      item={it}
                      layout={viewMode}
                      query={query}
                      allTags={allTags}
                      isFocused={idx === focusIndex}
                      onCopy={onCopy}
                      onTogglePin={onTogglePin}
                      onToggleFavorite={onToggleFavorite}
                      onChangeTags={onChangeTags}
                      onDelete={onDelete}
                      onClick={onClick}
                    />
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function groupBySession(items) {
  const map = new Map();
  for (const it of items) {
    const key = it.sessionGroup || `single-${it.id}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(it);
  }
  // Build groups, sorted by latest createdAt within group
  const groups = Array.from(map.entries()).map(([key, arr]) => {
    arr.sort((a, b) => b.createdAt - a.createdAt);
    return {
      key,
      items: arr,
      start: arr[arr.length - 1].createdAt,
      end:   arr[0].createdAt
    };
  });
  groups.sort((a, b) => b.end - a.end);
  return groups;
}

function formatRange(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  const today = new Date().toDateString() === s.toDateString();
  if (today) {
    return start === end
      ? s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : `${s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (sameDay) return s.toLocaleDateString();
  return `${s.toLocaleDateString()} – ${e.toLocaleDateString()}`;
}

function Chip({ children, onClear }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 ring-1 ring-slate-700 px-2 py-0.5 text-[10px] text-slate-200">
      {children}
      <button onClick={onClear} className="opacity-60 hover:opacity-100">×</button>
    </span>
  );
}

function Kbd({ children }) {
  return <span className="font-mono ring-1 ring-slate-700 rounded px-1 py-0.5 mr-1">{children}</span>;
}

function SkeletonList({ count }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl bg-slate-900/70 ring-1 ring-slate-800 p-3">
          <div className="h-3 w-1/3 rounded bg-slate-800/80 animate-shimmer bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-[length:400px_100%]" />
          <div className="mt-2 h-3 w-full rounded bg-slate-800/80 animate-shimmer bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-[length:400px_100%]" />
          <div className="mt-1 h-3 w-2/3 rounded bg-slate-800/80 animate-shimmer bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-[length:400px_100%]" />
        </div>
      ))}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}
