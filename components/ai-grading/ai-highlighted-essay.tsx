"use client";

import { useMemo, useRef, useState } from "react";
import { buildHighlightSegments, locateQuotes } from "@/lib/ai-grading/locate";
import { AI_ERROR_CATEGORY_LABELS, type AiError } from "@/lib/ai-grading/types";

// Bài viết của học viên có tô màu lỗi AI tìm thấy + danh sách lỗi bên dưới. Chạm một
// lỗi (trong bài hay trong danh sách) thì đoạn đó sáng lên — dùng được trên điện thoại
// vì không dựa vào hover.
export function AiHighlightedEssay({ text, errors }: { text: string; errors: AiError[] }) {
  const [active, setActive] = useState<number | null>(null);
  const marks = useRef<Record<number, HTMLElement | null>>({});
  const segments = useMemo(
    () => buildHighlightSegments(text, locateQuotes(text, errors.map((error) => error.quote))),
    [text, errors]
  );

  function focus(index: number) {
    setActive(index);
    marks.current[index]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap break-words rounded-md border border-border bg-background p-4 text-sm leading-7">
        {segments.map((segment, position) => {
          const index = segment.index;
          if (index === null) {
            return <span key={position}>{segment.text}</span>;
          }
          return (
            <mark
              key={position}
              ref={(element) => {
                marks.current[index] = element;
              }}
              onClick={() => setActive(index)}
              className={`cursor-pointer rounded px-0.5 text-foreground ${
                active === index
                  ? "bg-amber-300/90 ring-2 ring-amber-500 dark:bg-amber-500/60"
                  : "bg-amber-200/70 dark:bg-amber-500/30"
              }`}
            >
              {segment.text}
            </mark>
          );
        })}
      </p>

      {errors.length > 0 ? (
        <ol className="space-y-2">
          {errors.map((error, index) => (
            <li key={error.id}>
              <button
                type="button"
                onClick={() => focus(index)}
                className={`w-full rounded-md border p-2 text-left text-sm transition ${
                  active === index
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-border bg-card hover:border-amber-400"
                }`}
              >
                <span className="rounded bg-red-500/10 px-1 text-red-700 line-through decoration-red-500/60 dark:text-red-300">
                  {error.quote}
                </span>{" "}
                → <span className="font-medium text-emerald-700 dark:text-emerald-300">{error.correction}</span>
                <span className="ml-2 rounded-full border border-border px-1.5 text-[11px] text-muted-foreground">
                  {AI_ERROR_CATEGORY_LABELS[error.category]}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">{error.explanation}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs italic text-muted-foreground">AI không tìm thấy lỗi ngôn ngữ đáng kể.</p>
      )}
    </div>
  );
}
