"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnnotatedAnswer, type Annotation } from "@/components/annotated-answer";
import { AudioPlayer, type AudioPlayerControls } from "@/components/audio-player";
import {
  buildEvidenceSegments,
  buildEvidenceTargets,
  fillSourceBlanks,
  type EvidenceSegment
} from "@/lib/answer-evidence";
import { isAudioUrl } from "@/lib/question-interactions";
import { SKILL_LABELS } from "@/lib/skills";
import {
  buildSentenceTimes,
  evidenceOrderTimes,
  groupSegmentsBySentence,
  parseTranscriptTiming,
  seekTime
} from "@/lib/transcript-timing";

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
  // File nghe của phần (Listening). Bài Đọc/Viết/Nói = null.
  audioUrl: string | null;
  // Mốc thời gian từng từ của transcript trong audio (bấm câu -> tua audio).
  // Chưa đồng bộ = null -> transcript hiển thị như cũ, không bấm được.
  transcriptTimingJson: string | null;
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

// Render transcript theo các nhóm câu (mỗi nhóm gồm các đoạn đã gắn số câu). Tô khi
// có activeOrder: câu văn chứa đáp án (nền xanh) + đúng từ đáp án (đậm/gạch chân) +
// badge [n] ở đầu câu. Nhóm có mốc thời gian + onSeek -> bấm để tua audio tới câu đó.
function EvidenceTranscript({
  groups,
  activeOrder,
  onSeek
}: {
  groups: Array<{ t: number | null; segments: EvidenceSegment[] }>;
  activeOrder: number | null;
  onSeek?: (seconds: number) => void;
}) {
  let badgeShown = false;
  return (
    <>
      {groups.map((group, groupIndex) => {
        const clickable = onSeek !== undefined && group.t !== null;
        const rendered = group.segments.map((seg, index) => {
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
        });
        return clickable ? (
          <span
            key={groupIndex}
            role="button"
            tabIndex={0}
            title="Bấm để nghe từ câu này"
            onClick={() => onSeek(group.t as number)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSeek(group.t as number);
              }
            }}
            className="cursor-pointer rounded transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            {rendered}
          </span>
        ) : (
          <span key={groupIndex}>{rendered}</span>
        );
      })}
    </>
  );
}

function AnswerCard({
  answer,
  isLinked,
  isActive,
  onSelect,
  onPlayEvidence
}: {
  answer: PartAnswer;
  isLinked: boolean;
  isActive: boolean;
  onSelect: (order: number) => void;
  // Bấm ▶ -> tua audio tới câu dẫn chứng của câu này (chỉ Listening đã đồng bộ).
  onPlayEvidence: (() => void) | null;
}) {
  const interactive = isLinked && answer.order !== null;
  const hasCorrectAnswer = (answer.correctAnswerSnapshot ?? "").trim().length > 0;
  const activate = () => {
    if (answer.order !== null) onSelect(answer.order);
  };
  return (
    <article
      className={`rounded-xl border bg-card p-5 shadow-card transition ${
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
        <span className="flex items-center gap-2">
          <h4 className="text-lg font-semibold">
            {answer.order !== null ? `Câu ${answer.order}` : "Câu chưa liên kết"}
          </h4>
          {onPlayEvidence ? (
            <button
              type="button"
              title="Nghe đoạn audio chứa đáp án"
              aria-label="Nghe đoạn audio chứa đáp án"
              onClick={(event) => {
                // Không cho lan lên thẻ: thẻ đang chọn mà bấm ▶ lần nữa sẽ bỏ chọn mất.
                event.stopPropagation();
                onPlayEvidence();
              }}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/40 text-primary transition hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 translate-x-[1px]" aria-hidden="true">
                <path d="M8 5.14v13.72a1 1 0 0 0 1.53.85l10.79-6.86a1 1 0 0 0 0-1.7L9.53 4.29A1 1 0 0 0 8 5.14Z" />
              </svg>
            </button>
          ) : null}
        </span>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-sm font-medium ${correctnessClass(
            answer.isCorrect
          )}`}
        >
          {correctnessLabel(answer.isCorrect)}
        </span>
      </div>
      {answer.prompt ? (
        <p className="mt-2 text-base leading-7 text-muted-foreground">{answer.prompt}</p>
      ) : null}
      <dl className={`mt-3 grid gap-3 text-base ${hasCorrectAnswer ? "sm:grid-cols-2" : ""}`}>
        <div className="rounded-lg border border-border bg-muted/60 p-4">
          <dt className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Bạn trả lời
          </dt>
          <dd className="mt-2 leading-7">
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
        {/* Câu chấm tay (bài luận Viết, phần ghi âm Nói) không có đáp án mẫu —
            ẩn hẳn ô này thay vì hiện "Không có", ô trả lời chiếm trọn hàng. */}
        {hasCorrectAnswer ? (
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/5 p-4">
            <dt className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Đáp án đúng
            </dt>
            <dd className="mt-2 whitespace-pre-wrap leading-7">{answer.correctAnswerSnapshot}</dd>
          </div>
        ) : null}
      </dl>
      {answer.explanationSnapshot ? (
        <div className="mt-4 rounded-lg border border-border bg-muted/60 p-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Giải thích
          </p>
          <p className="mt-2 whitespace-pre-wrap text-[17px] leading-8">{answer.explanationSnapshot}</p>
        </div>
      ) : null}
      <p className="mt-3 text-base text-muted-foreground">
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
  const answersScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileDetailsRef = useRef<HTMLDetailsElement | null>(null);
  // Điều khiển thanh nghe lại từ transcript/thẻ câu hỏi (bấm -> tua audio).
  const playerControlRef = useRef<AudioPlayerControls | null>(null);

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

  // Mốc thời gian transcript<->audio (chỉ Listening đã đồng bộ). Gom các đoạn dẫn
  // chứng lại theo câu; mỗi câu biết giây bắt đầu -> bấm là tua audio tới đó.
  const timing = useMemo(
    () => (part?.skill === "listening" ? parseTranscriptTiming(part.transcriptTimingJson) : null),
    [part]
  );
  const sentenceGroups = useMemo(() => {
    if (!timing || !filledSource) return null;
    const sentences = buildSentenceTimes(filledSource, timing.words);
    return groupSegmentsBySentence(segments, sentences);
  }, [timing, filledSource, segments]);
  const orderTimes = useMemo(
    () => (sentenceGroups ? evidenceOrderTimes(sentenceGroups) : {}),
    [sentenceGroups]
  );

  // Nhãn tab: mỗi kỹ năng đánh số phần lại từ 1 (giống đề thi). Bài có từ 2 kỹ năng
  // trở lên thì thêm tên kỹ năng để không nhầm "Phần 1" của Nghe với của Đọc.
  const tabLabels = useMemo(() => {
    const multiSkill = new Set(parts.map((p) => p.skill)).size > 1;
    const countBySkill = new Map<string, number>();
    return parts.map((p) => {
      const index = (countBySkill.get(p.skill) ?? 0) + 1;
      countBySkill.set(p.skill, index);
      const prefix = multiSkill ? `${SKILL_LABELS[p.skill] ?? p.skill} · ` : "";
      return `${prefix}Phần ${index}`;
    });
  }, [parts]);

  // Thanh nghe lại: chỉ có với phần Listening đã kèm file nghe. Nhãn ghép từ tên
  // tab + khoảng số câu để biết đang nghe phần nào.
  const activeIndex = parts.length > 0 ? Math.min(active, parts.length - 1) : 0;
  const replayAudioUrl = part?.skill === "listening" ? part.audioUrl : null;
  const replayLabel = part
    ? `${tabLabels[activeIndex]}${
        part.minOrder !== null && part.maxOrder !== null
          ? ` · Câu ${part.minOrder}–${part.maxOrder}`
          : ""
      }`
    : "";

  // Bấm câu trong transcript / nút ▶ trên thẻ câu -> tua sớm 1 giây rồi phát luôn.
  // Chỉ bật khi part có thanh nghe lại VÀ đã đồng bộ mốc thời gian.
  const canSeek = !!replayAudioUrl && sentenceGroups !== null;
  const seekAndPlay = (t: number) => {
    playerControlRef.current?.seekTo(seekTime(t), { play: true });
  };
  // Không có timing -> một nhóm duy nhất không bấm được (transcript như cũ).
  const transcriptGroups = sentenceGroups ?? [{ t: null, segments }];

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

  // Đổi part thì kéo khung câu hỏi bên phải về đầu (khung cuộn riêng, không cuộn trang).
  useEffect(() => {
    answersScrollRef.current?.scrollTo({ top: 0 });
  }, [active]);

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
            {tabLabels[index]}
            {p.minOrder !== null && p.maxOrder !== null ? (
              <span className="ml-1 font-normal opacity-80">
                · Câu {p.minOrder}–{p.maxOrder}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <p className="text-sm font-semibold text-primary">{part.title}</p>

      <div className={showSource ? "grid gap-4 lg:grid-cols-[3fr_2fr]" : ""}>
        {showSource ? (
          <>
            {/* Mobile: gấp-mở, để câu hỏi ở ngay dưới */}
            <details ref={mobileDetailsRef} className="rounded-xl border border-border bg-card shadow-card lg:hidden">
              <summary className="cursor-pointer px-5 py-3 text-sm font-semibold">
                {sourceLabel}
              </summary>
              <p className="whitespace-pre-wrap px-5 pb-4 text-lg leading-8">
                <EvidenceTranscript
                  groups={transcriptGroups}
                  activeOrder={activeOrder}
                  onSeek={canSeek ? seekAndPlay : undefined}
                />
              </p>
            </details>
            {/* Desktop: cột trái dính, cuộn riêng */}
            <div
              ref={desktopScrollRef}
              className={`hidden overflow-hidden rounded-xl border border-border bg-card shadow-card lg:block lg:sticky lg:max-h-[82vh] lg:self-start lg:overflow-auto ${stickyTopClass}`}
            >
              <div className="border-b border-border px-5 py-3 text-sm font-semibold">
                {sourceLabel}
              </div>
              <p className="whitespace-pre-wrap px-5 py-4 text-lg leading-8">
                <EvidenceTranscript
                  groups={transcriptGroups}
                  activeOrder={activeOrder}
                  onSeek={canSeek ? seekAndPlay : undefined}
                />
              </p>
            </div>
          </>
        ) : null}

        {/* Desktop: cột câu hỏi cũng cuộn riêng như transcript, giữ header luôn hiển thị */}
        <div
          ref={answersScrollRef}
          className={`space-y-4 ${
            showSource
              ? `lg:sticky lg:max-h-[82vh] lg:self-start lg:overflow-auto lg:overscroll-contain lg:p-1 ${stickyTopClass}`
              : ""
          }`}
        >
          {part.answers.map((answer) => {
            // Giây bắt đầu của câu dẫn chứng (chỉ Listening đã đồng bộ mốc audio).
            const order = answer.order;
            const evidenceTime =
              canSeek && order !== null ? orderTimes[order] : undefined;
            return (
              <AnswerCard
                key={answer.id}
                answer={answer}
                isLinked={order !== null && linkedSet.has(order)}
                isActive={order !== null && order === activeOrder}
                onSelect={(o) => setActiveOrder((current) => (current === o ? null : o))}
                onPlayEvidence={
                  evidenceTime !== undefined
                    ? () => {
                        // Vừa tô câu dẫn chứng trong transcript vừa phát audio đoạn đó.
                        setActiveOrder(order);
                        seekAndPlay(evidenceTime);
                      }
                    : null
                }
              />
            );
          })}
        </div>
      </div>

      {/* Nghe lại bài nghe — thanh dính đáy màn hình, luôn thấy dù đang cuộn
          transcript hay cột câu hỏi. `key` theo phần để khi đổi tab thì audio cũ
          dừng hẳn và thanh về 0:00 của file mới (không phát chồng hai phần). */}
      {replayAudioUrl ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-3 py-2 backdrop-blur sm:px-6 lg:px-8">
          <AudioPlayer
            key={part.unitId}
            src={replayAudioUrl}
            showSpeed
            label={replayLabel}
            controlRef={playerControlRef}
          />
        </div>
      ) : null}
    </section>
  );
}
