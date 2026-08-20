"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import {
  HighlightPopup,
  markClass,
  type HighlightPayload
} from "@/components/highlight-popup";
import { useSelectionCapture } from "@/components/use-selection-capture";

export type { HighlightPayload };

type Highlight = {
  id: string;
  selectedText: string;
  color: string;
  note: string | null;
  sourceType: string;
  startOffset?: number;
  endOffset?: number;
};

type HighlightLayerProps = {
  text: string;
  highlights?: Highlight[];
  onHighlight: (payload: HighlightPayload) => Promise<string>;
  onRemoveHighlight: (id: string) => Promise<void>;
};

type LocalHighlight = {
  id: string;
  selectedText: string;
  color: string;
  note: string | null;
  startOffset: number;
  endOffset: number;
  pending?: boolean;
};

type PendingSelection = {
  selectedText: string;
  startOffset: number;
  endOffset: number;
};

type Popup =
  | { kind: "new"; x: number; top: number; bottom: number }
  | { kind: "existing"; x: number; top: number; bottom: number; id: string };

function getSelectionOffsets(container: HTMLElement, range: Range) {
  const preSelectionRange = range.cloneRange();
  preSelectionRange.selectNodeContents(container);
  preSelectionRange.setEnd(range.startContainer, range.startOffset);

  const startOffset = preSelectionRange.toString().length;
  const selectedText = range.toString();

  return {
    selectedText,
    startOffset,
    endOffset: startOffset + selectedText.length
  };
}

type Segment = { key: string; value: string; color?: string; id?: string };

// Cắt văn bản thành các đoạn xen kẽ chữ thường và đoạn đã tô màu, dựa trên
// offset của từng highlight. Xử lý chồng lấn bằng cách cắt bớt phần đã dùng.
function buildSegments(text: string, items: LocalHighlight[]): Segment[] {
  const valid = items
    .map((item) => ({
      ...item,
      startOffset: Math.max(0, Math.min(item.startOffset, text.length)),
      endOffset: Math.max(0, Math.min(item.endOffset, text.length))
    }))
    .filter((item) => item.endOffset > item.startOffset)
    .sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);

  const segments: Segment[] = [];
  let cursor = 0;

  valid.forEach((item, index) => {
    const start = Math.max(item.startOffset, cursor);
    const end = item.endOffset;

    if (start >= end) {
      return;
    }

    if (start > cursor) {
      segments.push({ key: `t-${cursor}`, value: text.slice(cursor, start) });
    }

    segments.push({
      key: `h-${item.id}-${index}`,
      value: text.slice(start, end),
      color: item.color,
      id: item.id
    });
    cursor = end;
  });

  if (cursor < text.length) {
    segments.push({ key: `t-${cursor}`, value: text.slice(cursor) });
  }

  if (segments.length === 0) {
    segments.push({ key: "t-0", value: text });
  }

  return segments;
}

export function HighlightLayer({
  text,
  highlights = [],
  onHighlight,
  onRemoveHighlight
}: HighlightLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<LocalHighlight[]>(() =>
    highlights.map((highlight) => ({
      id: highlight.id,
      selectedText: highlight.selectedText,
      color: highlight.color,
      note: highlight.note,
      startOffset: highlight.startOffset ?? 0,
      endOffset: highlight.endOffset ?? 0
    }))
  );
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const [popup, setPopup] = useState<Popup | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function closePopup() {
    setPopup(null);
    setPending(null);
    setNote("");
  }

  // Đóng popup khi cuộn / đổi kích thước (toạ độ cố định sẽ lệch).
  useEffect(() => {
    if (!popup) {
      return;
    }

    function handleClose(event: Event) {
      if (
        event.type === "mousedown" &&
        popupRef.current?.contains(event.target as Node)
      ) {
        return;
      }

      closePopup();
    }

    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    document.addEventListener("mousedown", handleClose);

    return () => {
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
      document.removeEventListener("mousedown", handleClose);
    };
  }, [popup]);

  function captureSelection() {
    const container = containerRef.current;
    const activeSelection = window.getSelection();

    if (!container || !activeSelection || activeSelection.rangeCount === 0) {
      return;
    }

    const range = activeSelection.getRangeAt(0);

    if (
      range.collapsed ||
      !container.contains(range.commonAncestorContainer) ||
      !activeSelection.toString().trim()
    ) {
      return;
    }

    const rect = range.getBoundingClientRect();
    const offsets = getSelectionOffsets(container, range);

    setError(null);
    setPending(offsets);
    setPopup({
      kind: "new",
      x: rect.left + rect.width / 2,
      top: rect.top,
      bottom: rect.bottom
    });
  }

  // Điện thoại không bắn `mouseup` khi nhấn–giữ bôi đen, phải nghe thêm
  // `selectionchange` thì học sinh dùng điện thoại mới tô màu được.
  useSelectionCapture(captureSelection);

  function openExisting(event: React.MouseEvent, id: string) {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setError(null);
    setPending(null);
    setPopup({
      kind: "existing",
      x: rect.left + rect.width / 2,
      top: rect.top,
      bottom: rect.bottom,
      id
    });
  }

  function persistNew(local: LocalHighlight) {
    startTransition(async () => {
      try {
        const realId = await onHighlight({
          selectedText: local.selectedText,
          startOffset: local.startOffset,
          endOffset: local.endOffset,
          color: local.color,
          note: local.note ?? ""
        });

        setItems((previous) =>
          previous.map((item) =>
            item.id === local.id ? { ...item, id: realId, pending: false } : item
          )
        );
      } catch {
        setItems((previous) => previous.filter((item) => item.id !== local.id));
        setError("Không lưu được đánh dấu.");
      }
    });
  }

  function applyNew(color: string) {
    if (!pending) {
      return;
    }

    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const local: LocalHighlight = {
      id: tempId,
      selectedText: pending.selectedText.trim(),
      color,
      note: note.trim() ? note.trim() : null,
      startOffset: pending.startOffset,
      endOffset: pending.endOffset,
      pending: true
    };

    setItems((previous) => [...previous, local]);
    window.getSelection()?.removeAllRanges();
    closePopup();
    persistNew(local);
  }

  function recolor(id: string, color: string) {
    const target = items.find((item) => item.id === id);

    if (!target || target.pending) {
      closePopup();
      return;
    }

    // Đổi màu = xoá cái cũ rồi tạo lại cùng vị trí với màu mới.
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const replacement: LocalHighlight = { ...target, id: tempId, color, pending: true };

    setItems((previous) => previous.map((item) => (item.id === id ? replacement : item)));
    closePopup();

    startTransition(async () => {
      try {
        await onRemoveHighlight(id);
      } catch {
        // Vẫn tiếp tục tạo bản mới; bản cũ sẽ được dọn khi tải lại.
      }
      persistNew(replacement);
    });
  }

  function remove(id: string) {
    const target = items.find((item) => item.id === id);
    setItems((previous) => previous.filter((item) => item.id !== id));
    closePopup();

    if (!target || target.pending) {
      return;
    }

    startTransition(async () => {
      try {
        await onRemoveHighlight(id);
      } catch {
        setError("Không xoá được đánh dấu.");
      }
    });
  }

  const segments = buildSegments(text, items);
  const activeNote =
    popup?.kind === "existing"
      ? items.find((item) => item.id === popup.id)?.note ?? null
      : null;

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        onMouseUp={captureSelection}
        onKeyUp={captureSelection}
        className="whitespace-pre-wrap rounded-md border border-border bg-background/50 p-4 text-sm leading-7 text-foreground"
      >
        {segments.map((segment) =>
          segment.color ? (
            <mark
              key={segment.key}
              onClick={(event) => segment.id && openExisting(event, segment.id)}
              className={`cursor-pointer rounded-[2px] text-inherit ${markClass(segment.color)}`}
            >
              {segment.value}
            </mark>
          ) : (
            <span key={segment.key}>{segment.value}</span>
          )
        )}
      </div>

      {popup ? (
        <HighlightPopup
          popupRef={popupRef}
          kind={popup.kind}
          x={popup.x}
          top={popup.top}
          bottom={popup.bottom}
          note={note}
          onNoteChange={setNote}
          activeNote={activeNote}
          onPickColor={(color) =>
            popup.kind === "new" ? applyNew(color) : recolor(popup.id, color)
          }
          onRemove={() => popup.kind === "existing" && remove(popup.id)}
        />
      ) : null}

      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  );
}
