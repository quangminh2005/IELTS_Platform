"use client";

import { useEffect, useState } from "react";

type NoticeToastProps = {
  message?: string;
  status: "success" | "error";
};

type ToastState = { message: string; status: "success" | "error" };

// Popup nổi (toast) hiển thị thông báo thành công/lỗi, tự ẩn sau vài giây.
// Thông báo đến từ query param (do server action redirect kèm theo). Dùng
// useEffect phản ứng khi prop `message` đổi để bắt được cả điều hướng MỀM
// (server action redirect không mount lại trang), rồi lưu vào state cục bộ nên
// việc dọn query khỏi URL (gây re-render với searchParams rỗng) không làm toast
// biến mất.
export function NoticeToast({ message, status }: NoticeToastProps) {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!message) {
      return;
    }

    setToast({ message, status });
    window.history.replaceState(null, "", window.location.pathname);
  }, [message, status]);

  // Đặt hẹn giờ tự ẩn riêng, để việc dọn URL re-render không huỷ mất timer.
  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 4000);

    return () => window.clearTimeout(timer);
  }, [toast]);

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
            ? "border-emerald-400/60 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
            : "border-red-400/60 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"
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
        <p className="min-w-0 flex-1 break-words text-sm font-semibold leading-6">{toast.message}</p>
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
