"use client";

import { useState } from "react";
import { AnnotatedAnswer, type Annotation } from "@/components/annotated-answer";
import { fillSourceBlanks, splitByAnswerMatches } from "@/lib/answer-evidence";
import { isAudioUrl } from "@/lib/question-interactions";

export type PartAnswer = {
  id: string;
  order: number | null;
  prompt: string | null;
  points: number | null;
  value: string;
  isCorrect: boolean | null;
  pointsAwarded: number | null;
  correctAnswerSnapshot: string | null;
  explanationSnapshot: string | null;
  annotations: Annotation[];
};

export type ResultPart = {
  unitId: string;
  title: string;
  skill: string;
  sourceText: string | null;
  answers: PartAnswer[];
  answerStrings: string[];
  answersByOrder: Record<number, string>;
  minOrder: number | null;
  maxOrder: number | null;
};

function correctnessLabel(value: boolean | null) {
  if (value === true) return "Đúng";
  if (value === false) return "Sai";
  return "Chờ chấm";
}

function correctnessClass(value: boolean | null) {
  if (value === true)
    return "border-emerald-400/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300";
  if (value === false)
    return "border-red-400/50 bg-red-500/10 text-red-600 dark:text-red-300";
  return "border-accent/50 bg-accent/10 text-accent-foreground dark:text-accent";
}

// Văn bản nguồn với các đáp án đúng được tô sáng.
function HighlightedSource({ text, answers }: { text: string; answers: string[] }) {
  const parts = splitByAnswerMatches(text, answers);
  return (
    <>
      {parts.map((part, index) =>
        part.match ? (
          <mark
            key={index}
            className="rounded bg-emerald-500/25 px-0.5 font-semibold text-emerald-800 dark:bg-emerald-400/25 dark:text-emerald-200"
          >
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </>
  );
}

function AnswerCard({ answer }: { answer: PartAnswer }) {
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-semibold">
          {answer.order !== null ? `Câu ${answer.order}` : "Câu chưa liên kết"}
        </h4>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${correctnessClass(
            answer.isCorrect
          )}`}
        >
          {correctnessLabel(answer.isCorrect)}
        </span>
      </div>
      {answer.prompt ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{answer.prompt}</p>
      ) : null}
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-muted/60 p-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Bạn trả lời
          </dt>
          <dd className="mt-2">
            {answer.value ? (
              isAudioUrl(answer.value) ? (
                <audio controls src={answer.value} className="w-full" preload="metadata">
                  <track kind="captions" />
                </audio>
              ) : (
                <AnnotatedAnswer text={answer.value} annotations={answer.annotations} />
              )
            ) : (
              <span className="whitespace-pre-wrap">Bỏ trống</span>
            )}
          </dd>
        </div>
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/5 p-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Đáp án đúng
          </dt>
          <dd className="mt-2 whitespace-pre-wrap">{answer.correctAnswerSnapshot || "Không có"}</dd>
        </div>
      </dl>
      {answer.explanationSnapshot ? (
        <div className="mt-3 rounded-lg border border-border bg-muted/60 p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Giải thích
          </p>
          <p className="mt-2 leading-6">{answer.explanationSnapshot}</p>
        </div>
      ) : null}
      <p className="mt-3 text-sm text-muted-foreground">
        {answer.isCorrect === null ? (
          "Chờ giáo viên chấm"
        ) : (
          <>
            Điểm: {answer.pointsAwarded ?? 0}
            {answer.points !== null ? ` / ${answer.points}` : ""}
          </>
        )}
      </p>
    </article>
  );
}

export function ResultAnswers({
  parts,
  // Khoảng cách sticky của cột transcript so với đỉnh khung cuộn. Trang kết quả
  // học viên chạy toàn màn hình + có thanh trên cùng dính nên cần đẩy xuống để
  // không bị thanh đó che; trang giáo viên giữ mặc định.
  stickyTopClass = "lg:top-4"
}: {
  parts: ResultPart[];
  stickyTopClass?: string;
}) {
  const [active, setActive] = useState(0);

  if (parts.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground shadow-card">
        Chưa có đáp án nào cho lần làm bài này.
      </section>
    );
  }

  const part = parts[Math.min(active, parts.length - 1)];
  const showSource = !!part.sourceText && (part.skill === "listening" || part.skill === "reading");
  const sourceLabel = part.skill === "listening" ? "Transcript" : "Bài đọc";
  const filledSource = showSource
    ? fillSourceBlanks(part.sourceText as string, part.answersByOrder)
    : "";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {parts.map((p, index) => (
          <button
            key={p.unitId}
            type="button"
            onClick={() => setActive(index)}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              index === active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary"
            }`}
          >
            Phần {index + 1}
            {p.minOrder !== null && p.maxOrder !== null ? (
              <span className="ml-1 font-normal opacity-80">
                · Câu {p.minOrder}–{p.maxOrder}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <p className="text-sm font-semibold text-primary">{part.title}</p>

      <div className={showSource ? "grid gap-4 lg:grid-cols-2" : ""}>
        {showSource ? (
          <>
            {/* Mobile: gấp-mở, để câu hỏi ở ngay dưới */}
            <details className="rounded-xl border border-border bg-card shadow-card lg:hidden">
              <summary className="cursor-pointer px-5 py-3 text-sm font-semibold">
                {sourceLabel}
              </summary>
              <p className="whitespace-pre-wrap px-5 pb-4 text-sm leading-7">
                <HighlightedSource text={filledSource} answers={part.answerStrings} />
              </p>
            </details>
            {/* Desktop: cột trái dính, cuộn riêng */}
            <div
              className={`hidden overflow-hidden rounded-xl border border-border bg-card shadow-card lg:block lg:sticky lg:max-h-[75vh] lg:self-start lg:overflow-auto ${stickyTopClass}`}
            >
              <div className="border-b border-border px-5 py-3 text-sm font-semibold">
                {sourceLabel}
              </div>
              <p className="whitespace-pre-wrap px-5 py-4 text-sm leading-7">
                <HighlightedSource text={filledSource} answers={part.answerStrings} />
              </p>
            </div>
          </>
        ) : null}

        <div className="space-y-4">
          {part.answers.map((answer) => (
            <AnswerCard key={answer.id} answer={answer} />
          ))}
        </div>
      </div>
    </section>
  );
}
