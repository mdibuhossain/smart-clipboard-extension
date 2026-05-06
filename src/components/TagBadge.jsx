/**
 * TagBadge.jsx
 *
 * Tiny pill component for a single tag. Color is derived deterministically
 * from the tag string so the same tag always gets the same color across
 * cards/sessions. Sensitive tags ("sensitive", "token") get a red accent.
 */

import React from 'react';

const PALETTE = [
  'bg-rose-500/15 text-rose-300 ring-rose-500/30',
  'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  'bg-teal-500/15 text-teal-300 ring-teal-500/30',
  'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  'bg-indigo-500/15 text-indigo-300 ring-indigo-500/30',
  'bg-violet-500/15 text-violet-300 ring-violet-500/30',
  'bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-500/30',
  'bg-pink-500/15 text-pink-300 ring-pink-500/30',
  'bg-cyan-500/15 text-cyan-300 ring-cyan-500/30'
];

const DANGER = 'bg-red-500/20 text-red-300 ring-red-500/40';

function colorFor(tag) {
  if (!tag) return PALETTE[0];
  if (/sensitive|token/i.test(tag)) return DANGER;
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export default function TagBadge({ tag, onRemove, onClick, compact = false }) {
  const cls = colorFor(tag);
  const base =
    'inline-flex items-center gap-1 rounded-full ring-1 ring-inset transition-colors';
  const size = compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]';
  return (
    <span
      className={`${base} ${size} ${cls} ${onClick ? 'cursor-pointer hover:brightness-125' : ''}`}
      onClick={onClick}
      title={tag}
    >
      <span className="truncate max-w-[110px]">{tag}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(tag); }}
          className="ml-0.5 leading-none opacity-60 hover:opacity-100 hover:text-white"
          aria-label={`Remove tag ${tag}`}
        >
          ×
        </button>
      )}
    </span>
  );
}
