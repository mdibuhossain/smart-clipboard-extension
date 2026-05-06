/**
 * popup.jsx
 *
 * Mounts the React tree into the popup HTML shell. Imports global Tailwind
 * styles. Sets the popup body to the dark theme by default per design.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../components/App.jsx';
import '../styles/globals.css';
import { installResizeHandle } from './resizeHandle.js';

const container = document.getElementById('scm-root');
if (!container) {
  throw new Error('[SCM:popup] missing #scm-root mount node');
}
const root = createRoot(container);
root.render(<App />);
installResizeHandle();

// Helpful diagnostic: surface any unhandled errors in DevTools console
// of the popup so users can include them when filing issues.
window.addEventListener('error', (e) => console.error('[SCM:popup] error', e.message));
window.addEventListener('unhandledrejection', (e) => console.error('[SCM:popup] rejection', e.reason));
