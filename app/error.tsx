"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AnimatedThemeToggle } from "@/components/ui/animated-theme-toggle";

/**
 * Màn hình lỗi cho mọi trang trong app/ (trừ khi chính layout gốc chết — lúc đó
 * app/global-error.tsx đỡ).
 *
 * Trước đây dự án không có file này, nên bất kỳ lỗi nào phía trình duyệt cũng
 * chỉ hiện đúng một dòng tiếng Anh của Next: "Application error: a client-side
 * exception has occurred". Học viên và giáo viên đọc xong không biết phải làm
 * gì (sự cố 25/8/2026: shader three.js chết trên iPhone đời cũ, cả trang đăng
 * nhập trắng xoá).
 *
 * Next luôn truyền vào một Error đã bị xoá bớt thông tin trên bản chạy thật
 * (chỉ còn `digest`), nên ở đây KHÔNG hiện nội dung lỗi cho người dùng — vừa
 * không giúp được gì, vừa dễ lộ chi tiết hệ thống. Chỉ hiện mã digest để người
 * dùng đọc cho giáo viên/kỹ thuật khi cần tra log máy chủ.
 */
export default function ErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Ghi ra console để còn lần được nguyên nhân khi ngồi cạnh máy học viên.
  useEffect(() => {
    console.error("[ielts-platform] Lỗi hiển thị trang:", error);
  }, [error]);

  return (
    <main className="relative min-h-screen text-foreground">
      <AnimatedThemeToggle className="fixed right-4 top-4 z-50 shadow-card" />
      <section className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-5 py-16">
        <div className="animate-fade-in rounded-2xl border border-border bg-card p-8 shadow-pop sm:p-10">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
          </span>
          <p className="mt-6 text-sm font-semibold text-destructive">Trang gặp trục trặc</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight text-foreground">
            Rất tiếc, phần này chưa hiển thị được.
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Lỗi nằm ở phía hiển thị chứ không phải do bạn làm sai. Bấm{" "}
            <span className="font-semibold text-foreground">Thử lại</span> để nạp lại phần vừa
            hỏng — bài làm đang dở đã được lưu trên máy chủ nên bạn không mất câu trả lời.
          </p>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Nếu bấm mấy lần vẫn vậy, hãy chụp màn hình này gửi cho giáo viên.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Thử lại
            </button>
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-background px-6 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Về trang chủ
            </Link>
          </div>

          {error.digest ? (
            <p className="mt-6 text-xs text-muted-foreground">
              Mã lỗi: <code className="font-mono">{error.digest}</code>
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
