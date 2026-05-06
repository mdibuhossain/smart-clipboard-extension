/**
 * SettingsModal.jsx
 *
 * Modal for user-configurable settings:
 *   - Encryption: enable/disable + manage passphrase (Web Crypto / AES-GCM).
 *   - Retention window in days.
 *   - Auto-capture toggle (UI hint only — hard off requires manifest changes).
 *
 * Passphrase is never stored in plaintext. We persist a salted SHA-256
 * hash to chrome.storage.local for verification, and the actual key is
 * derived in-memory at unlock time using PBKDF2.
 */

import React, { useEffect, useRef, useState } from 'react';

const SETTINGS_KEY = 'settings';

export default function SettingsModal({ onClose, onSettingsChanged }) {
  const [settings, setSettings] = useState({
    encryptionEnabled: false,
    retentionDays: 30,
    autoCapture: true
  });
  const [hasPassphrase, setHasPassphrase] = useState(false);
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [status, setStatus] = useState({ kind: 'idle', text: '' });
  const fileInput = useRef(null);

  useEffect(() => { (async () => {
    try {
      const got = await chrome.storage.local.get([SETTINGS_KEY, 'passphrase']);
      if (got?.[SETTINGS_KEY]) setSettings({ ...settings, ...got[SETTINGS_KEY] });
      setHasPassphrase(!!got?.passphrase);
    } catch (_) { /* noop */ }
  })(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  const persistSettings = async (next) => {
    setSettings(next);
    try {
      await chrome.storage.local.set({ [SETTINGS_KEY]: next });
      onSettingsChanged?.(next);
    } catch (err) {
      console.error('[SCM:settings] persist failed', err);
    }
  };

  const savePassphrase = async () => {
    if (!pass1) return setStatus({ kind: 'error', text: 'Passphrase required' });
    if (pass1.length < 6) return setStatus({ kind: 'error', text: 'Use at least 6 characters' });
    if (pass1 !== pass2) return setStatus({ kind: 'error', text: 'Passphrases do not match' });
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const enc = new TextEncoder().encode(pass1);
      const buf = await crypto.subtle.digest('SHA-256', concat(salt, enc));
      const hex = bytesToHex(new Uint8Array(buf));
      await chrome.storage.local.set({
        passphrase: { salt: bytesToHex(salt), hash: hex, createdAt: Date.now() }
      });
      setHasPassphrase(true);
      setPass1(''); setPass2('');
      setStatus({ kind: 'success', text: 'Passphrase saved' });
    } catch (err) {
      console.error('[SCM:settings] save passphrase failed', err);
      setStatus({ kind: 'error', text: 'Failed to save passphrase' });
    }
  };

  const clearPassphrase = async () => {
    try {
      await chrome.storage.local.remove('passphrase');
      setHasPassphrase(false);
      setStatus({ kind: 'success', text: 'Passphrase cleared' });
    } catch (_) { /* noop */ }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-auto rounded-xl bg-slate-900/95 ring-1 ring-slate-700 shadow-cardLg animate-pop"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <h3 className="text-slate-100 font-semibold text-[14px]">🛠️ Settings</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm">×</button>
        </header>

        <div className="p-4 space-y-5 text-[12px] text-slate-200">

          <Section title="Encryption" subtitle="Lock items auto-tagged 'sensitive'.">
            <label className="flex items-center justify-between">
              <span>Encrypt sensitive items</span>
              <Toggle
                checked={settings.encryptionEnabled}
                onChange={(v) => persistSettings({ ...settings, encryptionEnabled: v })}
              />
            </label>

            <div className="mt-3 rounded-lg ring-1 ring-slate-800 p-3 bg-slate-950/40">
              <p className="text-[11px] text-slate-400 mb-2">
                {hasPassphrase
                  ? 'A passphrase is set. Sensitive items will require it to decrypt.'
                  : 'Set a passphrase to enable encryption. We only store a salted hash.'}
              </p>
              {!hasPassphrase ? (
                <div className="space-y-2">
                  <input
                    type="password"
                    placeholder="Passphrase"
                    value={pass1}
                    onChange={(e) => setPass1(e.target.value)}
                    className="w-full rounded-md bg-slate-800 ring-1 ring-slate-700 focus:ring-brand-400 outline-none px-2 py-1.5 text-[12px]"
                  />
                  <input
                    type="password"
                    placeholder="Confirm passphrase"
                    value={pass2}
                    onChange={(e) => setPass2(e.target.value)}
                    className="w-full rounded-md bg-slate-800 ring-1 ring-slate-700 focus:ring-brand-400 outline-none px-2 py-1.5 text-[12px]"
                  />
                  <button
                    type="button"
                    onClick={savePassphrase}
                    className="rounded-md bg-brand-600 hover:bg-brand-500 text-white text-[12px] px-3 py-1.5"
                  >
                    Save passphrase
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={clearPassphrase}
                  className="rounded-md bg-rose-600/30 ring-1 ring-rose-500/50 hover:bg-rose-600/50 text-rose-100 text-[12px] px-3 py-1.5"
                >
                  Remove passphrase
                </button>
              )}
              {status.kind !== 'idle' && (
                <p className={`mt-2 text-[11px] ${status.kind === 'error' ? 'text-rose-300' : 'text-emerald-300'}`}>
                  {status.text}
                </p>
              )}
            </div>
          </Section>

          <Section title="Retention" subtitle="Auto-clean items older than this (pinned items never auto-delete).">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={365}
                value={settings.retentionDays}
                onChange={(e) => persistSettings({ ...settings, retentionDays: clamp(parseInt(e.target.value || '0', 10), 1, 365) })}
                className="w-20 rounded-md bg-slate-800 ring-1 ring-slate-700 focus:ring-brand-400 outline-none px-2 py-1 text-[12px]"
              />
              <span className="text-slate-400">days</span>
            </div>
          </Section>

          <Section title="Capture" subtitle="Toggle the auto-capture content script behavior.">
            <label className="flex items-center justify-between">
              <span>Auto-capture on copy</span>
              <Toggle
                checked={settings.autoCapture}
                onChange={(v) => persistSettings({ ...settings, autoCapture: v })}
              />
            </label>
            <p className="text-[10px] text-slate-500 mt-1">
              When off, only manual capture and the right-click menu store items.
            </p>
          </Section>

          <Section title="About">
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Smart Clipboard Manager runs entirely on your device. No clipboard contents are sent to any server.
            </p>
            <input ref={fileInput} type="file" hidden />
          </Section>

        </div>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <section>
      <h4 className="text-[11px] uppercase tracking-wide text-slate-400 font-bold mb-1">{title}</h4>
      {subtitle && <p className="text-[11px] text-slate-500 mb-2">{subtitle}</p>}
      {children}
    </section>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-brand-500' : 'bg-slate-700'}`}
      aria-pressed={checked}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-1'}`} />
    </button>
  );
}

function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
function bytesToHex(arr) { return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join(''); }
function concat(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0); out.set(b, a.length); return out;
}
