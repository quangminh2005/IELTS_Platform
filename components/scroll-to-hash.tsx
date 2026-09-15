"use client";

import { useEffect } from "react";

type ScrollToHashProps = {
  // id của phần tử cần cuộn tới (không kèm dấu #).
  id: string;
};

// Next 14 (App Router) cuộn tới #hash NGAY khi chuyển trang — lúc đó loading.tsx còn
// đang hiện nên phần tử chưa tồn tại và trang đứng nguyên ở đầu. Component này chạy
// sau khi nội dung thật đã mount, nên cuộn được. Không render gì.
export function ScrollToHash({ id }: ScrollToHashProps) {
  useEffect(() => {
    if (window.location.hash !== `#${id}`) {
      return;
    }

    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [id]);

  return null;
}
