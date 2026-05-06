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

  console.info(LOG, 'content script ready on', location.hostname);
})();
