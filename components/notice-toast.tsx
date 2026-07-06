"use client";

import { useEffect, useState } from "react";

type NoticeToastProps = {
  message?: string;
  status: "success" | "error";
};

type ToastState = { message: string; status: "success" | "error" };

// Popup nổi (toast) hiển thị thông báo thành công/lỗi, tự ẩn sau vài giây.
// Thông báo được lưu vào state CỤC BỘ ngay lần render đầu (từ query param do
// server action redirect kèm theo). Sau đó effect dọn query khỏi URL — thao tác
// này khiến Next re-render với searchParams rỗng, nhưng toast vẫn còn vì đã nằm
// trong state cục bộ, không phụ thuộc prop nữa.
export function NoticeToast({ message, status }: NoticeToastProps) {
  const [toast, setToast] = useState<ToastState | null>(
    message ? { message, status } : null
  );

  useEffect(() => {
    if (!toast) {
      return;
    }

    window.history.replaceState(null, "", window.location.pathname);
    const timer = window.setTimeout(() => setToast(null), 4000);

    return () => window.clearTimeout(timer);
    // Chỉ chạy một lần khi mount — toast đã được lấy từ lần render đầu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!toast) {
    return null;
  }

  const isSuccess = toast.status === "success";

  return (
    <div className="fixed inset-x-0 top-4 z-[100] flex justify-center px-4 sm:justify-end sm:pr-6">
      <div
        role="status"
        className={[
          "pointer-events-auto flex max-w-md items-start gap-3 rounded-xl border px-4 py-3 shadow-pop animate-fade-in",
          isSuccess
            ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
            : "border-red-400/60 bg-red-500/15 text-red-700 dark:text-red-300"
        ].join(" ")}
      >
        <span className="mt-0.5 shrink-0">
          {isSuccess ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-5 w-5" aria-hidden="true">
              <circle cx="12" cy="12" r="9" className="opacity-40" />
              <path d="M8 12.5 11 15.5 16 9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-5 w-5" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
            </svg>
          )}
        </span>
        <p className="text-sm font-semibold leading-6">{toast.message}</p>
        <button
          type="button"
          onClick={() => setToast(null)}
          aria-label="Đóng thông báo"
          className="ml-2 shrink-0 opacity-70 transition hover:opacity-100"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
