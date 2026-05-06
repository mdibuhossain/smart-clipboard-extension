/**
 * ClipboardCard.jsx
 *
 * One clipboard item rendered as a card. Two layouts (grid + list) share
 * the same content with slightly different padding/typography.
 *
 * Behavior:
 *   - Click the big preview area or "Copy" button to copy back.
 *   - Pin (top-right) to keep it on top.
 *   - Favorite (heart) to mark as a keeper.
 *   - Inline tag editor (delete `×`, add via Enter).
 *   - Delete shows on hover.
 *   - Encrypted items show a lock and prompt for the passphrase via the
 *     parent (we just call onCopy / onView and let it decide).
 */

import React, { useMemo, useState } from 'react';
import TagEditor from './TagEditor.jsx';
import { buildHighlights } from '../hooks/useSearch.js';

const TYPE_ICONS = {
  text:  '📝',
  url:   '🔗',
  code:  '💻',
  image: '🖼️',
  emoji: '😀',
  html:  '🧩'
};

export default function ClipboardCard({
  item,
  layout = 'grid',
  query = '',
  allTags = [],
  isFocused = false,
  onCopy,
  onTogglePin,
  onToggleFavorite,
  onDelete,
  onChangeTags,
  onClick
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const segments = useMemo(
    () => buildHighlights(layout === 'list' ? truncate(item.content || '', 220) : item.preview || '', query),
    [item.content, item.preview, query, layout]
  );

  const dateLabel = useMemo(() => relativeTime(item.createdAt), [item.createdAt]);
  const isImage = item.type === 'image';
  const isCode = item.type === 'code';
  const isUrl = item.type === 'url';
  const isSensitive = (item.tags || []).includes('sensitive');

  const handleCopy = (e) => {
    e?.stopPropagation();
    onCopy?.(item);
  };

  return (
    <article
      onClick={() => onClick?.(item)}
      className={`group relative rounded-xl ring-1 transition-all cursor-pointer animate-fadeIn
        ${isFocused
          ? 'ring-brand-400 bg-slate-800/80 shadow-glow'
          : 'ring-slate-800 bg-slate-900/70 hover:ring-slate-600 hover:bg-slate-800/60'}
        ${layout === 'grid' ? 'p-3' : 'p-3 flex gap-3 items-start'}`}
    >
      {/* Type icon column for list layout */}
      {layout === 'list' && (
        <div className="text-xl pt-0.5 select-none">{TYPE_ICONS[item.type] || '📦'}</div>
      )}

      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-start gap-2 mb-1.5">
          {layout === 'grid' && (
            <span className="text-base leading-none mt-0.5 select-none">{TYPE_ICONS[item.type] || '📦'}</span>
          )}
          <div className="flex-1 min-w-0 flex items-center gap-1.5 text-[10px] text-slate-500">
            {item.sourceDomain && (
              <span className="inline-flex items-center gap-1 truncate">
                <FaviconBubble domain={item.sourceDomain} />
                <span className="truncate max-w-[90px]">{item.sourceDomain}</span>
              </span>
            )}
            <span className="opacity-50">·</span>
            <span title={new Date(item.createdAt).toLocaleString()}>{dateLabel}</span>
            {item.copyCount > 0 && (
              <>
                <span className="opacity-50">·</span>
                <span title={`Copied ${item.copyCount} time${item.copyCount === 1 ? '' : 's'}`}
                      className="rounded-full bg-slate-800 ring-1 ring-slate-700 px-1.5">
                  ↩ {item.copyCount}
                </span>
              </>
            )}
            {item.isEncrypted && <span title="Encrypted" className="text-amber-400">🔒</span>}
          </div>
          <div className="flex items-center gap-1">
            <IconButton
              title={item.isFavorite ? 'Unfavorite' : 'Favorite'}
              onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(item); }}
            >
              {item.isFavorite ? '⭐' : '☆'}
            </IconButton>
            <IconButton
              title={item.isPinned ? 'Unpin' : 'Pin'}
              onClick={(e) => { e.stopPropagation(); onTogglePin?.(item); }}
              className={item.isPinned ? 'text-amber-300' : ''}
            >
              📌
            </IconButton>
          </div>
        </div>

        {/* Body */}
        <div className="mb-2">
          {isImage ? (
            <div className="rounded-md overflow-hidden ring-1 ring-slate-800 max-h-32 flex items-center justify-center bg-slate-950">
              <img
                loading="lazy"
                src={item.preview || item.content}
                alt="clipboard"
                className="max-h-32 w-auto object-contain"
              />
            </div>
          ) : isUrl ? (
            <a
              href={item.content}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="block text-[12px] text-brand-300 hover:text-brand-200 underline-offset-2 hover:underline truncate"
              title={item.content}
            >
              {renderHighlights(segments)}
            </a>
          ) : (
            <pre className={`whitespace-pre-wrap break-words text-[12px] leading-snug max-h-28 overflow-hidden ${isCode ? 'font-mono bg-slate-950/60 p-2 rounded-md ring-1 ring-slate-800 text-slate-200' : 'text-slate-200'}`}>
              {renderHighlights(segments)}
            </pre>
          )}

          {isSensitive && (
            <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-rose-300 bg-rose-500/10 ring-1 ring-rose-500/40 rounded px-1.5 py-0.5">
              ⚠ Possibly sensitive
            </div>
          )}
        </div>

        {/* Tags */}
        <div onClick={(e) => e.stopPropagation()}>
          <TagEditor
            tags={item.tags || []}
            onChange={(tags) => onChangeTags?.(item.id, tags)}
            suggestions={allTags}
          />
        </div>

        {/* Actions */}
        <div className="mt-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 rounded-md bg-brand-600 hover:bg-brand-500 transition-colors text-white text-[11px] font-medium px-2 py-1 shadow-soft"
          >
            ⧉ Copy
          </button>
          {!confirmDelete ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity rounded-md text-[11px] text-slate-400 hover:text-rose-300 px-2 py-1"
            >
              Delete
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete?.(item.id); }}
                className="rounded-md bg-rose-600 hover:bg-rose-500 text-white px-2 py-1"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                className="rounded-md bg-slate-800 ring-1 ring-slate-700 text-slate-300 px-2 py-1 hover:ring-slate-500"
              >
                Cancel
              </button>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function IconButton({ children, onClick, title, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`opacity-60 hover:opacity-100 text-[12px] leading-none rounded-md p-1 hover:bg-slate-800/60 ${className}`}
    >
      {children}
    </button>
  );
}

function FaviconBubble({ domain }) {
  return (
    <img
      loading="lazy"
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`}
      alt=""
      width={12}
      height={12}
      className="rounded-sm"
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
    />
  );
}

function renderHighlights(segments) {
  return segments.map((seg, i) =>
    seg.match
      ? <mark key={i} className="bg-brand-500/40 text-white rounded px-0.5">{seg.text}</mark>
      : <React.Fragment key={i}>{seg.text}</React.Fragment>
  );
}

function truncate(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; }

function relativeTime(ts) {
  const diff = Date.now() - ts;
  const sec = Math.round(diff / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} d ago`;
  return new Date(ts).toLocaleDateString();
}
