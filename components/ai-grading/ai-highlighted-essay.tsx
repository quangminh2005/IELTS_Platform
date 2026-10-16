"use client";

import { useMemo, useRef, useState } from "react";
import { buildHighlightSegments, locateQuotes } from "@/lib/ai-grading/locate";
import {
  AI_ERROR_CATEGORY_LABELS,
  AI_ERROR_CRITERION,
  type AiError
} from "@/lib/ai-grading/types";

// Chip lọc lỗi theo tiêu chí band (kiểu youpass.vn). Task Achievement không có lỗi câu
// chữ nên không có chip.
const CRITERION_FILTERS = [
  { key: "coherence", label: "Mạch lạc (CC)" },
  { key: "lexicalResource", label: "Từ vựng (LR)" },
  { key: "grammar", label: "Ngữ pháp (GRA)" }
] as const;
type CriterionFilter = (typeof CRITERION_FILTERS)[number]["key"] | "all";

const chipClass =
  "rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary";
const activeChipClass =
  "rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary";

// Bài viết của học viên có tô màu lỗi AI tìm thấy + danh sách lỗi bên dưới. Chạm một
// lỗi (trong bài hay trong danh sách) thì đoạn đó sáng lên — dùng được trên điện thoại
// vì không dựa vào hover.
export function AiHighlightedEssay({ text, errors: allErrors }: { text: string; errors: AiError[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [filter, setFilter] = useState<CriterionFilter>("all");
  const marks = useRef<Record<number, HTMLElement | null>>({});
  const errors = useMemo(
    () =>
      filter === "all"
        ? allErrors
        : allErrors.filter((error) => AI_ERROR_CRITERION[error.category] === filter),
    [allErrors, filter]
  );
  const segments = useMemo(
    () => buildHighlightSegments(text, locateQuotes(text, errors.map((error) => error.quote))),
    [text, errors]
  );
  const counts = CRITERION_FILTERS.map((criterion) => ({
    ...criterion,
    count: allErrors.filter((error) => AI_ERROR_CRITERION[error.category] === criterion.key).length
  }));

  function choose(next: CriterionFilter) {
    setFilter(next);
    setActive(null);
  }

  function focus(index: number) {
    setActive(index);
    marks.current[index]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  return (
    <div className="space-y-3">
      {allErrors.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => choose("all")}
            className={filter === "all" ? activeChipClass : chipClass}
          >
            Tất cả <span className="tabular-nums opacity-70">{allErrors.length}</span>
          </button>
          {counts.map((criterion) => (
            <button
              key={criterion.key}
              type="button"
              disabled={criterion.count === 0}
              onClick={() => choose(filter === criterion.key ? "all" : criterion.key)}
              className={`${filter === criterion.key ? activeChipClass : chipClass} disabled:cursor-default disabled:opacity-50`}
            >
              {criterion.label} <span className="tabular-nums opacity-70">{criterion.count}</span>
            </button>
          ))}
        </div>
      ) : null}
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
