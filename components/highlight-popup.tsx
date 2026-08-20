"use client";

import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

import {
  placeHighlightPopup,
  type PopupPlacement
} from "@/lib/highlight-popup-position";

// Bảng màu + popup chọn màu dùng chung cho hai kiểu tô màu:
//  - <HighlightLayer>: tô trên đoạn văn thuần (cắt chuỗi thành <mark>).
//  - <HighlightRegion>: tô trên khối câu hỏi (JSX phức tạp, dùng CSS Custom
//    Highlight API nên không đụng vào DOM của React).
export const highlightColors = [
  { label: "Vàng", value: "yellow", swatch: "bg-yellow-300", mark: "bg-yellow-400/45" },
  { label: "Xanh lá", value: "green", swatch: "bg-emerald-300", mark: "bg-emerald-400/45" },
  { label: "Xanh dương", value: "blue", swatch: "bg-sky-300", mark: "bg-sky-400/45" },
  { label: "Hồng", value: "pink", swatch: "bg-pink-300", mark: "bg-pink-400/45" }
];

export function markClass(color: string) {
  return highlightColors.find((item) => item.value === color)?.mark ?? "bg-yellow-400/45";
}

export type HighlightPayload = {
  selectedText: string;
  startOffset: number;
  endOffset: number;
  color: string;
  note: string;
};

type HighlightPopupProps = {
  popupRef: RefObject<HTMLDivElement>;
  kind: "new" | "existing";
  // Tâm ngang cùng mép trên/mép dưới của đoạn đang bôi đen.
  x: number;
  top: number;
  bottom: number;
  note: string;
  onNoteChange: (value: string) => void;
  activeNote: string | null;
  onPickColor: (color: string) => void;
  onRemove: () => void;
};

export function HighlightPopup({
  popupRef,
  kind,
  x,
  top,
  bottom,
  note,
  onNoteChange,
  activeNote,
  onPickColor,
  onRemove
}: HighlightPopupProps) {
  // Đo kích thước thật rồi mới đặt chỗ: màn hình điện thoại hẹp, popup rộng hơn
  // 220px nên bôi đen sát mép là popup lòi ra ngoài, bấm không tới màu nào.
  const [placement, setPlacement] = useState<PopupPlacement | null>(null);

  useEffect(() => {
    const node = popupRef.current;

    if (!node) {
      return;
    }

    const rect = node.getBoundingClientRect();

    setPlacement(
      placeHighlightPopup({
        x,
        top,
        bottom,
        width: rect.width,
        height: rect.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      })
    );
  }, [popupRef, x, top, bottom, kind, activeNote]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={popupRef}
      style={{
        position: "fixed",
        left: placement ? placement.left : x,
        top: placement ? placement.top : top,
        // Chưa đo xong thì giấu đi, tránh popup nháy ở sai chỗ một khung hình.
        visibility: placement ? "visible" : "hidden",
        zIndex: 60
      }}
      className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2 shadow-pop"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center gap-1.5">
        {highlightColors.map((color) => (
          <button
            key={color.value}
            type="button"
            title={color.label}
            onClick={() => onPickColor(color.value)}
            className={`h-6 w-6 rounded-full border border-white/50 transition hover:scale-110 ${color.swatch}`}
          >
            <span className="sr-only">{color.label}</span>
          </button>
        ))}
        {kind === "existing" ? (
          <button
            type="button"
            onClick={onRemove}
            title="Xoá đánh dấu"
            className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-red-400 hover:text-red-500"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path
                d="M5 7h14M10 7V5h4v2M6 7l1 13h10l1-13"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="sr-only">Xoá đánh dấu</span>
          </button>
        ) : null}
      </div>

      {kind === "new" ? (
        <input
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="Ghi chú (tuỳ chọn)"
          className="w-52 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
        />
      ) : activeNote ? (
        <p className="max-w-52 text-xs text-muted-foreground">{activeNote}</p>
      ) : null}
    </div>,
    document.body
  );
}
