/**
 * contentScript.js
 *
 * Injected into every page (matches: <all_urls>). Listens for the user's
 * `copy` events and ships a normalized payload to the background service
 * worker so the clipboard manager has an "auto-capture-on-copy" feel.
 *
 * Design constraints:
 *  - Cross-origin iframes won't deliver events here (browser security).
 *  - Image clipboard data is only available on `paste`, not `copy`, so we
 *    skip image extraction here; images are captured via the popup or via
 *    selection-context-menu.
 *  - We debounce rapid duplicates (e.g., user mashing Ctrl+C) at 300ms.
 */

(() => {
  const LOG = '[SCM:cs]';
  const DEBOUNCE_MS = 300;
  let lastSentAt = 0;
  let lastContentSig = '';

  // Avoid double-installing if the script gets re-injected.
  if (window.__SCM_CONTENT_INSTALLED__) return;
  window.__SCM_CONTENT_INSTALLED__ = true;

  /**
   * Pull text/html out of the copy event without forcing the user to
   * re-do their selection. Falls back to the active selection.
   */
  function extractFromEvent(e) {
    const out = { content: '', html: '' };
    try {
      const dt = e.clipboardData;
      if (dt) {
        out.content = dt.getData('text/plain') || '';
        out.html    = dt.getData('text/html') || '';
      }
    } catch (err) {
      console.warn(LOG, 'clipboardData read failed', err);
    }

    // Fallback to the live selection if the event didn't carry data.
    if (!out.content) {
      try {
        const sel = window.getSelection();
        if (sel && sel.toString()) out.content = sel.toString();
      } catch (_) { /* noop */ }
    }

    return out;
  }

  function send(payload) {
    try {
      chrome.runtime.sendMessage(
        {
          type: 'capture',
          ...payload,
          sourceUrl: location.href
        },
        () => {
          // Read lastError to silence Chrome's "unchecked runtime.lastError" warning.
          if (chrome.runtime.lastError) { /* swallow */ }
        }
      );
    } catch (err) {
      console.warn(LOG, 'sendMessage failed (worker may be reloading)', err);
    }
  }

  document.addEventListener('copy', (e) => {
    try {
      const { content, html } = extractFromEvent(e);
      const trimmed = (content || '').trim();
      if (!trimmed && !html) return;

      const sig = (trimmed.slice(0, 200) + '|' + (html ? '1' : '0'));
      const now = Date.now();
      if (sig === lastContentSig && now - lastSentAt < DEBOUNCE_MS) return;
      lastContentSig = sig;
      lastSentAt = now;

      send({ content: trimmed, html });
    } catch (err) {
      console.error(LOG, 'copy handler error', err);
    }
  }, true);

  // Poll for images written to the OS clipboard by external tools (Lightshot,
  // Snipping Tool, etc.). These never fire a DOM copy event, so the listener
  // above misses them. navigator.clipboard.read() needs a document context —
  // it cannot be called from the MV3 service worker — so we poll here instead.
  let lastImageHash = '';
  let pollDenied = false;

  async function hashBlob(blob) {
    const buf = await blob.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }

  async function pollClipboardForImage() {
    if (pollDenied || !document.hasFocus()) return;
    try {
      const data = await navigator.clipboard.read();
      for (const item of data) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        const hash = await hashBlob(blob);
        if (hash === lastImageHash) return;
        lastImageHash = hash;
        const dataUrl = await blobToDataURL(blob);
        send({ image: dataUrl });
        return;
      }
    } catch (err) {
      if (err?.name === 'NotAllowedError') pollDenied = true;
    }
  }

  setInterval(pollClipboardForImage, 1500);

  console.info(LOG, 'content script ready on', location.hostname);
})();
