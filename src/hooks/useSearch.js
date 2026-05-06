/**
 * useSearch.js
 *
 * Debounced fuzzy search + multi-axis filter hook for the clipboard list.
 *
 * Inputs:
 *   - items: full list of clipboard items
 *   - query: free-text query (matched against content / tags / sourceUrl)
 *   - filters: { types: string[], tags: string[], pinnedOnly: boolean,
 *                favoritesOnly: boolean }
 *
 * Output:
 *   - results: ranked matches with `_score` and `_matches` annotations
 *
 * Ranking heuristic (highest first):
 *   pinned    → +200
 *   favorite  → +50
 *   exact substring match in content → +120
 *   fuzzy character match            → ≤ +90
 *   tag exact match                  → +60
 *   recency  (newer is better)       → up to +40
 *   copy frequency                   → up to +30
 */

import { useEffect, useMemo, useState } from 'react';

const DEBOUNCE_MS = 150;

export function useSearch(items, rawQuery, filters = {}) {
  const [query, setQuery] = useState('');

  // Debounce the input so typing isn't laggy on huge lists.
  useEffect(() => {
    const t = setTimeout(() => setQuery((rawQuery || '').trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [rawQuery]);

  const results = useMemo(() => {
    const q = (query || '').toLowerCase();
    const types = new Set(filters.types || []);
    const tags = new Set(filters.tags || []);
    const pinnedOnly = !!filters.pinnedOnly;
    const favoritesOnly = !!filters.favoritesOnly;

    const now = Date.now();
    const week = 7 * 24 * 60 * 60 * 1000;

    const scored = [];
    for (const item of items) {
      // -- filter gates --
      if (types.size > 0 && !types.has(item.type)) continue;
      if (pinnedOnly && !item.isPinned) continue;
      if (favoritesOnly && !item.isFavorite) continue;
      if (tags.size > 0) {
        const has = (item.tags || []).some((t) => tags.has(t));
        if (!has) continue;
      }

      let score = 0;
      const matches = [];

      // -- query scoring --
      if (q) {
        const content = (item.content || '').toLowerCase();
        const url = (item.sourceUrl || '').toLowerCase();
        const tagStr = (item.tags || []).join(' ').toLowerCase();

        const hitContent = content.indexOf(q);
        const hitUrl = url.indexOf(q);
        const hitTag = tagStr.indexOf(q);

        if (hitContent === -1 && hitUrl === -1 && hitTag === -1) {
          // Allow a soft fuzzy match for short queries.
          const fz = fuzzyScore(q, content);
          if (fz === 0) continue;
          score += fz;
          matches.push({ field: 'content', kind: 'fuzzy' });
        } else {
          if (hitContent >= 0) { score += 120 - Math.min(80, hitContent); matches.push({ field: 'content', index: hitContent, len: q.length }); }
          if (hitUrl >= 0)     { score += 70  - Math.min(40, hitUrl);     matches.push({ field: 'url',     index: hitUrl,     len: q.length }); }
          if (hitTag >= 0)     { score += 60;                              matches.push({ field: 'tag',     index: hitTag,     len: q.length }); }
        }

        // Exact tag hit gets an extra bump.
        if ((item.tags || []).some((t) => String(t).toLowerCase() === q)) score += 60;
      }

      // -- weight: pinned, favorite, recency, copies --
      if (item.isPinned)    score += 200;
      if (item.isFavorite)  score += 50;
      const age = Math.max(0, now - (item.createdAt || 0));
      score += Math.max(0, 40 - Math.floor(age / (week / 40))); // up to +40 if very recent
      score += Math.min(30, item.copyCount || 0);

      scored.push({ ...item, _score: score, _matches: matches });
    }

    // Stable sort: score desc, then createdAt desc as tie-break.
    scored.sort((a, b) => (b._score - a._score) || (b.createdAt - a.createdAt));
    return scored;
  }, [items, query, filters.types, filters.tags, filters.pinnedOnly, filters.favoritesOnly]);

  return { results, debouncedQuery: query };
}

/**
 * Tiny subsequence "fuzzy" scorer — checks all chars of `needle` appear
 * in `haystack` in order. Returns 0 (no match) up to ~90.
 */
function fuzzyScore(needle, haystack) {
  if (!needle) return 0;
  let i = 0;
  let lastIndex = -1;
  let gaps = 0;
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (haystack[j] === needle[i]) {
      if (lastIndex >= 0) gaps += j - lastIndex - 1;
      lastIndex = j;
      i++;
    }
  }
  if (i < needle.length) return 0;
  // Tighter sequences score higher.
  return Math.max(10, 90 - Math.min(80, gaps));
}

/**
 * Highlight helper: returns content broken into [text, isMatch] segments
 * for a given query. Used by ClipboardCard / CommandPalette to render
 * highlighted spans.
 */
export function buildHighlights(text, query) {
  if (!query) return [{ text, match: false }];
  const lower = (text || '').toLowerCase();
  const q = query.toLowerCase();
  const out = [];
  let cursor = 0;
  let i = lower.indexOf(q, cursor);
  while (i >= 0) {
    if (i > cursor) out.push({ text: text.slice(cursor, i), match: false });
    out.push({ text: text.slice(i, i + q.length), match: true });
    cursor = i + q.length;
    i = lower.indexOf(q, cursor);
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), match: false });
  return out;
}
