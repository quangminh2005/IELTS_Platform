"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

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
//
// Toast được render qua portal thẳng vào <body>: layout bọc nội dung trong một
// div có `animate-fade-in` (transform: translateY) — mà một transform khác
// `none` sẽ biến div đó thành "containing block" cho phần tử `position: fixed`.
// Nếu để toast bên trong, nó bị ghim theo cột nội dung (đè lên tiêu đề) thay vì
// nằm ở góc màn hình. Portal ra ngoài giúp `fixed` bám đúng viewport.
export function NoticeToast({ message, status }: NoticeToastProps) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [mounted, setMounted] = useState(false);

  // Chỉ dựng portal sau khi mount ở client (document.body đã sẵn sàng).
  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted || !toast) {
    return null;
  }

  const isSuccess = toast.status === "success";

  return createPortal(
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
    </div>,
    document.body
  );
}
