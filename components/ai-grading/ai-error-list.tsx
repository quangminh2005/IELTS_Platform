"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createAnswerAnnotation } from "@/lib/actions/annotations";
import { locateQuote } from "@/lib/ai-grading/locate";
import { AI_ERROR_CATEGORY_LABELS, type AiError } from "@/lib/ai-grading/types";

function hiddenKey(aiReviewId: string) {
  return `aiErrorsHidden:${aiReviewId}`;
}

function readHidden(key: string): Set<string> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function writeHidden(key: string, ids: Set<string>) {
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(ids)));
  } catch {
    // bỏ qua: chế độ riêng tư có thể chặn localStorage
  }
}

// Lỗi AI tìm thấy trong MỘT bài luận Writing: Giữ → thành ghi chú tại chỗ (giống ghi
// chú thầy tự bôi); Bỏ → chỉ ẩn trên máy thầy.
export function AiErrorList({
  aiReviewId,
  answerId,
  text,
  errors
}: {
  aiReviewId: string;
  answerId: string;
  text: string;
  errors: AiError[];
}) {
  const router = useRouter();
  const key = hiddenKey(aiReviewId);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setHidden(readHidden(key));
  }, [key]);

  if (errors.length === 0) return null;

  const visible = errors.filter((error) => !hidden.has(error.id));

  function hide(ids: string[]) {
    setHidden((current) => {
      const next = new Set(current);
      ids.forEach((id) => next.add(id));
      writeHidden(key, next);
      return next;
    });
  }

  async function keep(list: AiError[]) {
    setBusy(true);
    setMessage(null);
    const handled: string[] = [];
    try {
      for (const error of list) {
        const span = locateQuote(text, error.quote);
        if (span) {
          const form = new FormData();
          form.set("answerId", answerId);
          form.set("startOffset", String(span.start));
          form.set("endOffset", String(span.end));
          form.set("quote", text.slice(span.start, span.end));
          form.set("note", `→ ${error.correction}. ${error.explanation}`.slice(0, 2000));
          await createAnswerAnnotation(form);
        }
        handled.push(error.id);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không lưu được ghi chú.");
    } finally {
      hide(handled);
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <div className="mt-3 rounded-md border border-violet-400/40 bg-violet-500/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">
          Lỗi AI tìm thấy ({visible.length})
        </p>
        {visible.length > 1 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => keep(visible)}
            className="text-xs font-semibold text-primary underline underline-offset-2 disabled:opacity-50"
          >
            Giữ tất cả
          </button>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <p className="mt-2 text-xs italic text-muted-foreground">Đã xử lý hết lỗi AI tìm thấy.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {visible.map((error) => (
            <li key={error.id} className="rounded-md border border-border bg-background p-2 text-sm">
              <p>
                <span className="rounded bg-red-500/10 px-1 text-red-700 line-through decoration-red-500/60 dark:text-red-300">
                  {error.quote}
                </span>{" "}
                → <span className="font-medium text-emerald-700 dark:text-emerald-300">{error.correction}</span>
                <span className="ml-2 rounded-full border border-border px-1.5 text-[11px] text-muted-foreground">
                  {AI_ERROR_CATEGORY_LABELS[error.category]}
                </span>
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{error.explanation}</p>
              <div className="mt-1.5 flex gap-4 text-xs font-semibold">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => keep([error])}
                  className="text-primary disabled:opacity-50"
                >
                  Giữ
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => hide([error.id])}
                  className="text-muted-foreground disabled:opacity-50"
                >
                  Bỏ
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {message ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{message}</p> : null}
    </div>
  );
}
