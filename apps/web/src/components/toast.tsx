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

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function addToast(message: string, type: ToastType) {
  const id = generateId();
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

  const errorToasts = currentToasts.filter((t) => t.type === "error");
  const otherToasts = currentToasts.filter((t) => t.type !== "error");

  const toastClass = (type: ToastType) =>
    `px-4 py-2 rounded-md shadow-lg text-white text-sm transition-all animate-in fade-in slide-in-from-right-4 pointer-events-auto ${
      type === "success"
        ? "bg-green-600"
        : type === "error"
          ? "bg-red-600"
          : "bg-blue-600"
    }`;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <div aria-live="assertive" aria-atomic="false" className="flex flex-col gap-2">
        {errorToasts.map((t) => (
          <div key={t.id} role="alert" className={toastClass(t.type)}>
            {t.message}
          </div>
        ))}
      </div>
      <div aria-live="polite" aria-atomic="false" className="flex flex-col gap-2">
        {otherToasts.map((t) => (
          <div key={t.id} role="status" className={toastClass(t.type)}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
