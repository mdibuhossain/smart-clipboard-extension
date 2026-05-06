/**
 * background.js
 *
 * Service worker for Smart Clipboard Manager (Manifest V3).
 *
 * Responsibilities:
 *  - Receive captured clipboard payloads from contentScript.js and persist
 *    them to IndexedDB via the shared clipboardDB module.
 *  - Register and handle the "Save to Clipboard Manager" right-click context
 *    menu so users can save selected text without going through the system
 *    clipboard.
 *  - Schedule a daily alarm that prunes items older than the user's
 *    configured retention window (default 30 days).
 *  - Expose a small message-based RPC so the popup UI can talk to the same
 *    persistence layer the service worker uses (single source of truth).
 *
 * NOTE on MV3 ephemerality: this worker may be torn down at any time. All
 * state is persisted to IndexedDB / chrome.storage; nothing is kept in
 * memory across invocations.
 */

import { ClipboardDB } from '../db/clipboardDB.js';
import { detectType } from '../utils/typeDetector.js';
import { hashContent, isDuplicate } from '../utils/deduplicator.js';
import { autoTag } from '../utils/autoTagger.js';
import { compressImageDataUrl } from '../utils/compressor.js';

// -------- Constants --------
const LOG = '[SCM:bg]';
const CONTEXT_MENU_ID = 'scm-save-selection';
const CLEANUP_ALARM = 'scm-cleanup-old-items';
const DEFAULT_RETENTION_DAYS = 30;
const SESSION_WINDOW_MS = 5 * 60 * 1000; // 5 min — matches UI grouping rule

// Lazy-instantiated DB (worker may suspend/wake between events).
let dbInstance = null;
async function getDB() {
  if (!dbInstance) {
    dbInstance = new ClipboardDB();
    await dbInstance.open();
  }
  return dbInstance;
}

// Compute a session group key — items copied within SESSION_WINDOW_MS share one.
async function pickSessionGroup(db, now) {
  try {
    const recent = await db.getMostRecent(1);
    if (recent.length > 0 && now - recent[0].createdAt < SESSION_WINDOW_MS) {
      return recent[0].sessionGroup;
    }
  } catch (err) {
    console.error(LOG, 'session lookup failed', err);
  }
  return `session-${now}`;
}

/**
 * Build a canonical clipboard item from raw capture data, then persist.
 * Returns the saved item (or null when deduplicated).
 */
async function saveCapture(payload) {
  try {
    const db = await getDB();
    const now = Date.now();
    let { content = '', html = '', image = null, sourceUrl = null } = payload || {};

    if (!content && !html && !image) {
      console.warn(LOG, 'empty capture, ignoring');
      return null;
    }

    // Optionally compress images to keep IndexedDB lean.
    if (image && image.startsWith('data:image')) {
      try {
        image = await compressImageDataUrl(image, 200 * 1024); // ≤ 200 KB
      } catch (err) {
        console.warn(LOG, 'image compression failed, storing original', err);
      }
    }

    const rawForHash = image || html || content;
    const contentHash = await hashContent(rawForHash);

    // Skip if we just stored the same content very recently.
    if (await isDuplicate(db, contentHash, now)) {
      console.info(LOG, 'duplicate ignored');
      return null;
    }

    const type = detectType({ content, html, image });
    const sourceDomain = (() => {
      try { return sourceUrl ? new URL(sourceUrl).hostname : null; }
      catch { return null; }
    })();

    const finalContent = image || content || stripHtml(html);
    const previewSource = image || finalContent;
    const tags = autoTag({ type, content: finalContent, sourceDomain });
    const sessionGroup = await pickSessionGroup(db, now);

    const item = {
      id: cryptoRandomId(),
      type,
      content: finalContent,
      htmlContent: html || null,
      preview: buildPreview(previewSource, type),
      tags,
      isPinned: false,
      isFavorite: false,
      isEncrypted: false,
      encryptedContent: null,
      sessionGroup,
      copyCount: 0,
      lastCopied: null,
      createdAt: now,
      sourceUrl,
      sourceDomain,
      contentHash,
      metadata: {
        wordCount: typeof finalContent === 'string' ? finalContent.trim().split(/\s+/).filter(Boolean).length : 0,
        charCount: typeof finalContent === 'string' ? finalContent.length : 0,
        language: null,
        colorValue: extractColor(finalContent)
      }
    };

    await db.addItem(item);
    console.info(LOG, 'saved item', item.id, type, tags);
    notifyPopup({ kind: 'item-added', item });
    return item;
  } catch (err) {
    console.error(LOG, 'saveCapture failed', err);
    return null;
  }
}

// Strip HTML tags so plain-text searches still work for HTML captures.
function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Build a UI-safe preview: keep images as-is, truncate long text.
function buildPreview(source, type) {
  if (type === 'image') return source; // data URL fits as-is
  const max = 280;
  const s = String(source || '');
  return s.length > max ? s.slice(0, max) + '…' : s;
}

// Optional color extraction — surfaces a swatch on cards for design clips.
function extractColor(text) {
  if (typeof text !== 'string') return null;
  const m = text.match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/i);
  return m ? `#${m[1]}` : null;
}

// MV3 service workers have crypto.randomUUID(); fallback for older runtimes.
function cryptoRandomId() {
  try { return crypto.randomUUID(); }
  catch {
    return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

// Best-effort broadcast to any open popup. Errors are swallowed because
// Chrome throws when no listener (popup closed).
function notifyPopup(message) {
  try {
    chrome.runtime.sendMessage(message).catch(() => { /* popup not open */ });
  } catch (_) { /* noop */ }
}

// -------- Lifecycle: install / startup / context menu / alarms --------

chrome.runtime.onInstalled.addListener(() => {
  console.info(LOG, 'onInstalled — registering context menu and alarms');
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: 'Save to Clipboard Manager',
    contexts: ['selection']
  }, () => {
    if (chrome.runtime.lastError) {
      console.warn(LOG, 'contextMenu create:', chrome.runtime.lastError.message);
    }
  });

  chrome.alarms.create(CLEANUP_ALARM, {
    delayInMinutes: 60,
    periodInMinutes: 60 * 24 // daily
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;
  if (!info.selectionText) return;
  await saveCapture({
    content: info.selectionText,
    sourceUrl: tab?.url || null
  });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== CLEANUP_ALARM) return;
  try {
    const settings = await chrome.storage.local.get('settings');
    const days = settings?.settings?.retentionDays ?? DEFAULT_RETENTION_DAYS;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const db = await getDB();
    const removed = await db.deleteOlderThan(cutoff);
    console.info(LOG, `cleanup removed ${removed} items older than ${days} days`);
  } catch (err) {
    console.error(LOG, 'cleanup failed', err);
  }
});

// -------- RPC: popup <-> background (and content script -> background) --------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Always async — we return true to keep the channel open.
  (async () => {
    try {
      switch (msg?.type) {
        case 'capture': {
          const item = await saveCapture({
            content: msg.content,
            html: msg.html,
            image: msg.image,
            sourceUrl: msg.sourceUrl || sender?.tab?.url || null
          });
          sendResponse({ ok: true, item });
          return;
        }
        case 'list-items': {
          const db = await getDB();
          const items = await db.getAllItems();
          sendResponse({ ok: true, items });
          return;
        }
        case 'delete-item': {
          const db = await getDB();
          await db.deleteItem(msg.id);
          sendResponse({ ok: true });
          return;
        }
        case 'update-item': {
          const db = await getDB();
          const updated = await db.updateItem(msg.id, msg.patch);
          sendResponse({ ok: true, item: updated });
          return;
        }
        case 'clear-all': {
          const db = await getDB();
          await db.clearAll();
          sendResponse({ ok: true });
          return;
        }
        case 'import-items': {
          const db = await getDB();
          const stats = await db.importItems(msg.items || []);
          sendResponse({ ok: true, stats });
          return;
        }
        case 'ping':
          sendResponse({ ok: true, pong: true });
          return;
        default:
          sendResponse({ ok: false, error: `unknown message type: ${msg?.type}` });
      }
    } catch (err) {
      console.error(LOG, 'message handler error', msg, err);
      sendResponse({ ok: false, error: String(err?.message || err) });
    }
  })();
  return true; // keep sendResponse async
});

console.info(LOG, 'service worker loaded');
