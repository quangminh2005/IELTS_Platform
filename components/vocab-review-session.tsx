"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { SpeakButton } from "@/components/speak-button";
import { useToast } from "@/components/toast";
import { VocabMatchBoard, type MatchResult } from "@/components/vocab-match-board";
import { answerVocabCard } from "@/lib/actions/vocab-deck";
import {
  checkVocabAnswer,
  CLOZE_BLANK,
  isTypedKind,
  spellingHint,
  type MaskedSentence,
  type QuizKind,
  type QuizQuestion
} from "@/lib/vocab-quiz";
import type { SessionItem } from "@/lib/vocab-srs";

const KIND_LABELS: Record<QuizKind, string> = {
  meaning: "Chọn nghĩa",
  reverse: "Chọn từ",
  cloze: "Điền từ",
  match: "Nối nghĩa",
  spell: "Gõ từ",
  translate: "Gõ nghĩa"
};

const TYPED_PLACEHOLDER: Partial<Record<QuizKind, string>> = {
  cloze: "Gõ từ tiếng Anh…",
  spell: "Gõ từ tiếng Anh…",
  translate: "Gõ nghĩa tiếng Việt…"
};

type QueueEntry = {
  item: SessionItem;
  // Câu hỏi lại cuối buổi sau khi trả lời sai: chỉ để luyện, không gửi server.
  practice: boolean;
};

type Phase = "intro" | "ask" | "checked";

// Câu ví dụ với từ cần học in đậm, bản dịch (nếu có) ở dòng dưới.
function ExampleSentence({
  example,
  fallback,
  translation
}: {
  example: MaskedSentence | null;
  fallback: string;
  translation: string | null;
}) {
  if (!fallback) {
    return null;
  }

  return (
    <p className="mt-2 border-l-2 border-border pl-3 text-sm italic leading-6 text-muted-foreground">
      {example ? (
        <>
          “{example.before}
          <strong className="font-semibold not-italic text-foreground">{example.match}</strong>
          {example.after}”
        </>
      ) : (
        <>“{fallback}”</>
      )}
      {translation ? (
        <span className="mt-1 block text-[13px] not-italic leading-5 text-muted-foreground/90">
          {translation}
        </span>
      ) : null}
    </p>
  );
}

function WordHeader({ item }: { item: SessionItem }) {
  const { question } = item;

  return (
    <p className="flex flex-wrap items-center gap-2">
      <span className="text-xl font-bold tracking-tight">{question.display}</span>
      {question.phonetic ? (
        <span className="text-sm text-muted-foreground">{question.phonetic}</span>
      ) : null}
      <SpeakButton text={question.display} />
      <span className="font-medium">— {question.meaningVi}</span>
    </p>
  );
}

function initialPhase(entry: QueueEntry | undefined): Phase {
  return entry && entry.item.isNew && !entry.practice ? "intro" : "ask";
}

// Câu hỏi lại của thẻ nối sai không nối một mình được → hỏi bằng dạng chọn nghĩa
// (câu nối vẫn mang sẵn 4 lựa chọn nghĩa).
function askedQuestion(entry: QueueEntry): QuizQuestion {
  const { question } = entry.item;

  return entry.practice && question.kind === "match" ? { ...question, kind: "meaning" } : question;
}

// Các thẻ liền nhau cùng một màn nối, bắt đầu từ `position`.
function matchGroupAt(queue: QueueEntry[], position: number): QueueEntry[] {
  const first = queue[position];

  if (!first || first.practice || first.item.question.kind !== "match" || !first.item.matchGroup) {
    return [];
  }

  const group: QueueEntry[] = [];

  for (let index = position; index < queue.length; index += 1) {
    const entry = queue[index];

    if (entry.practice || entry.item.matchGroup !== first.item.matchGroup) {
      break;
    }

    group.push(entry);
  }

  return group;
}

export function VocabReviewSession({
  items,
  moreHref
}: {
  items: SessionItem[];
  // Link "Học thêm 5 từ" (null khi kho đã hết từ mới).
  moreHref: string | null;
}) {
  const { notify } = useToast();
  const [, startTransition] = useTransition();
  // Khoá bộ thẻ ở lần render đầu — trang có dựng lại thì buổi ôn không bị nhảy.
  const [queue, setQueue] = useState<QueueEntry[]>(() =>
    items.map((item) => ({ item, practice: false }))
  );
  const [position, setPosition] = useState(0);
  const [phase, setPhase] = useState<Phase>(() => initialPhase(queue[0]));
  const [typed, setTyped] = useState("");
  const [picked, setPicked] = useState("");
  // Dạng gõ nghĩa bị máy chấm sai: chờ học viên chọn "Em đúng mà" hoặc "Tiếp"
  // rồi mới lưu. selfMarked = đã bấm "Em đúng mà".
  const [awaitingVerdict, setAwaitingVerdict] = useState(false);
  const [selfMarked, setSelfMarked] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const nextRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const entry = queue[position];
  const askedKind = entry ? askedQuestion(entry).kind : null;

  useEffect(() => {
    if (phase === "checked" && !awaitingVerdict) {
      nextRef.current?.focus();
    } else if (phase === "ask" && askedKind && isTypedKind(askedKind)) {
      inputRef.current?.focus();
    }
  }, [phase, askedKind, position, awaitingVerdict]);

  if (!entry) {
    return (
      <section className="rounded-xl border border-primary/30 bg-primary/5 p-6 text-center shadow-card">
        <p className="text-3xl" aria-hidden="true">
          🎉
        </p>
        <h3 className="mt-2 text-lg font-bold">Xong buổi ôn!</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Trả lời đúng ngay lần đầu {score.correct}/{score.total} thẻ. Thẻ sai sẽ quay lại
          vào ngày mai.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <a
            href="/student/vocab"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
          >
            Ôn tiếp
          </a>
          {moreHref ? (
            <a
              href={moreHref}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold transition hover:border-primary hover:text-primary"
            >
              Học thêm 5 từ mới
            </a>
          ) : null}
          <a
            href="/student/vocab/words"
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold transition hover:border-primary hover:text-primary"
          >
            Xem Sổ từ
          </a>
        </div>
      </section>
    );
  }

  const { item } = entry;
  const question = askedQuestion(entry);
  const typedKind = isTypedKind(question.kind);
  const answer = question.options[question.correctIndex];
  const chosen = typedKind ? typed.trim() : picked;
  const isRight =
    phase === "checked" && (selfMarked || checkVocabAnswer(question.kind, question, chosen));
  const matchGroup = matchGroupAt(queue, position);

  // Ghi kết quả lần trả lời đầu: điểm buổi, hỏi lại cuối buổi nếu sai, lưu server.
  // Trả về thẻ hỏi lại (nếu có) để next() biết hàng đợi mới ngay trong lần bấm.
  function settle(input: {
    entry: QueueEntry;
    kind: QuizKind;
    value: string;
    correct: boolean;
    selfMarked?: boolean;
  }): QueueEntry | null {
    if (input.entry.practice) {
      return null;
    }

    const target = input.entry.item;
    const retry = input.correct ? null : { item: target, practice: true };

    setScore((current) => ({
      correct: current.correct + (input.correct ? 1 : 0),
      total: current.total + 1
    }));

    if (retry) {
      setQueue((current) => [...current, retry]);
    }

    startTransition(async () => {
      let saved = false;

      try {
        const result = await answerVocabCard({
          cardId: target.cardId,
          wordId: target.cardId ? null : target.wordId,
          kind: input.kind,
          chosen: input.value.trim(),
          selfMarked: input.selfMarked
        });
        saved = result.ok;
      } catch {
        saved = false;
      }

      if (!saved) {
        notify({ ok: false, message: "Chưa lưu được câu vừa rồi — kiểm tra mạng nhé." });
      }
    });

    return retry;
  }

  function check(value: string) {
    if (!value.trim() || phase !== "ask") {
      return;
    }

    const correct = checkVocabAnswer(question.kind, question, value);

    setPhase("checked");

    // Nghĩa Việt có nhiều cách nói: chấm sai thì để học viên tự quyết rồi mới lưu.
    if (question.kind === "translate" && !correct && !entry.practice) {
      setAwaitingVerdict(true);
      return;
    }

    settle({ entry, kind: question.kind, value, correct });
  }

  function markSelfCorrect() {
    setAwaitingVerdict(false);
    setSelfMarked(true);
    settle({ entry, kind: question.kind, value: typed, correct: true, selfMarked: true });
  }

  function goTo(nextPosition: number, nextQueue: QueueEntry[]) {
    setPosition(nextPosition);
    setPhase(initialPhase(nextQueue[nextPosition]));
    setTyped("");
    setPicked("");
    setAwaitingVerdict(false);
    setSelfMarked(false);
  }

  function next() {
    const retry = awaitingVerdict
      ? settle({ entry, kind: question.kind, value: typed, correct: false })
      : null;

    goTo(position + 1, retry ? [...queue, retry] : queue);
  }

  function resolveMatch(results: MatchResult[]) {
    for (const result of results) {
      const target = queue.find((candidate) => candidate.item === result.item && !candidate.practice);

      if (target) {
        settle({ entry: target, kind: "match", value: result.chosen, correct: result.correct });
      }
    }
  }

  const total = queue.length;
  const counter =
    matchGroup.length > 1
      ? `Thẻ ${position + 1}–${position + matchGroup.length}/${total}`
      : `Thẻ ${Math.min(position + 1, total)}/${total}`;

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {counter}
          {entry.practice ? " · hỏi lại" : ""}
        </span>
        <span className="rounded-full border border-border px-2 py-0.5 font-medium">
          {phase === "intro" ? "Từ mới" : KIND_LABELS[question.kind]}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.round((position / Math.max(total, 1)) * 100)}%` }}
        />
      </div>

      {phase === "intro" ? (
        <div className="mt-5">
          <WordHeader item={item} />
          <ExampleSentence
            example={question.example}
            fallback={question.exampleEn}
            translation={question.exampleVi}
          />
          <button
            type="button"
            onClick={() => setPhase("ask")}
            className="mt-5 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90 sm:w-auto"
          >
            Đã hiểu, hỏi mình đi →
          </button>
        </div>
      ) : matchGroup.length > 0 ? (
        <VocabMatchBoard
          key={item.key}
          items={matchGroup.map((member) => member.item)}
          onResolved={resolveMatch}
          onNext={() => goTo(position + matchGroup.length, queue)}
          isLast={position + matchGroup.length >= queue.length}
        />
      ) : (
        <div className="mt-5">
          {question.kind === "meaning" ? (
            <p className="text-base">
              <span className="text-xl font-bold">{question.prompt}</span> nghĩa là gì?
            </p>
          ) : question.kind === "reverse" ? (
            <p className="text-base">
              Từ nào nghĩa là <span className="font-bold">“{question.prompt}”</span>?
            </p>
          ) : question.kind === "spell" ? (
            <>
              <p className="text-base">
                Gõ từ tiếng Anh nghĩa là <span className="font-bold">“{question.prompt}”</span>
              </p>
              <p className="mt-2 font-mono text-sm tracking-wider text-muted-foreground">
                Gợi ý: {spellingHint(question.display)}
              </p>
            </>
          ) : question.kind === "translate" ? (
            <>
              <p className="flex flex-wrap items-center gap-2 text-base">
                <span className="text-xl font-bold">{question.prompt}</span>
                {question.phonetic ? (
                  <span className="text-sm text-muted-foreground">{question.phonetic}</span>
                ) : null}
                <SpeakButton text={question.display} />
                <span>nghĩa tiếng Việt là gì?</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Gõ một nghĩa là đủ, không dấu cũng được.
              </p>
            </>
          ) : (
            <>
              <p className="text-base">Điền từ còn thiếu vào câu:</p>
              <p className="mt-2 text-sm leading-6">
                {question.prompt.split(CLOZE_BLANK)[0]}
                <span
                  className="mx-1 inline-block min-w-[5rem] border-b-2 border-primary align-baseline"
                  aria-label="chỗ trống"
                />
                {question.prompt.split(CLOZE_BLANK)[1]}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Gợi ý: {question.meaningVi}</p>
            </>
          )}

          {typedKind ? (
            <form
              className="mt-3 flex flex-wrap gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                check(typed);
              }}
            >
              {/* Ô không nhận lại state (không value/defaultValue sống) — ghi đè
                  value giữa lúc gõ làm chữ bị ngược trên một số máy Android. */}
              <input
                key={`${position}:${entry.practice ? "p" : "a"}`}
                ref={inputRef}
                type="text"
                disabled={phase === "checked"}
                onChange={(event) => setTyped(event.target.value)}
                placeholder={TYPED_PLACEHOLDER[question.kind]}
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="done"
                className={`w-full max-w-xs rounded-lg border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary ${
                  phase === "checked"
                    ? isRight
                      ? "border-primary bg-primary/10 font-semibold text-primary"
                      : "border-destructive bg-destructive/10 text-destructive"
                    : "border-border"
                }`}
              />
              {phase === "ask" ? (
                <button
                  type="submit"
                  disabled={!typed.trim()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Kiểm tra
                </button>
              ) : null}
            </form>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {question.options.map((option) => {
                const showRight = phase === "checked" && option === answer;
                const showWrong = phase === "checked" && option === picked && option !== answer;

                return (
                  <button
                    key={option}
                    type="button"
                    disabled={phase === "checked"}
                    onClick={() => {
                      setPicked(option);
                      check(option);
                    }}
                    className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                      showRight
                        ? "border-primary bg-primary/10 font-semibold text-primary"
                        : showWrong
                          ? "border-destructive bg-destructive/10 text-destructive"
                          : "border-border hover:border-primary/50 disabled:opacity-60"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          )}

          {phase === "checked" ? (
            <div className="mt-4 rounded-lg border border-border bg-background/60 p-3 text-sm">
              <p className={isRight ? "font-semibold text-primary" : "font-semibold text-destructive"}>
                {isRight
                  ? selfMarked
                    ? "✓ Đã tính là đúng"
                    : "✓ Đúng rồi!"
                  : awaitingVerdict
                    ? "✗ Chưa khớp đáp án — em xem nghĩa bên dưới"
                    : `✗ Chưa đúng${entry.practice ? "" : " — thẻ này sẽ được hỏi lại cuối buổi"}`}
              </p>
              {awaitingVerdict ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Em gõ “{typed.trim()}”. Nếu ý em giống nghĩa bên dưới thì bấm “Em đúng mà”;
                  không thì bấm Tiếp, thẻ sẽ được hỏi lại cuối buổi.
                </p>
              ) : null}
              <div className="mt-2">
                <WordHeader item={item} />
              </div>
              <ExampleSentence
            example={question.example}
            fallback={question.exampleEn}
            translation={question.exampleVi}
          />
              <div className="mt-4 flex flex-wrap gap-2">
                {awaitingVerdict ? (
                  <button
                    type="button"
                    onClick={markSelfCorrect}
                    className="w-full rounded-lg border border-primary px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/10 sm:w-auto"
                  >
                    Em đúng mà
                  </button>
                ) : null}
                <button
                  ref={nextRef}
                  type="button"
                  onClick={next}
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90 sm:w-auto"
                >
                  {position + 1 < queue.length || awaitingVerdict ? "Tiếp →" : "Xong"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
