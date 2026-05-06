/**
 * AnalyticsPanel.jsx
 *
 * A modest, modal analytics view rendered with pure CSS (no charting
 * library required). Shows totals, the most-copied item, the top tags as
 * a horizontal bar chart, a 24-hour copy heatmap, and an estimate of how
 * much storage the items currently occupy.
 */

import React, { useMemo } from 'react';

export default function AnalyticsPanel({ items, onClose }) {
  const stats = useMemo(() => computeStats(items), [items]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-auto rounded-xl bg-slate-900/95 ring-1 ring-slate-700 shadow-cardLg animate-pop"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <h3 className="text-slate-100 font-semibold text-[14px]">📊 Analytics</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm" aria-label="Close">×</button>
        </header>

        <div className="p-4 space-y-5 text-[12px] text-slate-200">
          <section className="grid grid-cols-3 gap-2">
            <Stat label="Total" value={stats.total} />
            <Stat label="Pinned" value={stats.pinned} />
            <Stat label="Storage" value={stats.storage} />
          </section>

          <section>
            <h4 className="text-[10px] uppercase tracking-wide text-slate-400 font-bold mb-2">Most copied</h4>
            {stats.mostCopied ? (
              <div className="rounded-lg bg-slate-800/60 ring-1 ring-slate-700 p-2.5">
                <p className="truncate text-slate-100">{truncate(stats.mostCopied.content || '', 90)}</p>
                <p className="text-[10px] text-slate-400 mt-1">↩ {stats.mostCopied.copyCount} copies</p>
              </div>
            ) : <p className="text-slate-500">Nothing copied yet</p>}
          </section>

          <section>
            <h4 className="text-[10px] uppercase tracking-wide text-slate-400 font-bold mb-2">Top tags</h4>
            {stats.topTags.length === 0 ? (
              <p className="text-slate-500">No tags yet</p>
            ) : (
              <div className="space-y-1.5">
                {stats.topTags.map(({ tag, count, pct }) => (
                  <div key={tag}>
                    <div className="flex items-center justify-between text-[11px] mb-0.5">
                      <span className="truncate max-w-[180px]">{tag}</span>
                      <span className="text-slate-400">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-brand-500 to-violet-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h4 className="text-[10px] uppercase tracking-wide text-slate-400 font-bold mb-2">Activity by hour</h4>
            <div className="grid grid-cols-12 gap-1">
              {stats.hourly.map((v, h) => (
                <div
                  key={h}
                  title={`${formatHour(h)}: ${v}`}
                  className="aspect-square rounded-sm"
                  style={{
                    background: heatColor(v, stats.hourlyMax)
                  }}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[9px] text-slate-500">
              <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
            </div>
          </section>

          <section className="text-[10px] text-slate-500">
            Computed locally from your clipboard history — never sent anywhere.
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-800/60 ring-1 ring-slate-700 p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-base font-semibold text-slate-100 mt-0.5">{value}</div>
    </div>
  );
}

function computeStats(items) {
  const total = items.length;
  const pinned = items.filter((i) => i.isPinned).length;

  let bytes = 0;
  for (const it of items) {
    bytes += approxBytes(it.content) + approxBytes(it.htmlContent || '') + 256;
  }

  const tagCounts = new Map();
  for (const it of items) for (const t of (it.tags || [])) {
    tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
  }
  const top5 = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const max = top5[0]?.[1] || 1;
  const topTags = top5.map(([tag, count]) => ({ tag, count, pct: Math.round((count / max) * 100) }));

  const hourly = new Array(24).fill(0);
  for (const it of items) {
    const h = new Date(it.createdAt).getHours();
    hourly[h] += 1 + (it.copyCount || 0);
  }
  const hourlyMax = Math.max(1, ...hourly);

  const mostCopied = items
    .filter((i) => (i.copyCount || 0) > 0)
    .sort((a, b) => (b.copyCount || 0) - (a.copyCount || 0))[0] || null;

  return { total, pinned, storage: humanBytes(bytes), topTags, hourly, hourlyMax, mostCopied };
}

function heatColor(v, max) {
  if (v <= 0) return 'rgba(148, 163, 184, 0.08)';
  const t = Math.min(1, v / max);
  const a = 0.15 + t * 0.75;
  return `rgba(99, 102, 241, ${a})`;
}

function approxBytes(s) {
  return typeof s === 'string' ? s.length * 2 : 0;
}
function humanBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}
function formatHour(h) { return String(h).padStart(2, '0') + ':00'; }
function truncate(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }
