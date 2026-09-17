"use client";

import { useBugReport } from "@/components/bug-report-context";

export function BugIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 9V7a3 3 0 0 1 6 0v2" />
      <rect x="7" y="9" width="10" height="11" rx="5" />
      <path d="M12 12v8M3 13h4M17 13h4M4 19l3-2M20 19l-3-2M5 8l2.5 1.5M19 8l-2.5 1.5" />
    </svg>
  );
}

// Nút nổi góc dưới-phải cho mọi trang học viên. Ẩn khi màn làm bài đã đăng ký ngữ
// cảnh — màn đó tự đặt BugReportInlineTrigger trong header vì thanh nút cuối trang
// (Nộp bài, ‹ ›) của nó chiếm đúng góc này.
export function BugReportFloatingButton() {
  const { available, attemptContext, open } = useBugReport();

  if (!available || attemptContext) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Báo lỗi cho giáo viên"
      title="Báo lỗi cho giáo viên"
      className="fixed bottom-4 right-4 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-pop transition hover:border-primary hover:text-primary"
    >
      <BugIcon />
    </button>
  );
}

// Nút cho header màn làm bài (cùng khuôn 36px với cụm nút cỡ chữ/đồng hồ bên cạnh).
export function BugReportInlineTrigger() {
  const { available, open } = useBugReport();

  if (!available) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Báo lỗi cho giáo viên"
      title="Báo lỗi cho giáo viên"
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:border-primary hover:text-primary"
    >
      <BugIcon />
    </button>
  );
}
