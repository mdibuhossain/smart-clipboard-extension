/**
 * Toast.jsx
 *
 * Tiny snackbar/toast component + provider hook used to surface short
 * confirmations (e.g., "Copied to clipboard!"). Stays out of the way:
 * single line, bottom-right, fades after a few seconds.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ToastCtx = createContext({ push: () => {} });

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    const toast = {
      id,
      message,
      kind: opts.kind || 'info',
      duration: opts.duration || 2200
    };
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, toast.duration);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-3 right-3 z-50 flex flex-col gap-2">
        {toasts.map((t) => <ToastView key={t.id} toast={t} />)}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastView({ toast }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  const tone =
    toast.kind === 'success' ? 'bg-emerald-600/95 ring-emerald-400/60' :
    toast.kind === 'error'   ? 'bg-rose-600/95 ring-rose-400/60' :
    toast.kind === 'warn'    ? 'bg-amber-600/95 ring-amber-400/60' :
                                'bg-slate-800/95 ring-slate-500/40';
  return (
    <div
      className={`pointer-events-auto rounded-lg px-3 py-2 text-[12px] text-white shadow-cardLg ring-1 ring-inset ${tone} transition-all duration-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
      role="status"
    >
      {toast.message}
    </div>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
