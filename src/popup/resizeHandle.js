const MIN_H = 300;
const MAX_H = 800;
const STORAGE_KEY = 'scm_popup_height';
const DEFAULT_H = 600;

export function installResizeHandle() {
  // Restore saved height before first paint.
  try {
    chrome.storage.local.get(STORAGE_KEY, (r) => {
      const h = r?.[STORAGE_KEY];
      if (h >= MIN_H && h <= MAX_H) document.body.style.height = h + 'px';
    });
  } catch (_) { }

  const handle = document.createElement('div');
  handle.className = 'scm-resize-handle';
  document.body.appendChild(handle);

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = document.body.offsetHeight || DEFAULT_H;
    handle.classList.add('dragging');

    function onMove(ev) {
      const h = Math.min(MAX_H, Math.max(MIN_H, startH + (ev.clientY - startY)));
      document.body.style.height = h + 'px';
    }

    function onUp(ev) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      handle.classList.remove('dragging');
      const h = Math.min(MAX_H, Math.max(MIN_H, startH + (ev.clientY - startY)));
      document.body.style.height = h + 'px';
      try { chrome.storage.local.set({ [STORAGE_KEY]: h }); } catch (_) { }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
