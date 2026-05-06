/**
 * deduplicator.js
 *
 * Hash-based deduplication for clipboard captures. Uses Web Crypto's
 * SHA-256 when available (service worker + popup both have it), with a
 * tiny non-cryptographic fallback so we never crash a build.
 *
 * "Duplicate" semantics: same hash captured within DEDUP_WINDOW_MS of
 * the most recent occurrence. We don't permanently block re-saving the
 * same content — users may legitimately re-copy the same line later.
 */

const DEDUP_WINDOW_MS = 5 * 1000; // 5s — catches accidental double-fires

/**
 * Compute a stable string hash for a piece of clipboard content.
 * @param {string} input
 * @returns {Promise<string>}
 */
export async function hashContent(input) {
  const text = String(input || '');
  try {
    if (globalThis.crypto?.subtle) {
      const enc = new TextEncoder().encode(text);
      const buf = await crypto.subtle.digest('SHA-256', enc);
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch (err) {
    console.warn('[SCM:dedup] subtle.digest failed, using fallback', err);
  }
  return fnv1a32(text);
}

/**
 * Returns true when the same content was already saved in the recent
 * window — the caller should skip the save.
 */
export async function isDuplicate(db, hash, now = Date.now()) {
  try {
    const existing = await db.findByHash(hash);
    if (!existing) return false;
    return now - existing.createdAt < DEDUP_WINDOW_MS;
  } catch {
    return false;
  }
}

// FNV-1a 32-bit fallback (deterministic, fast, non-crypto).
function fnv1a32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ('00000000' + h.toString(16)).slice(-8);
}
