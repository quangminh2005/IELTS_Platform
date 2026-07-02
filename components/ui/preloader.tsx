"use client";

import { useEffect, useState } from "react";
import { Component } from "@/components/ui/loader-1";

/**
 * Màn hình chờ (splash) toàn trang khi mở app.
 *
 * Hiện ngay từ lúc render đầu (kể cả trước khi React hydrate) nên không bị "nháy"
 * nội dung. Khi trang đã tải xong (sự kiện `load`) và qua thời gian hiển thị tối
 * thiểu, overlay sẽ mờ dần rồi tự gỡ khỏi DOM. Hiện lại mỗi lần tải/reload trang.
 */
const MIN_VISIBLE_MS = 600; // giữ splash tối thiểu để không chớp tắt quá nhanh
const FADE_MS = 400; // khớp với thời lượng transition mờ dần bên dưới

export const Preloader = () => {
  // Bắt đầu ở trạng thái hiển thị để splash có mặt ngay trong HTML đầu tiên.
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const startedAt = Date.now();

    const beginHide = () => {
      const elapsed = Date.now() - startedAt;
      const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
      window.setTimeout(() => {
        setFading(true);
        window.setTimeout(() => setVisible(false), FADE_MS);
      }, wait);
    };

    if (document.readyState === "complete") {
      beginHide();
    } else {
      window.addEventListener("load", beginHide, { once: true });
      return () => window.removeEventListener("load", beginHide);
    }
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background text-primary transition-opacity duration-[400ms] ease-out"
      style={{ opacity: fading ? 0 : 1 }}
      role="status"
      aria-live="polite"
      aria-label="Đang tải trang"
    >
      <Component className="h-32 w-32" />
      <p className="text-sm font-medium text-muted-foreground">Đang tải…</p>
    </div>
  );
};
