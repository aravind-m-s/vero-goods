'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info', duration: number = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  }, []);

  const success = useCallback((message: string, duration?: number) => toast(message, 'success', duration), [toast]);
  const error = useCallback((message: string, duration?: number) => toast(message, 'error', duration), [toast]);
  const info = useCallback((message: string, duration?: number) => toast(message, 'info', duration), [toast]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: (id: string) => void }) {
  const { id, message, type, duration = 3000 } = toast;

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);
    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const icons = {
    success: <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />,
    error: <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />,
    info: <Info className="h-5 w-5 text-blue-500 shrink-0" />,
    warning: <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />,
  };

  const bgColors = {
    success: 'bg-white border-emerald-100 shadow-md shadow-emerald-50/50 dark:bg-zinc-900 dark:border-emerald-950',
    error: 'bg-white border-rose-100 shadow-md shadow-rose-50/50 dark:bg-zinc-900 dark:border-rose-950',
    info: 'bg-white border-blue-100 shadow-md shadow-blue-50/50 dark:bg-zinc-900 dark:border-blue-950',
    warning: 'bg-white border-amber-100 shadow-md shadow-amber-50/50 dark:bg-zinc-900 dark:border-amber-950',
  };

  return (
    <div
      className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-lg border text-sm font-medium animate-slide-in-right ${bgColors[type]}`}
      role="alert"
    >
      <div className="flex items-center gap-2.5">
        {icons[type]}
        <span className="text-zinc-800 dark:text-zinc-200">{message}</span>
      </div>
      <button
        onClick={() => onClose(id)}
        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors p-0.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
