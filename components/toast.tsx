"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import type { ActionResult } from "@/lib/action-result";

type Toast = ActionResult & { id: number };

type ToastContextValue = {
  notify: (result: ActionResult) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

// 4 giây: đủ đọc một câu ngắn mà không cản việc sửa câu tiếp theo.
const TOAST_MS = 4000;

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast phải nằm trong <ToastProvider>.");
  }

  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((result: ActionResult) => {
    const id = nextId.current;
    nextId.current += 1;
    setToasts((current) => [...current, { ...result, id }]);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* pointer-events-none để khung rỗng không chặn click vào trang phía dưới. */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      role="status"
      // Lỗi phải được trình đọc màn hình đọc ngay, thành công thì đợi lượt.
      aria-live={toast.ok ? "polite" : "assertive"}
      className={`pointer-events-auto flex animate-fade-in items-start gap-3 rounded-lg border px-4 py-3 text-sm font-medium shadow-pop ${
        toast.ok
          ? "border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          : "border-red-400/60 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"
      }`}
    >
      <span className="flex-1 leading-5">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Đóng thông báo"
        className="-mr-1 -mt-0.5 shrink-0 rounded px-1 text-base leading-none opacity-70 transition-opacity hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
