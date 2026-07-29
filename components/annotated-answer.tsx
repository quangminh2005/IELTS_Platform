"use client";

import { useRef, useState } from "react";
import { createAnswerAnnotation, deleteAnswerAnnotation } from "@/lib/actions/annotations";

export type Annotation = {
  id: string;
  startOffset: number;
  endOffset: number;
  quote: string;
  note: string;
};

type AnnotatedAnswerProps = {
  text: string;
  annotations: Annotation[];
  // Khi editable: giáo viên có thể bôi đen tạo ghi chú và xoá. Khi không: chỉ xem.
  editable?: boolean;
  answerId?: string;
  attemptId?: string;
};

type Segment =
  | { type: "text"; text: string }
  | { type: "mark"; text: string; annotation: Annotation; index: number };

// Tính offset ký tự từ đầu container tới một điểm (node, offset) của selection.
// Dùng Range.toString().length nên các số thứ tự hiển thị bằng CSS ::after không
// bị tính vào — offset luôn khớp với chuỗi gốc.
function offsetWithin(container: HTMLElement, node: Node, nodeOffset: number): number {
  const range = document.createRange();
  range.setStart(container, 0);
  range.setEnd(node, nodeOffset);
  return range.toString().length;
}

function buildSegments(text: string, annotations: Annotation[]): Segment[] {
  const sorted = [...annotations]
    .filter((a) => a.endOffset > a.startOffset && a.startOffset < text.length)
    .sort((a, b) => a.startOffset - b.startOffset);

  const segments: Segment[] = [];
  let cursor = 0;

  sorted.forEach((annotation, index) => {
    const start = Math.max(annotation.startOffset, cursor);
    const end = Math.min(annotation.endOffset, text.length);
    if (start >= end) {
      return;
    }
    if (start > cursor) {
      segments.push({ type: "text", text: text.slice(cursor, start) });
    }
    segments.push({ type: "mark", text: text.slice(start, end), annotation, index: index + 1 });
    cursor = end;
  });

  if (cursor < text.length) {
    segments.push({ type: "text", text: text.slice(cursor) });
  }

  return segments;
}

export function AnnotatedAnswer({
  text,
  annotations,
  editable = false,
  answerId,
  attemptId
}: AnnotatedAnswerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<{
    start: number;
    end: number;
    quote: string;
    x: number;
    y: number;
  } | null>(null);
  const [note, setNote] = useState("");

  const segments = buildSegments(text, annotations);
  const indexById = new Map(
    segments
      .filter((s): s is Extract<Segment, { type: "mark" }> => s.type === "mark")
      .map((s) => [s.annotation.id, s.index])
  );

  function handleMouseUp() {
    if (!editable) {
      return;
    }
    const container = containerRef.current;
    const selection = window.getSelection();
    if (!container || !selection || selection.isCollapsed || selection.rangeCount === 0) {
      return;
    }
    const range = selection.getRangeAt(0);
    if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
      return;
    }
    let start = offsetWithin(container, range.startContainer, range.startOffset);
    let end = offsetWithin(container, range.endContainer, range.endOffset);
    if (start > end) {
      [start, end] = [end, start];
    }
    const quote = text.slice(start, end);
    if (!quote.trim()) {
      return;
    }
    const rect = range.getBoundingClientRect();
    setNote("");
    setPending({ start, end, quote, x: rect.left, y: rect.bottom });
  }

  return (
    <div className="relative">
      {/* Gợi ý đặt TRƯỚC bài làm và có khung màu: bản cũ là chữ xám nhạt nằm dưới
          cuối bài nên gần như không ai thấy — tính năng ghi chú lỗi coi như ẩn. */}
      {editable ? (
        <p className="mb-3 flex items-center gap-1.5 rounded-md border border-amber-400/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
          <span aria-hidden>✍️</span>
          Bôi đen một đoạn trong bài để thêm ghi chú lỗi ngay tại chỗ.
        </p>
      ) : null}

      <div
        ref={containerRef}
        onMouseUp={editable ? handleMouseUp : undefined}
        className={`whitespace-pre-wrap text-[15px] leading-[1.7] ${
          editable ? "cursor-text select-text" : ""
        }`}
      >
        {segments.map((segment, i) =>
          segment.type === "text" ? (
            <span key={i}>{segment.text}</span>
          ) : (
            <mark
              key={i}
              data-index={segment.index}
              title={segment.annotation.note}
              className="rounded-sm bg-amber-300/40 px-0.5 text-inherit after:align-super after:text-[10px] after:font-semibold after:text-amber-600 after:content-[attr(data-index)] dark:bg-amber-400/25 dark:after:text-amber-300"
            >
              {segment.text}
            </mark>
          )
        )}
      </div>

      {annotations.length > 0 ? (
        <ol className="mt-3 space-y-2">
          {annotations.map((annotation) => (
            <li
              key={annotation.id}
              className="rounded-md border border-amber-300/40 bg-amber-50/60 p-3 text-sm dark:border-amber-400/25 dark:bg-amber-400/10"
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/30 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  {indexById.get(annotation.id) ?? "•"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs italic text-muted-foreground">“{annotation.quote}”</p>
                  <p className="mt-1 leading-6">{annotation.note}</p>
                </div>
                {editable ? (
                  <form action={deleteAnswerAnnotation}>
                    <input type="hidden" name="annotationId" value={annotation.id} />
                    <input type="hidden" name="attemptId" value={attemptId ?? ""} />
                    <button
                      type="submit"
                      aria-label="Xoá ghi chú"
                      className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition hover:border-red-400 hover:text-red-500"
                    >
                      ✕
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {pending && editable && answerId ? (
        <div
          className="fixed z-50 w-72 rounded-lg border border-border bg-card p-3 shadow-card"
          style={{ left: Math.max(8, pending.x), top: pending.y + 6 }}
        >
          <p className="text-xs italic text-muted-foreground">“{pending.quote}”</p>
          <form
            action={createAnswerAnnotation}
            onSubmit={() => setPending(null)}
            className="mt-2 space-y-2"
          >
            <input type="hidden" name="answerId" value={answerId} />
            <input type="hidden" name="startOffset" value={pending.start} />
            <input type="hidden" name="endOffset" value={pending.end} />
            <input type="hidden" name="quote" value={pending.quote} />
            <textarea
              name="note"
              rows={3}
              required
              autoFocus
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ghi chú lỗi cho đoạn này…"
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                Lưu ghi chú
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary"
              >
                Huỷ
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
