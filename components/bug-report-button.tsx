"use client";

import { usePathname } from "next/navigation";

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

// Nút nổi góc dưới-phải cho mọi trang học viên: viên thuốc màu chính có chữ, để
// học viên nhìn là biết ngay (icon mờ ở góc từng bị bỏ qua). Ẩn khi màn làm bài
// đã đăng ký ngữ cảnh — màn đó tự đặt BugReportInlineTrigger trong header vì
// thanh nút cuối trang (Nộp bài, ‹ ›) của nó chiếm đúng góc này.
// Màn hẹp (< sm) chỉ còn hình tròn 44px: viên thuốc có chữ rộng ~120px đè lên
// nhãn Đúng/Sai bên phải mỗi thẻ câu ở trang kết quả; mục "Báo lỗi" trong menu
// ☰ vẫn có chữ đầy đủ.
export function BugReportFloatingButton() {
  const { available, attemptContext, open } = useBugReport();
  const pathname = usePathname();
  // Trang kết quả (nghe) có thanh phát lại audio dính đáy màn hình
  // (fixed inset-x-0 bottom-0, xem components/result-answers.tsx) — đẩy nút
  // báo lỗi lên cao hơn để khỏi đè lên thanh đó.
  const isResultsPage = pathname?.includes("/results/") ?? false;

  if (!available || attemptContext) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Báo lỗi cho giáo viên"
      title="Báo lỗi cho giáo viên"
      className={`fixed right-4 z-30 inline-flex h-11 w-11 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-pop transition hover:bg-primary/90 sm:w-auto sm:pl-3.5 sm:pr-4 ${isResultsPage ? "bottom-24" : "bottom-4"}`}
    >
      <BugIcon />
      <span className="hidden sm:inline">Báo lỗi</span>
    </button>
  );
}

// Mục "Báo lỗi" trong menu trái của học viên (cùng khuôn với các mục NavLinks
// trong app-shell.tsx, nhưng là <button> mở hộp thoại chứ không điều hướng).
export function BugReportNavButton({ onNavigate }: { onNavigate?: () => void }) {
  const { available, open } = useBugReport();

  if (!available) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => {
        onNavigate?.();
        open();
      }}
      className="mt-1.5 flex w-full items-center gap-3 rounded-lg border border-dashed border-border px-3.5 py-2.5 text-left text-foreground transition hover:border-primary hover:bg-primary/5"
    >
      <span className="text-primary">
        <BugIcon className="h-5 w-5 shrink-0" />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold">Báo lỗi</span>
        <span className="block text-xs text-muted-foreground">Gặp trục trặc? Báo cô/thầy ngay</span>
      </span>
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
