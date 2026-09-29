"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { SpeakButton } from "@/components/speak-button";
import { useToast } from "@/components/toast";
import { answerVocabCard } from "@/lib/actions/vocab-deck";
import { checkVocabAnswer, CLOZE_BLANK, type MaskedSentence } from "@/lib/vocab-quiz";
import type { SessionItem } from "@/lib/vocab-srs";

const KIND_LABELS = {
  meaning: "Chọn nghĩa",
  reverse: "Chọn từ",
  cloze: "Điền từ"
} as const;

type QueueEntry = {
  item: SessionItem;
  // Câu hỏi lại cuối buổi sau khi trả lời sai: chỉ để luyện, không gửi server.
  practice: boolean;
};

type Phase = "intro" | "ask" | "checked";

// Câu ví dụ với từ cần học in đậm.
function ExampleSentence({ example, fallback }: { example: MaskedSentence | null; fallback: string }) {
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
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const nextRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const entry = queue[position];

  useEffect(() => {
    if (phase === "checked") {
      nextRef.current?.focus();
    } else if (phase === "ask" && entry?.item.question.kind === "cloze") {
      inputRef.current?.focus();
    }
  }, [phase, entry]);

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
  const { question } = item;
  const answer =
    question.kind === "cloze"
      ? question.example?.match ?? question.display
      : question.options[question.correctIndex];
  const chosen = question.kind === "cloze" ? typed.trim() : picked;
  const isRight = phase === "checked" && checkVocabAnswer(question.kind, question, chosen);

  function check(value: string) {
    if (!value.trim() || phase !== "ask") {
      return;
    }

    const correct = checkVocabAnswer(question.kind, question, value);

    setPhase("checked");

    if (entry.practice) {
      return;
    }

    setScore((current) => ({
      correct: current.correct + (correct ? 1 : 0),
      total: current.total + 1
    }));

    if (!correct) {
      setQueue((current) => [...current, { item, practice: true }]);
    }

    startTransition(async () => {
      let saved = false;

      try {
        const result = await answerVocabCard({
          cardId: item.cardId,
          wordId: item.cardId ? null : item.wordId,
          kind: question.kind,
          chosen: value.trim()
        });
        saved = result.ok;
      } catch {
        saved = false;
      }

      if (!saved) {
        notify({ ok: false, message: "Chưa lưu được câu vừa rồi — kiểm tra mạng nhé." });
      }
    });
  }

  function next() {
    const nextPosition = position + 1;

    setPosition(nextPosition);
    setPhase(initialPhase(queue[nextPosition]));
    setTyped("");
    setPicked("");
  }

  const total = queue.length;

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          Thẻ {Math.min(position + 1, total)}/{total}
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
          <ExampleSentence example={question.example} fallback={question.exampleEn} />
          <button
            type="button"
            onClick={() => setPhase("ask")}
            className="mt-5 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90 sm:w-auto"
          >
            Đã hiểu, hỏi mình đi →
          </button>
        </div>
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

          {question.kind === "cloze" ? (
            <form
              className="mt-3 flex flex-wrap gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                check(typed);
              }}
            >
              <input
                ref={inputRef}
                type="text"
                value={typed}
                disabled={phase === "checked"}
                onChange={(event) => setTyped(event.target.value)}
                placeholder="Gõ từ tiếng Anh…"
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
                  ? "✓ Đúng rồi!"
                  : `✗ Chưa đúng${entry.practice ? "" : " — thẻ này sẽ được hỏi lại cuối buổi"}`}
              </p>
              <div className="mt-2">
                <WordHeader item={item} />
              </div>
              <ExampleSentence example={question.example} fallback={question.exampleEn} />
              <button
                ref={nextRef}
                type="button"
                onClick={next}
                className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90 sm:w-auto"
              >
                {position + 1 < queue.length ? "Tiếp →" : "Xong"}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
