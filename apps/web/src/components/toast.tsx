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

const ToastIcon = ({ type }: { type: ToastType }) => {
  if (type === "success") {
    return (
      <svg
        className="h-5 w-5 mr-2 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (type === "error") {
    return (
      <svg
        className="h-5 w-5 mr-2 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    );
  }
  return (
    <svg
      className="h-5 w-5 mr-2 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
};

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
    <div
      aria-live="polite"
      role="status"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
    >
      {currentToasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-md shadow-lg text-white text-sm flex items-center transition-all animate-in fade-in slide-in-from-right-4 pointer-events-auto ${
            t.type === "success"
              ? "bg-green-600"
              : t.type === "error"
                ? "bg-red-600"
                : "bg-blue-600"
          }`}
        >
          <ToastIcon type={t.type} />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
