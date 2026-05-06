/**
 * EmptyState.jsx
 *
 * Friendly placeholder shown when no clipboard items match the active
 * search/filters (or the database is brand new). Includes an inline
 * "Capture from clipboard" call to action so first-time users have a
 * low-friction starting point.
 */

import React from 'react';

export default function EmptyState({ onCapture, isFiltered = false }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-14 animate-fadeIn">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/30 to-violet-500/30 ring-1 ring-brand-400/30 flex items-center justify-center text-3xl mb-4 shadow-glow">
        📋
      </div>
      <h3 className="text-slate-100 font-semibold text-base mb-1">
        {isFiltered ? 'Nothing matches your filters' : 'Your clipboard is quiet'}
      </h3>
      <p className="text-slate-400 text-[12px] max-w-xs leading-relaxed mb-4">
        {isFiltered
          ? 'Try clearing some filters or adjusting your search.'
          : 'Copy text on any page and we\'ll capture it here automatically. You can also paste manually below.'}
      </p>
      {!isFiltered && (
        <button
          type="button"
          onClick={onCapture}
          className="inline-flex items-center gap-2 rounded-md bg-brand-600 hover:bg-brand-500 transition-colors text-white text-[12px] font-medium px-3 py-1.5 shadow-soft"
        >
          <span>📥</span>
          Capture from clipboard
        </button>
      )}
    </div>
  );
}
