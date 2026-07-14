"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnnotatedAnswer, type Annotation } from "@/components/annotated-answer";
import {
  buildEvidenceSegments,
  buildEvidenceTargets,
  fillSourceBlanks,
  type EvidenceSegment
} from "@/lib/answer-evidence";
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
  questionEvidence: string | null;
  evidenceSnapshot: string | null;
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

// Render transcript theo các đoạn đã gắn số câu. Chỉ tô khi có activeOrder: câu văn
// chứa đáp án (nền xanh) + đúng từ đáp án (đậm/gạch chân) + badge [n] ở đầu câu.
function EvidenceTranscript({
  segments,
  activeOrder
}: {
  segments: EvidenceSegment[];
  activeOrder: number | null;
}) {
  let badgeShown = false;
  return (
    <>
      {segments.map((seg, index) => {
        const inSentence = activeOrder !== null && seg.sentenceOrders.includes(activeOrder);
        const isAnswer = activeOrder !== null && seg.answerOrders.includes(activeOrder);
        const showBadge = inSentence && !badgeShown;
        if (showBadge) badgeShown = true;
        const markClass = [
          inSentence ? "rounded bg-emerald-500/15 dark:bg-emerald-400/15" : "",
          isAnswer
            ? "font-semibold text-emerald-800 underline decoration-emerald-500 dark:text-emerald-200"
            : ""
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <span key={index}>
            {showBadge ? (
              <span
                data-evidence-order={activeOrder as number}
                className="mx-0.5 inline-flex items-center rounded-full bg-emerald-600 px-1.5 py-0.5 align-middle text-[11px] font-bold leading-none text-white"
              >
                [{activeOrder}]
              </span>
            ) : null}
            <span className={markClass || undefined}>{seg.text}</span>
          </span>
        );
      })}
    </>
  );
}

function AnswerCard({
  answer,
  isLinked,
  isActive,
  onSelect
}: {
  answer: PartAnswer;
  isLinked: boolean;
  isActive: boolean;
  onSelect: (order: number) => void;
}) {
  const interactive = isLinked && answer.order !== null;
  const activate = () => {
    if (answer.order !== null) onSelect(answer.order);
  };
  return (
    <article
      className={`rounded-xl border bg-card p-4 shadow-card transition ${
        isActive ? "border-primary ring-2 ring-primary" : "border-border"
      } ${interactive ? "cursor-pointer hover:border-primary" : ""}`}
      {...(interactive
        ? {
            role: "button",
            tabIndex: 0,
            "aria-pressed": isActive,
            onClick: activate,
            onKeyDown: (event: React.KeyboardEvent) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                activate();
              }
            }
          }
        : {})}
    >
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
  const [activeOrder, setActiveOrder] = useState<number | null>(null);
  const desktopScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileDetailsRef = useRef<HTMLDetailsElement | null>(null);

  // Lưu ý: các hook dưới đây phải gọi vô điều kiện (không đặt sau early return)
  // để không vi phạm rules-of-hooks — dùng `part` có thể null thay vì return sớm.
  const part = parts.length > 0 ? parts[Math.min(active, parts.length - 1)] : null;
  const showSource = !!part?.sourceText && (part.skill === "listening" || part.skill === "reading");
  const sourceLabel = part?.skill === "listening" ? "Transcript" : "Bài đọc";
  const filledSource =
    showSource && part ? fillSourceBlanks(part.sourceText as string, part.answersByOrder) : "";

  // Cắt transcript theo câu dẫn chứng của part đang xem: câu điền từ dùng evidenceSnapshot
  // sẵn có, câu trắc nghiệm dò theo từ khóa đáp án.
  const { segments, linkedOrders } = useMemo(() => {
    if (!showSource || !part) return { segments: [] as EvidenceSegment[], linkedOrders: [] as number[] };
    const targets = buildEvidenceTargets(part.answers, filledSource, part.answersByOrder);
    return buildEvidenceSegments(filledSource, targets, part.answersByOrder);
  }, [showSource, filledSource, part]);
  const linkedSet = useMemo(() => new Set(linkedOrders), [linkedOrders]);

  // Cuộn cột trái tới câu dẫn chứng đang chọn (cuộn trong khung, không cuộn cả trang).
  useEffect(() => {
    if (activeOrder === null) return;
    const box = desktopScrollRef.current;
    if (box) {
      const anchor = box.querySelector<HTMLElement>(`[data-evidence-order="${activeOrder}"]`);
      if (anchor) {
        const delta = anchor.getBoundingClientRect().top - box.getBoundingClientRect().top;
        box.scrollTo({ top: box.scrollTop + delta - box.clientHeight / 2, behavior: "smooth" });
      }
    }
    const details = mobileDetailsRef.current;
    if (details) {
      details.open = true;
      const anchor = details.querySelector<HTMLElement>(`[data-evidence-order="${activeOrder}"]`);
      anchor?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeOrder]);

  if (!part) {
    return (
      <section className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground shadow-card">
        Chưa có đáp án nào cho lần làm bài này.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {parts.map((p, index) => (
          <button
            key={p.unitId}
            type="button"
            onClick={() => {
              setActive(index);
              setActiveOrder(null);
            }}
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
            <details ref={mobileDetailsRef} className="rounded-xl border border-border bg-card shadow-card lg:hidden">
              <summary className="cursor-pointer px-5 py-3 text-sm font-semibold">
                {sourceLabel}
              </summary>
              <p className="whitespace-pre-wrap px-5 pb-4 text-base leading-8">
                <EvidenceTranscript segments={segments} activeOrder={activeOrder} />
              </p>
            </details>
            {/* Desktop: cột trái dính, cuộn riêng */}
            <div
              ref={desktopScrollRef}
              className={`hidden overflow-hidden rounded-xl border border-border bg-card shadow-card lg:block lg:sticky lg:max-h-[75vh] lg:self-start lg:overflow-auto ${stickyTopClass}`}
            >
              <div className="border-b border-border px-5 py-3 text-sm font-semibold">
                {sourceLabel}
              </div>
              <p className="whitespace-pre-wrap px-5 py-4 text-base leading-8">
                <EvidenceTranscript segments={segments} activeOrder={activeOrder} />
              </p>
            </div>
          </>
        ) : null}

        <div className="space-y-4">
          {part.answers.map((answer) => (
            <AnswerCard
              key={answer.id}
              answer={answer}
              isLinked={answer.order !== null && linkedSet.has(answer.order)}
              isActive={answer.order !== null && answer.order === activeOrder}
              onSelect={(order) => setActiveOrder((current) => (current === order ? null : order))}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
