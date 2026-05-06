/**
 * Toolbar.jsx
 *
 * Top toolbar with view-mode toggle (grid/list), filter open, theme
 * toggle, capture button, and overflow "menu" exposing import/export and
 * settings. Designed to be visually quiet — actions reveal on hover.
 */

import React, { useEffect, useRef, useState } from 'react';

export default function Toolbar({
  viewMode, setViewMode,
  theme, toggleTheme,
  onOpenFilters, onOpenSettings, onOpenAnalytics,
  onCapture, onExportJSON, onExportMarkdown, onImportJSON,
  onClearAll,
  itemCount
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (f) onImportJSON?.(f);
    e.target.value = '';
  };

  return (
    <div className="flex items-center gap-1.5">
      <input ref={fileRef} type="file" accept="application/json" hidden onChange={handleFile} />

      <button
        type="button"
        onClick={onCapture}
        title="Capture from clipboard"
        className="rounded-md bg-brand-600 hover:bg-brand-500 transition-colors text-white text-[11px] font-medium px-2 py-1 shadow-soft"
      >
        + Capture
      </button>

      <div className="ml-auto flex items-center gap-1">
        <span className="text-[10px] text-slate-500 mr-1 hidden sm:inline">{itemCount} items</span>

        <button
          type="button"
          onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
          className="rounded-md p-1.5 ring-1 ring-slate-700 text-slate-300 hover:ring-slate-500 hover:text-white"
        >
          {viewMode === 'grid' ? '☰' : '▦'}
        </button>

        <button
          type="button"
          onClick={onOpenFilters}
          title="Filters"
          className="rounded-md p-1.5 ring-1 ring-slate-700 text-slate-300 hover:ring-slate-500 hover:text-white"
        >
          ⚙︎
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          className="rounded-md p-1.5 ring-1 ring-slate-700 text-slate-300 hover:ring-slate-500 hover:text-white"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            title="More"
            className="rounded-md p-1.5 ring-1 ring-slate-700 text-slate-300 hover:ring-slate-500 hover:text-white"
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-48 z-30 rounded-lg bg-slate-900/95 ring-1 ring-slate-700 shadow-cardLg animate-fadeIn overflow-hidden">
              <MenuItem onClick={() => { setMenuOpen(false); onOpenAnalytics(); }} icon="📊">Analytics</MenuItem>
              <MenuItem onClick={() => { setMenuOpen(false); onExportJSON(); }} icon="⬇️">Export JSON</MenuItem>
              <MenuItem onClick={() => { setMenuOpen(false); onExportMarkdown(); }} icon="📝">Export Markdown</MenuItem>
              <MenuItem onClick={() => { setMenuOpen(false); fileRef.current?.click(); }} icon="⬆️">Import JSON</MenuItem>
              <MenuItem onClick={() => { setMenuOpen(false); onOpenSettings(); }} icon="🛠️">Settings</MenuItem>
              <div className="border-t border-slate-800" />
              <MenuItem onClick={() => { setMenuOpen(false); onClearAll(); }} icon="🗑" danger>Clear all items</MenuItem>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MenuItem({ children, icon, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left text-[12px] px-3 py-2 flex items-center gap-2 hover:bg-slate-800/70 transition-colors ${danger ? 'text-rose-300 hover:text-rose-200' : 'text-slate-200'}`}
    >
      <span className="opacity-70 w-4 text-center">{icon}</span>
      <span>{children}</span>
    </button>
  );
}
