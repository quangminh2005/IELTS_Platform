"use client";

import { useCallback, useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Popup Tổng kết tháng tự bật ở trang chủ học viên (7 ngày đầu tháng — server đã
// lọc). Mỗi tháng chỉ bật một lần trên mỗi máy: đóng là ghi khoá vào localStorage.
// Nội dung (MonthlyRecapPanel) do server vẽ sẵn và truyền vào qua children.

// localStorage hỏng (chế độ ẩn danh, bị chặn) → vẫn chỉ bật một lần mỗi phiên.
const shownThisSession = new Set<string>();

function storageKey(monthKey: string) {
  return `monthly-recap-seen:${monthKey}`;
}

export function MonthlyRecapDialog({ monthKey, children }: { monthKey: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (shownThisSession.has(monthKey)) {
      return;
    }
    let seen = false;
    try {
      seen = window.localStorage.getItem(storageKey(monthKey)) === "1";
    } catch {
      seen = false;
    }
    if (!seen) {
      shownThisSession.add(monthKey);
      setOpen(true);
    }
  }, [monthKey]);

  const close = useCallback(() => {
    setOpen(false);
    try {
      window.localStorage.setItem(storageKey(monthKey), "1");
    } catch {
      // Không ghi được thì thôi — shownThisSession đã chặn bật lại trong phiên.
    }
  }, [monthKey]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  if (!open) {
    return null;
  }

  // Nút "Học tiếp…" nằm trong phần server vẽ nên không cầm được hàm close —
  // bắt click theo thuộc tính data-recap-close.
  function onPanelClick(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("[data-recap-close]")) {
      close();
    }
  }

  // Portal ra <body>: khung nội dung của AppShell có `transform` nên `fixed` bên
  // trong sẽ bám theo khung đó thay vì màn hình.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 sm:p-6"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tổng kết tháng"
        className="relative max-h-[92vh] w-full max-w-6xl overflow-y-auto overscroll-contain rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-background to-background bg-background p-5 shadow-2xl sm:p-7"
        onClick={(event) => {
          event.stopPropagation();
          onPanelClick(event);
        }}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Đóng"
          className="sticky top-0 z-10 float-right -mr-1 -mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-lg text-muted-foreground shadow-card transition hover:text-foreground"
        >
          ×
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}
