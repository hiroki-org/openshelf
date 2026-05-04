"use client";

import { useEffect, useState } from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

let toastListeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];

export const toast = {
  success: (message: string) => addToast(message, "success"),
  error: (message: string) => addToast(message, "error"),
  info: (message: string) => addToast(message, "info"),
};

function addToast(message: string, type: ToastType) {
  const id = Math.random().toString(36).substring(2, 9);
  const newToast = { id, message, type };
  toasts = [...toasts, newToast];
  notify();
  setTimeout(() => removeToast(id), 5000);
}

function removeToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

function notify() {
  toastListeners.forEach((listener) => listener(toasts));
}

export function ToastContainer() {
  const [currentToasts, setCurrentToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (newToasts: Toast[]) => setCurrentToasts(newToasts);
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <div role="alert" aria-live="assertive" aria-atomic="false" className="flex flex-col gap-2">
        {errorToasts.map((t) => (
          <div key={t.id} role="alert" className={toastClass(t.type)}>
            {t.message}
          </div>
        ))}
      </div>
      <div role="status" aria-live="polite" aria-atomic="false" className="flex flex-col gap-2">
        {otherToasts.map((t) => (
          <div key={t.id} role="status" className={toastClass(t.type)}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
