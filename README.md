# Smart Clipboard Manager

A production-grade Chrome Extension (Manifest V3) that captures, tags,
searches, and re-copies your clipboard content with a Notion/Raycast-inspired
UI. Built with React 18, Vite, Tailwind CSS, and IndexedDB. Runs entirely
on-device — no servers, no telemetry.

## Highlights

- Auto-capture clipboard content on `copy` events from any tab
- Right-click "Save to Clipboard Manager" for selected text
- Manual capture button reads from the system clipboard on demand
- Intelligent rule-based auto-tagging (URLs, code, emoji, color, sensitive…)
- Type detection: text, url, code (with language guess), emoji, image, html
- Hash-based deduplication to avoid clutter from repeated copies
- IndexedDB storage via the lightweight `idb` library
- Fuzzy search with weighted ranking (pinned > recent > frequency)
- ⌘K / Ctrl+K command palette with keyboard navigation
- Inline tag editor with suggestions from your existing tag pool
- Pin, favorite, copy-count, encrypt-sensitive, dark/light themes
- Session grouping (5-minute windows) collapsible by header
- Local analytics: top tags, hourly heatmap, storage estimate
- Optional AES-GCM encryption for items tagged "sensitive"
- Export to JSON or Markdown, import-with-merge from JSON
- Daily auto-cleanup of items older than configurable retention window

## Prerequisites

- Node.js 18 or newer
- npm 9+ (or pnpm / yarn — substitute commands as needed)
- Chrome 110+ (any Chromium-based browser supporting Manifest V3)

## Installation

```bash
npm install
```

## Development build

A watch-mode build that rebuilds the `dist/` folder on every save:

```bash
npm run dev
```

## Production build

```bash
npm run build
```

Both commands emit a Chrome-loadable `dist/` folder containing the
`manifest.json`, the bundled popup, the background service worker, and the
content script.

## Loading the extension into Chrome

1. Open `chrome://extensions`
2. Toggle **Developer mode** in the top-right corner
3. Click **Load unpacked**
4. Select the `dist/` folder produced by the build
5. Pin the extension to your toolbar for easy access (the puzzle-piece icon
   in the Chrome toolbar)

## Folder structure

```
SmartClipboardManager/
├── manifest.json                      # Chrome MV3 manifest
├── package.json                       # npm dependencies and scripts
├── vite.config.js                     # multi-entry Vite build configuration
├── tailwind.config.js                 # Tailwind theme + content paths
├── postcss.config.js                  # PostCSS pipeline (Tailwind + autoprefix)
├── .gitignore
├── README.md                          # this file
│
├── public/
│   ├── icon16.png                     # toolbar icon
│   ├── icon48.png                     # extension page icon
│   └── icon128.png                    # web store icon
│
└── src/
    ├── background/
    │   └── background.js              # MV3 service worker — context menu, alarms, RPC
    │
    ├── content/
    │   └── contentScript.js           # injected on all_urls — listens for copy events
    │
    ├── db/
    │   └── clipboardDB.js             # idb wrapper with CRUD, indices, dedup
    │
    ├── utils/
    │   ├── typeDetector.js            # text/url/emoji/image/code/html classification
    │   ├── deduplicator.js            # SHA-256 content hashing + duplicate window
    │   ├── compressor.js              # OffscreenCanvas image compression
    │   └── autoTagger.js              # rule-based tag generation
    │
    ├── hooks/
    │   ├── useClipboard.js            # data hook: list, mutate, copy back, export
    │   ├── useSearch.js               # debounced fuzzy search + ranking
    │   └── useTheme.js                # dark/light persisted via chrome.storage
    │
    ├── components/
    │   ├── App.jsx                    # popup root + keyboard shortcuts
    │   ├── CommandPalette.jsx         # ⌘K spotlight overlay
    │   ├── ClipboardCard.jsx          # individual item card
    │   ├── TagBadge.jsx               # colored tag pill
    │   ├── TagEditor.jsx              # inline add/remove tags
    │   ├── SearchBar.jsx              # primary search input
    │   ├── FilterPanel.jsx            # sliding filter sidebar
    │   ├── Toast.jsx                  # toast provider + hook
    │   ├── Toolbar.jsx                # view-mode toggle, theme, overflow menu
    │   ├── EmptyState.jsx             # empty/filtered placeholder
    │   ├── AnalyticsPanel.jsx         # local analytics modal
    │   └── SettingsModal.jsx          # encryption + retention settings
    │
    ├── popup/
    │   ├── popup.html                 # shell HTML (CSP set inline)
    │   ├── popup.jsx                  # mounts <App /> into #scm-root
    │   └── popup.css                  # popup-only sizing + scrollbar polish
    │
    └── styles/
        └── globals.css                # Tailwind base + custom variables
```

## Keyboard shortcuts

| Shortcut       | Action                          |
|----------------|---------------------------------|
| `⌘K` / `Ctrl+K`| Open the command palette        |
| `↑` / `↓`      | Move card focus                 |
| `Enter`        | Copy the focused card           |
| `Delete`       | Delete the focused card         |
| `P`            | Pin / unpin the focused card    |
| `Esc`          | Close any open modal/palette    |

The toolbar action also supports a global Chrome command:
`Ctrl+Shift+V` (or `Cmd+Shift+V` on macOS) opens the extension popup.

## Permissions

The manifest requests:

- `clipboardRead` / `clipboardWrite` — manual capture and copy back
- `storage` — settings (retention window, theme, encryption hash)
- `activeTab` + `<all_urls>` host permissions — capture from any page
- `scripting` — register the content script on all URLs
- `contextMenus` — right-click "Save to Clipboard Manager"
- `alarms` — daily auto-cleanup based on retention window

No external/network permissions are requested. The extension never
contacts any server.

## Privacy & data handling

- All clipboard items live in IndexedDB on your local machine.
- Settings (theme, retention days, optional passphrase hash) live in
  `chrome.storage.local`.
- The optional encryption feature uses AES-GCM via the Web Crypto API.
  Only a salted SHA-256 hash of your passphrase is stored — never the
  passphrase itself.
- Sensitive-looking content (JWTs, API-key-shaped strings, credit-card
  patterns) is auto-tagged so you can spot or wipe it quickly.

## Known limitations

1. **Silent background clipboard monitoring is impossible in MV3.**
   Workarounds shipped:
   - Content-script `copy` event listener on all pages
   - Right-click "Save to Clipboard Manager" context menu for selections
   - Manual "Capture from clipboard" button in the popup
2. **Image clipboard reads only work on paste, not copy.**
   We capture images via the manual Capture button or the right-click
   selection menu.
3. **Cross-origin iframes** don't propagate `copy` events to the parent
   content script — this is enforced by the browser for security.
4. **MV3 service workers are ephemeral.** All state is persisted to
   IndexedDB; the worker may suspend between events without losing data.
   Daily cleanup runs via `chrome.alarms`.
5. **Clipboard API requires a user gesture** — manual capture must be
   triggered from inside the popup or via the right-click menu.
6. **Some sites override the copy event** (e.g., custom virtual editors).
   We fall back to reading `window.getSelection()` when possible.

## Future roadmap

- **Chrome Sync** for cross-device clipboard history
- **Claude API integration** for AI summarization of long clips
- **Native browser clipboard monitoring** when Chrome adds an API
- **Firefox / Edge port** — code is already WebExtension-compatible
- **Mobile companion app** for sharing snippets between devices
- **Keyboard-first power mode** (vim-style keybindings)
- **Smart deduplication** that detects near-duplicates, not just identical content

## Running checklist

After `npm install && npm run build`:

- [ ] Open `chrome://extensions`
- [ ] Enable Developer mode
- [ ] Click "Load unpacked" and select the `dist/` folder
- [ ] Copy something from any tab — it should appear in the popup
- [ ] Try `⌘K` / `Ctrl+K` from the popup to open the command palette
- [ ] Right-click selected text on any page → "Save to Clipboard Manager"

## License

MIT — see LICENSE if/when added.
