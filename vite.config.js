/**
 * vite.config.js
 *
 * Vite build configuration for Smart Clipboard Manager Chrome Extension.
 * Bundles popup React app, background service worker, and content script
 * into a Chrome-loadable `dist/` folder while preserving manifest paths.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    // Copy manifest, icons, and html shell verbatim to the dist folder.
    viteStaticCopy({
      targets: [
        { src: 'manifest.json', dest: '.' },
        { src: 'public/*', dest: 'public' },
        { src: 'src/popup/popup.html', dest: 'src/popup' }
      ]
    })
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      // Multiple entry points: popup UI, background SW, content script.
      input: {
        popup: resolve(__dirname, 'src/popup/popup.jsx'),
        background: resolve(__dirname, 'src/background/background.js'),
        contentScript: resolve(__dirname, 'src/content/contentScript.js')
      },
      output: {
        // Stable file names so manifest.json paths line up with build output.
        entryFileNames: (chunk) => {
          if (chunk.name === 'background') return 'src/background/background.js';
          if (chunk.name === 'contentScript') return 'src/content/contentScript.js';
          if (chunk.name === 'popup') return 'src/popup/popup.js';
          return 'assets/[name].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'src/popup/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
