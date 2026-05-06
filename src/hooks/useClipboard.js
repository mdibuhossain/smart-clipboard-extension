/**
 * useClipboard.js
 *
 * React hook centralizing all clipboard-item operations for the popup UI:
 *   - load all items from IndexedDB on mount
 *   - subscribe to background "item-added" broadcasts so the list stays
 *     fresh while the popup is open
 *   - copy-back, pin, favorite, delete, tag-edit, and manual-capture helpers
 *
 * Talks to the same ClipboardDB the service worker uses, so writes from
 * either side are visible to the other.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { clipboardDB } from '../db/clipboardDB.js';
import { detectType } from '../utils/typeDetector.js';
import { hashContent } from '../utils/deduplicator.js';
import { autoTag } from '../utils/autoTagger.js';

const LOG = '[SCM:useClipboard]';

export function useClipboard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  // ---- load + live updates ----
  const reload = useCallback(async () => {
    try {
      const all = await clipboardDB.getAllItems();
      if (mounted.current) setItems(all);
    } catch (err) {
      console.error(LOG, 'reload failed', err);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    reload();

    // Listen for background broadcasts of new captures.
    const handler = (msg) => {
      if (msg?.kind === 'item-added' && msg?.item) {
        setItems((prev) => {
          if (prev.some((p) => p.id === msg.item.id)) return prev;
          return [msg.item, ...prev];
        });
      }
    };

    try {
      chrome.runtime?.onMessage?.addListener(handler);
    } catch (err) {
      console.warn(LOG, 'onMessage subscribe failed', err);
    }
    return () => {
      mounted.current = false;
      try { chrome.runtime?.onMessage?.removeListener(handler); } catch (_) { /* noop */ }
    };
  }, [reload]);

  // ---- mutations ----

  const updateItem = useCallback(async (id, patch) => {
    try {
      const updated = await clipboardDB.updateItem(id, patch);
      if (!updated) return null;
      setItems((prev) => prev.map((p) => (p.id === id ? updated : p)));
      return updated;
    } catch (err) {
      console.error(LOG, 'updateItem failed', err);
      return null;
    }
  }, []);

  const deleteItem = useCallback(async (id) => {
    try {
      await clipboardDB.deleteItem(id);
      setItems((prev) => prev.filter((p) => p.id !== id));
      return true;
    } catch (err) {
      console.error(LOG, 'deleteItem failed', err);
      return false;
    }
  }, []);

  const togglePin = useCallback(
    (item) => updateItem(item.id, { isPinned: !item.isPinned }),
    [updateItem]
  );

  const toggleFavorite = useCallback(
    (item) => updateItem(item.id, { isFavorite: !item.isFavorite }),
    [updateItem]
  );

  const setTags = useCallback(
    (id, tags) => updateItem(id, { tags: dedupeTags(tags) }),
    [updateItem]
  );

  /**
   * Copy an item back to the system clipboard. Increments copy stats.
   */
  const copyToClipboard = useCallback(async (item) => {
    try {
      if (item.type === 'image' && item.content?.startsWith('data:image')) {
        const blob = await (await fetch(item.content)).blob();
        const data = [new ClipboardItem({ [blob.type]: blob })];
        await navigator.clipboard.write(data);
      } else if (item.htmlContent) {
        const blob = new Blob([item.htmlContent], { type: 'text/html' });
        const text = new Blob([item.content || ''], { type: 'text/plain' });
        await navigator.clipboard.write([
          new ClipboardItem({ 'text/html': blob, 'text/plain': text })
        ]);
      } else {
        await navigator.clipboard.writeText(item.content || '');
      }
      await updateItem(item.id, {
        copyCount: (item.copyCount || 0) + 1,
        lastCopied: Date.now()
      });
      return true;
    } catch (err) {
      console.error(LOG, 'copyToClipboard failed', err);
      return false;
    }
  }, [updateItem]);

  /**
   * Manual capture: read from system clipboard and persist.
   * Requires a user gesture in the popup (button click).
   */
  const captureFromClipboard = useCallback(async () => {
    try {
      let content = '';
      let html = '';
      let image = null;

      // Prefer rich `read()` so we can capture images + html when permitted.
      if (navigator.clipboard?.read) {
        try {
          const data = await navigator.clipboard.read();
          for (const item of data) {
            for (const t of item.types) {
              if (t === 'text/plain' && !content) {
                content = await (await item.getType(t)).text();
              } else if (t === 'text/html' && !html) {
                html = await (await item.getType(t)).text();
              } else if (t.startsWith('image/') && !image) {
                const blob = await item.getType(t);
                image = await blobToDataURL(blob);
              }
            }
          }
        } catch (err) {
          // permission may be denied; fall through to readText
          console.warn(LOG, 'clipboard.read failed, falling back', err);
        }
      }
      if (!content && !image && navigator.clipboard?.readText) {
        content = await navigator.clipboard.readText();
      }
      if (!content && !html && !image) return { ok: false, reason: 'empty' };

      const type = detectType({ content, html, image });
      const finalContent = image || content || stripHtml(html);
      const tags = autoTag({ type, content: finalContent });
      const ch = await hashContent(image || html || content);
      const item = {
        id: cryptoId(),
        type,
        content: finalContent,
        htmlContent: html || null,
        preview: type === 'image' ? finalContent : truncate(finalContent, 280),
        tags,
        isPinned: false,
        isFavorite: false,
        isEncrypted: false,
        encryptedContent: null,
        sessionGroup: `session-${Date.now()}`,
        copyCount: 0,
        lastCopied: null,
        createdAt: Date.now(),
        sourceUrl: null,
        sourceDomain: null,
        contentHash: ch,
        metadata: {
          wordCount: typeof finalContent === 'string'
            ? finalContent.trim().split(/\s+/).filter(Boolean).length
            : 0,
          charCount: typeof finalContent === 'string' ? finalContent.length : 0,
          language: null,
          colorValue: extractColor(finalContent)
        }
      };
      await clipboardDB.addItem(item);
      setItems((prev) => [item, ...prev]);
      return { ok: true, item };
    } catch (err) {
      console.error(LOG, 'captureFromClipboard failed', err);
      return { ok: false, reason: String(err?.message || err) };
    }
  }, []);

  // ---- bulk ops ----

  const clearAll = useCallback(async () => {
    try {
      await clipboardDB.clearAll();
      setItems([]);
      return true;
    } catch (err) {
      console.error(LOG, 'clearAll failed', err);
      return false;
    }
  }, []);

  const exportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    triggerDownload(blob, `smart-clipboard-${Date.now()}.json`);
  }, [items]);

  const exportMarkdown = useCallback(() => {
    const md = items.map((it) => {
      const date = new Date(it.createdAt).toISOString();
      const tags = (it.tags || []).map((t) => `\`${t}\``).join(' ');
      const head = `### ${it.type.toUpperCase()} — ${date} ${tags}`;
      if (it.type === 'image') return `${head}\n\n![image](${it.content})\n`;
      return `${head}\n\n\`\`\`\n${it.content}\n\`\`\`\n`;
    }).join('\n---\n\n');
    triggerDownload(new Blob([md], { type: 'text/markdown' }), `smart-clipboard-${Date.now()}.md`);
  }, [items]);

  const importJSON = useCallback(async (file) => {
    try {
      const text = await file.text();
      const arr = JSON.parse(text);
      if (!Array.isArray(arr)) throw new Error('Expected an array of items');
      const stats = await clipboardDB.importItems(arr);
      await reload();
      return stats;
    } catch (err) {
      console.error(LOG, 'importJSON failed', err);
      return { imported: 0, skipped: 0, error: String(err?.message || err) };
    }
  }, [reload]);

  return {
    items,
    loading,
    reload,
    updateItem,
    deleteItem,
    togglePin,
    toggleFavorite,
    setTags,
    copyToClipboard,
    captureFromClipboard,
    clearAll,
    exportJSON,
    exportMarkdown,
    importJSON
  };
}

// ---- helpers ----

function dedupeTags(tags) {
  return Array.from(new Set((tags || []).map((t) => String(t).trim()).filter(Boolean)));
}
function truncate(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; }
function stripHtml(html) { return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
function extractColor(text) {
  if (typeof text !== 'string') return null;
  const m = text.match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/i);
  return m ? `#${m[1]}` : null;
}
function cryptoId() {
  try { return crypto.randomUUID(); }
  catch { return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36); }
}
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}
