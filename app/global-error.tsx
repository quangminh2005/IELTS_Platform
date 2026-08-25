"use client";

import { useEffect } from "react";

/**
 * Lưới đỡ cuối cùng: chỉ chạy khi chính layout gốc (app/layout.tsx) chết, lúc
 * đó app/error.tsx cũng không kịp hiện vì nó nằm BÊN TRONG layout đó.
 *
 * Vì thay thế luôn layout gốc, file này phải tự dựng <html> và <body>. Quan
 * trọng: nó cũng KHÔNG được dựa vào globals.css hay class Tailwind — bảng
 * style của layout gốc có thể chưa kịp nạp (đúng kiểu sự cố 25/8/2026: một
 * chunk JS lỗi cú pháp là hỏng cả trang). Nên toàn bộ màu ở đây được chép tay
 * từ token trong app/globals.css và nhúng thẳng vào thẻ <style>; đổi màu nền
 * tảng thì nhớ ngó lại file này.
 *
 * Cũng vì lẽ đó, nút "Về trang chủ" dùng thẻ <a> thường chứ không dùng
 * next/link: điều hướng cứng, không cần router còn sống.
 */

// Chép tay từ app/globals.css. Sáng/tối theo cài đặt hệ điều hành, không đọc
// localStorage vì script chọn theme nằm trong layout gốc (đã chết).
const css = `
  :root {
    color-scheme: light;
    --ge-bg: hsl(214 42% 97%);
    --ge-card: hsl(0 0% 100%);
    --ge-fg: hsl(222 47% 12%);
    --ge-muted-fg: hsl(215 19% 42%);
    --ge-border: hsl(214 26% 84%);
    --ge-primary: hsl(221 83% 53%);
    --ge-primary-fg: hsl(0 0% 100%);
    --ge-destructive: hsl(0 72% 51%);
    --ge-destructive-soft: hsl(0 72% 51% / 0.12);
    --ge-shadow: 0 12px 40px -12px rgb(15 23 42 / 0.25);
  }

  @media (prefers-color-scheme: dark) {
    :root {
      color-scheme: dark;
      --ge-bg: hsl(222 47% 9%);
      --ge-card: hsl(217 30% 17%);
      --ge-fg: hsl(210 40% 96%);
      --ge-muted-fg: hsl(214 22% 73%);
      --ge-border: hsl(216 19% 32%);
      --ge-primary: hsl(217 91% 62%);
      --ge-primary-fg: hsl(222 47% 9%);
      --ge-destructive: hsl(0 63% 50%);
      --ge-destructive-soft: hsl(0 63% 50% / 0.18);
      --ge-shadow: 0 18px 50px -16px rgb(0 0 0 / 0.7);
    }
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--ge-bg);
    color: var(--ge-fg);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
      "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .ge-card {
    width: 100%;
    max-width: 34rem;
    padding: 32px;
    border: 1px solid var(--ge-border);
    border-radius: 16px;
    background: var(--ge-card);
    box-shadow: var(--ge-shadow);
  }

  .ge-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: var(--ge-destructive-soft);
    color: var(--ge-destructive);
  }

  .ge-eyebrow {
    margin: 24px 0 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--ge-destructive);
  }

  .ge-title {
    margin: 8px 0 0;
    font-size: 28px;
    line-height: 1.25;
    font-weight: 700;
  }

  .ge-text {
    margin: 16px 0 0;
    font-size: 16px;
    line-height: 1.75;
    color: var(--ge-muted-fg);
  }

  .ge-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 32px;
  }

  .ge-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 44px;
    padding: 0 24px;
    border-radius: 10px;
    border: 1px solid transparent;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
  }

  .ge-btn-primary {
    background: var(--ge-primary);
    color: var(--ge-primary-fg);
  }

  .ge-btn-ghost {
    background: transparent;
    border-color: var(--ge-border);
    color: var(--ge-fg);
  }

  .ge-code {
    margin: 24px 0 0;
    font-size: 12px;
    color: var(--ge-muted-fg);
  }

  @media (min-width: 640px) {
    .ge-actions { flex-direction: row; }
  }
`;

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ielts-platform] Lỗi ở khung trang gốc:", error);
  }, [error]);

  return (
    <html lang="vi">
      <body>
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <main className="ge-card">
          <span className="ge-badge">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              width="24"
              height="24"
              aria-hidden="true"
            >
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
          </span>
          <p className="ge-eyebrow">Trang không tải được</p>
          <h1 className="ge-title">Rất tiếc, trang chưa mở lên được.</h1>
          <p className="ge-text">
            Đây là lỗi của trang web chứ không phải do bạn thao tác sai. Bạn bấm{" "}
            <strong>Thử lại</strong> giúp nhé — thường là tải lại một lần là vào được.
          </p>
          <p className="ge-text">
            Nếu vẫn không được, hãy thử mở bằng máy khác hoặc cập nhật trình duyệt lên bản mới, rồi
            nhắn cho giáo viên kèm ảnh chụp màn hình này.
          </p>

          <div className="ge-actions">
            <button type="button" onClick={reset} className="ge-btn ge-btn-primary">
              Thử lại
            </button>
            <a href="/" className="ge-btn ge-btn-ghost">
              Về trang chủ
            </a>
          </div>

          {error.digest ? (
            <p className="ge-code">
              Mã lỗi: <code>{error.digest}</code>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
