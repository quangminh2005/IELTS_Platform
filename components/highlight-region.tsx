"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";

import {
  HighlightPopup,
  highlightColors,
  type HighlightPayload
} from "@/components/highlight-popup";

/*
  Tô màu cho KHỐI CÂU HỎI.

  Khác với <HighlightLayer> (đoạn văn thuần, cắt chuỗi thành <mark>), khối câu
  hỏi là JSX phức tạp do React quản lý: ô nhập đáp án, nút cờ, thẻ kéo–thả…
  Chèn thêm <mark> vào đó sẽ bị React ghi đè ở lần render kế tiếp.

  Nên ở đây dùng CSS Custom Highlight API: giữ nguyên DOM, chỉ đăng ký các
  Range với trình duyệt rồi tô bằng ::highlight() (xem app/globals.css). Sau
  mỗi lần render, các Range được dựng lại từ offset đã lưu nên không bao giờ
  "mất dấu" khi React vẽ lại.
*/

type StoredHighlight = {
  id: string;
  selectedText: string;
  color: string;
  note: string | null;
  startOffset?: number;
  endOffset?: number;
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

type HighlightRegionProps = {
  highlights?: StoredHighlight[];
  onHighlight: (payload: HighlightPayload) => Promise<string>;
  onRemoveHighlight: (id: string) => Promise<void>;
  // Lớp CSS của thẻ bọc — phải giữ nguyên khoảng cách (space-y-*) mà khối câu
  // hỏi vốn nhận từ thẻ cha, vì bọc thêm một tầng div sẽ làm mất selector "> *".
  className?: string;
  children: React.ReactNode;
};

const HIGHLIGHT_PREFIX = "ielts-hl-";

// CSS.highlights là sổ đăng ký DÙNG CHUNG cho cả tài liệu, trong khi mỗi phần
// thi lại có một vùng tô riêng. Gom Range của mọi vùng vào đây rồi ghi lại một
// lần cho từng màu, tránh vùng này ghi đè vùng kia.
const regionRanges = new Map<string, Map<string, Range[]>>();

type HighlightRegistryLike = {
  set: (name: string, highlight: Highlight) => void;
  delete: (name: string) => void;
};

function highlightRegistry(): HighlightRegistryLike | null {
  if (typeof window === "undefined" || typeof CSS === "undefined") {
    return null;
  }

  const registry = (CSS as unknown as { highlights?: HighlightRegistryLike }).highlights;
  const constructor = (window as unknown as { Highlight?: unknown }).Highlight;

  return registry && typeof constructor === "function" ? registry : null;
}

function flushRegistry() {
  const registry = highlightRegistry();

  if (!registry) {
    return;
  }

  highlightColors.forEach((color) => {
    const ranges: Range[] = [];

    regionRanges.forEach((byColor) => {
      const list = byColor.get(color.value);

      if (list) {
        ranges.push(...list);
      }
    });

    const name = `${HIGHLIGHT_PREFIX}${color.value}`;

    if (ranges.length === 0) {
      registry.delete(name);
    } else {
      registry.set(name, new Highlight(...ranges));
    }
  });
}

// Danh sách text node theo đúng thứ tự tài liệu — nối lại sẽ ra chính chuỗi mà
// Range.toString() trả về, nên offset lưu trong DB khớp cả hai chiều.
function collectTextNodes(container: HTMLElement) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node = walker.nextNode();

  while (node) {
    nodes.push(node as Text);
    node = walker.nextNode();
  }

  return nodes;
}

function locate(nodes: Text[], offset: number) {
  let cursor = 0;

  for (const node of nodes) {
    const length = node.data.length;

    if (offset <= cursor + length) {
      return { node, offset: offset - cursor };
    }

    cursor += length;
  }

  return null;
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

// Dựng lại Range từ offset. Nội dung khối câu hỏi có thể xê dịch giữa hai lần
// vào bài (vd thẻ kéo–thả đã nằm trong ô trống), nên nếu chữ tại offset cũ
// không còn khớp thì dò lại theo đúng đoạn chữ đã tô; không thấy thì bỏ qua.
function resolveRange(nodes: Text[], fullText: string, item: LocalHighlight) {
  const expected = item.selectedText.trim();
  let { startOffset, endOffset } = item;

  if (expected && fullText.slice(startOffset, endOffset).trim() !== expected) {
    const found = fullText.indexOf(expected);

    if (found < 0) {
      return null;
    }

    startOffset = found;
    endOffset = found + expected.length;
  }

  const start = locate(nodes, startOffset);
  const end = locate(nodes, endOffset);

  if (!start || !end || startOffset >= endOffset) {
    return null;
  }

  const range = document.createRange();

  try {
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
  } catch {
    return null;
  }

  return range.collapsed ? null : range;
}

function hitTest(resolved: Array<{ id: string; range: Range }>, x: number, y: number) {
  for (const entry of resolved) {
    const rects = entry.range.getClientRects();

    for (let index = 0; index < rects.length; index += 1) {
      const rect = rects[index];

      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return entry.id;
      }
    }
  }

  return null;
}

// Bấm vào ô nhập / nút bấm là để làm bài, không phải để mở popup tô màu.
const interactiveSelector = "input, textarea, select, button, a, label, [draggable='true']";

export function HighlightRegion({
  highlights = [],
  onHighlight,
  onRemoveHighlight,
  className,
  children
}: HighlightRegionProps) {
  const regionId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const resolvedRef = useRef<Array<{ id: string; range: Range }>>([]);
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
  const [, startTransition] = useTransition();

  // Chạy sau MỌI lần render: dựng lại Range từ offset rồi đăng ký với trình
  // duyệt. Nhờ vậy tô màu vẫn đúng chỗ sau khi React vẽ lại khối câu hỏi.
  useEffect(() => {
    const container = containerRef.current;

    if (!container || !highlightRegistry()) {
      return;
    }

    const nodes = collectTextNodes(container);
    const fullText = nodes.map((node) => node.data).join("");
    const byColor = new Map<string, Range[]>();
    const resolved: Array<{ id: string; range: Range }> = [];

    items.forEach((item) => {
      const range = resolveRange(nodes, fullText, item);

      if (!range) {
        return;
      }

      resolved.push({ id: item.id, range });
      const list = byColor.get(item.color) ?? [];
      list.push(range);
      byColor.set(item.color, list);
    });

    resolvedRef.current = resolved;
    regionRanges.set(regionId, byColor);
    flushRegistry();
  });

  useEffect(() => {
    return () => {
      regionRanges.delete(regionId);
      flushRegistry();
    };
  }, [regionId]);

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

    setPending(offsets);
    setPopup({ kind: "new", x: rect.left + rect.width / 2, y: rect.top });
  }

  // Bấm vào chỗ đã tô: mở popup để đổi màu / xoá. Vì không có phần tử <mark>
  // để gắn onClick, phải dò theo toạ độ chuột trên các Range đang tô.
  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (window.getSelection()?.toString().trim()) {
      return;
    }

    if ((event.target as HTMLElement).closest(interactiveSelector)) {
      return;
    }

    const id = hitTest(resolvedRef.current, event.clientX, event.clientY);

    if (!id) {
      return;
    }

    setPending(null);
    setPopup({ kind: "existing", x: event.clientX, y: event.clientY - 4, id });
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
      }
    });
  }

  function applyNew(color: string) {
    if (!pending) {
      return;
    }

    const local: LocalHighlight = {
      id: `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
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
    const replacement: LocalHighlight = {
      ...target,
      id: `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      color,
      pending: true
    };

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
        // Bỏ qua: lần tải lại sau sẽ lấy đúng trạng thái từ máy chủ.
      }
    });
  }

  const activeNote =
    popup?.kind === "existing"
      ? items.find((item) => item.id === popup.id)?.note ?? null
      : null;

  return (
    <>
      <div
        ref={containerRef}
        onMouseUp={captureSelection}
        onClick={handleClick}
        className={className}
      >
        {children}
      </div>

      {popup ? (
        <HighlightPopup
          popupRef={popupRef}
          kind={popup.kind}
          x={popup.x}
          y={popup.y}
          note={note}
          onNoteChange={setNote}
          activeNote={activeNote}
          onPickColor={(color) =>
            popup.kind === "new" ? applyNew(color) : recolor(popup.id, color)
          }
          onRemove={() => popup.kind === "existing" && remove(popup.id)}
        />
      ) : null}
    </>
  );
}
