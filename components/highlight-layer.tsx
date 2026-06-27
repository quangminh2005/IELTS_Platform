"use client";

import { useEffect, useRef, useState, useTransition } from "react";

type Highlight = {
  id: string;
  selectedText: string;
  color: string;
  note: string | null;
  sourceType: string;
  startOffset?: number;
  endOffset?: number;
};

export type HighlightPayload = {
  selectedText: string;
  startOffset: number;
  endOffset: number;
  color: string;
  note: string;
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
  | { kind: "new"; x: number; y: number }
  | { kind: "existing"; x: number; y: number; id: string };

const colors = [
  { label: "Vàng", value: "yellow", swatch: "bg-yellow-300", mark: "bg-yellow-400/45" },
  { label: "Xanh lá", value: "green", swatch: "bg-emerald-300", mark: "bg-emerald-400/45" },
  { label: "Xanh dương", value: "blue", swatch: "bg-sky-300", mark: "bg-sky-400/45" },
  { label: "Hồng", value: "pink", swatch: "bg-pink-300", mark: "bg-pink-400/45" }
];

function markClass(color: string) {
  return colors.find((item) => item.value === color)?.mark ?? "bg-yellow-400/45";
}

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
      y: rect.top
    });
  }

  function openExisting(event: React.MouseEvent, id: string) {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setError(null);
    setPending(null);
    setPopup({ kind: "existing", x: rect.left + rect.width / 2, y: rect.top, id });
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
        <div
          ref={popupRef}
          style={{
            position: "fixed",
            left: popup.x,
            top: Math.max(popup.y, 56),
            transform: "translate(-50%, calc(-100% - 8px))",
            zIndex: 60
          }}
          className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2 shadow-pop"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="flex items-center gap-1.5">
            {colors.map((color) => (
              <button
                key={color.value}
                type="button"
                title={color.label}
                onClick={() =>
                  popup.kind === "new" ? applyNew(color.value) : recolor(popup.id, color.value)
                }
                className={`h-6 w-6 rounded-full border border-white/50 transition hover:scale-110 ${color.swatch}`}
              >
                <span className="sr-only">{color.label}</span>
              </button>
            ))}
            {popup.kind === "existing" ? (
              <button
                type="button"
                onClick={() => remove(popup.id)}
                title="Xoá đánh dấu"
                className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-red-400 hover:text-red-500"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5" aria-hidden="true">
                  <path d="M5 7h14M10 7V5h4v2M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="sr-only">Xoá đánh dấu</span>
              </button>
            ) : null}
          </div>

          {popup.kind === "new" ? (
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ghi chú (tuỳ chọn)"
              className="w-52 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
            />
          ) : activeNote ? (
            <p className="max-w-52 text-xs text-muted-foreground">{activeNote}</p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  );
}
