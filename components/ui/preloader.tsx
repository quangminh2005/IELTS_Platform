"use client";

import { useEffect, useState } from "react";
import { Component } from "@/components/ui/loader-1";

/**
 * Màn hình chờ (splash) toàn trang khi mở app.
 *
 * Hiện ngay từ lúc render đầu (kể cả trước khi React hydrate) nên không bị "nháy"
 * nội dung, rồi mờ dần đi NGAY khi React hydrate xong — tức là đúng lúc trang đã
 * bấm được. Hiện lại mỗi lần tải/reload trang.
 *
 * Trước đây chỗ này chờ sự kiện `window.load` và giữ splash tối thiểu 600ms. Cả
 * hai đều là thời gian chờ tự chuốc: `load` chỉ bắn khi MỌI tài nguyên tải xong,
 * kể cả thẻ <audio> — nên ở trang làm bài chế độ thi (audio preload="auto", file
 * MP3 vài MB) splash treo lại vài giây dù đề đã render sẵn ở dưới.
 */
const FADE_MS = 200; // khớp với thời lượng transition mờ dần bên dưới

export const Preloader = () => {
  // Bắt đầu ở trạng thái hiển thị để splash có mặt ngay trong HTML đầu tiên.
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // useEffect chạy = React đã hydrate = trang đã tương tác được. Gỡ splash luôn.
    // requestAnimationFrame để trình duyệt kịp vẽ một khung có opacity 1 trước,
    // nếu không thì transition không chạy và splash biến mất giật cục.
    const frame = window.requestAnimationFrame(() => setFading(true));
    const timer = window.setTimeout(() => setVisible(false), FADE_MS);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background text-primary transition-opacity duration-200 ease-out"
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
