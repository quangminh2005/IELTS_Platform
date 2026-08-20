"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";

import {
  NO_TRANSLATE_NOTICE,
  NO_TRANSLATE_NOTICE_MS,
  shouldBlockContextMenu
} from "@/lib/no-translate";

/*
  Khiên chặn công cụ dịch cho vùng đoạn văn + khối câu hỏi khi đang làm bài.

  Ba lớp, đặt MỘT LẦN trên thẻ bọc:
  - translate="no" + class "notranslate": Chrome dịch cả trang và các tiện ích
    (Google Dịch, Immersive Translate) đều bỏ qua vùng này.
  - onContextMenu: chặn menu chuột phải, tức mất luôn "Dịch mục đã chọn" và
    "Tìm trên Google".
  - spellCheck={false}: tắt gạch chân đỏ báo sai chính tả trong mọi ô đáp án bên
    trong — IELTS chấm cả chính tả, thi thật không có gợi ý này.

  Hai thuộc tính `translate` và `spellcheck` DI TRUYỀN xuống con cháu theo chuẩn
  HTML, nên đặt ở thẻ bọc là phủ hết đoạn văn, câu hỏi và mọi <input> bên trong —
  không phải sửa từng chỗ, và không sót khi sau này thêm dạng câu hỏi mới.
*/

export type NoTranslateGuardProps = {
  translate: "no";
  className: string;
  spellCheck: false;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
};

export function useNoTranslateGuard(className = ""): {
  guardProps: NoTranslateGuardProps;
  notice: ReactNode;
} {
  // Loại con trỏ của cú `pointerdown` gần nhất. Dùng ref chứ không dùng state:
  // giá trị này chỉ để đọc trong handler, đổi nó không cần vẽ lại gì cả.
  const pointerTypeRef = useRef<string | null>(null);
  // Object mới mỗi lần bấm: bấm liên tục thì đặt lại đồng hồ 3 giây chứ không
  // xếp chồng thêm toast.
  const [flash, setFlash] = useState<{ at: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  // Chỉ dựng portal sau khi mount ở client (document.body đã sẵn sàng).
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!flash) {
      return;
    }

    const timer = window.setTimeout(() => setFlash(null), NO_TRANSLATE_NOTICE_MS);

    return () => window.clearTimeout(timer);
  }, [flash]);

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    pointerTypeRef.current = event.pointerType;
  }

  function handleContextMenu(event: ReactMouseEvent<HTMLElement>) {
    if (!shouldBlockContextMenu(pointerTypeRef.current)) {
      return;
    }

    event.preventDefault();
    setFlash({ at: Date.now() });
  }

  const guardProps: NoTranslateGuardProps = {
    translate: "no",
    // GHÉP thêm, không ghi đè: thẻ cha truyền class khoảng cách vào đây.
    className: [className, "notranslate"].filter(Boolean).join(" "),
    spellCheck: false,
    onPointerDown: handlePointerDown,
    onContextMenu: handleContextMenu
  };

  const notice =
    mounted && flash
      ? createPortal(
          <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-4">
            <div
              role="status"
              className="flex max-w-md items-center gap-2 rounded-xl border border-amber-400/60 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 shadow-pop animate-fade-in dark:bg-amber-950 dark:text-amber-100"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                className="h-5 w-5 shrink-0"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
              </svg>
              <span className="min-w-0 break-words leading-6">{NO_TRANSLATE_NOTICE}</span>
            </div>
          </div>,
          document.body
        )
      : null;

  return { guardProps, notice };
}
