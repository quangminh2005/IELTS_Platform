"use client";

import { useEffect, useRef } from "react";

/*
  Bắt thao tác bôi đen chữ trên CẢ máy tính lẫn điện thoại.

  Trước đây hai vùng tô màu chỉ nghe `mouseup`. Trên máy tính thì đúng, nhưng
  trình duyệt điện thoại chỉ giả lập sự kiện chuột cho cú CHẠM ĐƠN: cử chỉ
  nhấn–giữ để bôi đen và thao tác kéo hai tay cầm vùng chọn đều bị hệ thống nuốt,
  không hề có `mouseup`. Hậu quả: học sinh làm bài trên điện thoại bôi đen được
  chữ nhưng popup chọn màu không bao giờ hiện ra.

  Nên ở đây nghe `selectionchange` — sự kiện chạy trên mọi thiết bị — rồi chờ
  vùng chọn đứng yên một nhịp mới mở popup, tránh popup nhấp nháy trong lúc
  người dùng còn đang kéo.
*/

// Vùng chọn phải đứng yên chừng này mới coi là chọn xong.
export const SELECTION_SETTLE_MS = 320;

export function useSelectionCapture(onCapture: () => void) {
  const captureRef = useRef(onCapture);
  captureRef.current = onCapture;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Chuột/ngón tay còn đang giữ nghĩa là vùng chọn chưa xong.
    let pointerDown = false;
    // Máy tính đã có `mouseup` lo phần mở popup; đừng làm thêm lần nữa.
    let pointerType = "";

    function clear() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }

    function schedule() {
      clear();
      timer = setTimeout(() => {
        timer = null;

        if (pointerDown) {
          return;
        }

        captureRef.current();
      }, SELECTION_SETTLE_MS);
    }

    function handlePointerDown(event: PointerEvent) {
      pointerDown = true;
      pointerType = event.pointerType;
      clear();
    }

    function handlePointerUp() {
      pointerDown = false;

      // Nhấc ngón tay sau khi bôi đen: đây mới là lúc mở popup trên điện thoại.
      if (pointerType !== "mouse") {
        schedule();
      }
    }

    function handleSelectionChange() {
      schedule();
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("pointerup", handlePointerUp, true);
    document.addEventListener("pointercancel", handlePointerUp, true);
    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      clear();
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("pointerup", handlePointerUp, true);
      document.removeEventListener("pointercancel", handlePointerUp, true);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);
}
