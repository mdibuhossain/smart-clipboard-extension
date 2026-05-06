/**
 * clipboardDB.js
 *
 * Thin wrapper around the `idb` library for the Smart Clipboard Manager
 * IndexedDB store. Used identically by the background service worker and
 * by the popup's React tree so there is a single persistence layer.
 *
 * Stores:
 *  - `items`: clipboard entries keyed by id, indexed for fast lookups.
 *  - `meta`:  small key/value store for tag colors, settings hash, etc.
 *
 * All methods are async, return plain JS values, and trap their own
 * errors with a `[SCM:db]` log prefix to ease debugging.
 */

import { openDB } from 'idb';

const LOG = '[SCM:db]';
const DB_NAME = 'smart-clipboard-manager';
const DB_VERSION = 1;
const STORE_ITEMS = 'items';
const STORE_META = 'meta';

export class ClipboardDB {
  constructor() {
    this._db = null;
  }

  async open() {
    if (this._db) return this._db;
    try {
      this._db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_ITEMS)) {
            const items = db.createObjectStore(STORE_ITEMS, { keyPath: 'id' });
            items.createIndex('createdAt', 'createdAt');
            items.createIndex('contentHash', 'contentHash');
            items.createIndex('isPinned', 'isPinned');
            items.createIndex('sessionGroup', 'sessionGroup');
            items.createIndex('type', 'type');
          }
          if (!db.objectStoreNames.contains(STORE_META)) {
            db.createObjectStore(STORE_META, { keyPath: 'key' });
          }
        }
      });
      return this._db;
    } catch (err) {
      console.error(LOG, 'open failed', err);
      throw err;
    }
  }

  async _store(name, mode = 'readonly') {
    const db = await this.open();
    return db.transaction(name, mode).objectStore(name);
  }

  // ----- items CRUD -----

  async addItem(item) {
    try {
      const db = await this.open();
      await db.put(STORE_ITEMS, item);
      return item;
    } catch (err) {
      console.error(LOG, 'addItem failed', err);
      throw err;
    }
  }

  async getItem(id) {
    try {
      const db = await this.open();
      return (await db.get(STORE_ITEMS, id)) || null;
    } catch (err) {
      console.error(LOG, 'getItem failed', err);
      return null;
    }
  }

  async getAllItems() {
    try {
      const db = await this.open();
      const all = await db.getAll(STORE_ITEMS);
      // Newest first by default — UI sorts further.
      return all.sort((a, b) => b.createdAt - a.createdAt);
    } catch (err) {
      console.error(LOG, 'getAllItems failed', err);
      return [];
    }
  }

  async getMostRecent(limit = 1) {
    try {
      const db = await this.open();
      const tx = db.transaction(STORE_ITEMS, 'readonly');
      const idx = tx.store.index('createdAt');
      const items = [];
      let cursor = await idx.openCursor(null, 'prev');
      while (cursor && items.length < limit) {
        items.push(cursor.value);
        cursor = await cursor.continue();
      }
      return items;
    } catch (err) {
      console.error(LOG, 'getMostRecent failed', err);
      return [];
    }
  }

  async findByHash(hash) {
    try {
      const db = await this.open();
      return (await db.getFromIndex(STORE_ITEMS, 'contentHash', hash)) || null;
    } catch (err) {
      console.error(LOG, 'findByHash failed', err);
      return null;
    }
  }

  async updateItem(id, patch) {
    try {
      const db = await this.open();
      const tx = db.transaction(STORE_ITEMS, 'readwrite');
      const existing = await tx.store.get(id);
      if (!existing) {
        await tx.done;
        return null;
      }
      const merged = { ...existing, ...patch };
      // Re-merge metadata so callers can patch a single key without nuking siblings.
      if (patch && patch.metadata) {
        merged.metadata = { ...(existing.metadata || {}), ...patch.metadata };
      }
      await tx.store.put(merged);
      await tx.done;
      return merged;
    } catch (err) {
      console.error(LOG, 'updateItem failed', err);
      throw err;
    }
  }

  async deleteItem(id) {
    try {
      const db = await this.open();
      await db.delete(STORE_ITEMS, id);
      return true;
    } catch (err) {
      console.error(LOG, 'deleteItem failed', err);
      return false;
    }
  }

  async deleteOlderThan(cutoffMs) {
    try {
      const db = await this.open();
      const tx = db.transaction(STORE_ITEMS, 'readwrite');
      const idx = tx.store.index('createdAt');
      let removed = 0;
      let cursor = await idx.openCursor(IDBKeyRange.upperBound(cutoffMs));
      while (cursor) {
        // Don't auto-prune pinned items — users intentionally kept them.
        if (!cursor.value.isPinned) {
          await cursor.delete();
          removed++;
        }
        cursor = await cursor.continue();
      }
      await tx.done;
      return removed;
    } catch (err) {
      console.error(LOG, 'deleteOlderThan failed', err);
      return 0;
    }
  }

  async clearAll() {
    try {
      const db = await this.open();
      await db.clear(STORE_ITEMS);
      return true;
    } catch (err) {
      console.error(LOG, 'clearAll failed', err);
      return false;
    }
  }

  /**
   * Bulk import from a JSON export. Skips items whose contentHash is
   * already present — true merge semantics with no duplicates.
   */
  async importItems(items) {
    let imported = 0, skipped = 0;
    try {
      const db = await this.open();
      for (const raw of items) {
        if (!raw || !raw.id || !raw.contentHash) { skipped++; continue; }
        const existing = await db.getFromIndex(STORE_ITEMS, 'contentHash', raw.contentHash);
        if (existing) { skipped++; continue; }
        await db.put(STORE_ITEMS, raw);
        imported++;
      }
    } catch (err) {
      console.error(LOG, 'importItems failed', err);
    }
    return { imported, skipped };
  }

  // ----- meta key/value -----

  async setMeta(key, value) {
    try {
      const db = await this.open();
      await db.put(STORE_META, { key, value });
      return true;
    } catch (err) {
      console.error(LOG, 'setMeta failed', err);
      return false;
    }
  }

  async getMeta(key, fallback = null) {
    try {
      const db = await this.open();
      const row = await db.get(STORE_META, key);
      return row ? row.value : fallback;
    } catch (err) {
      console.error(LOG, 'getMeta failed', err);
      return fallback;
    }
  }
}

// Convenience singleton — used from the popup React tree.
export const clipboardDB = new ClipboardDB();
