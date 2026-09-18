"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { SpeakButton } from "@/components/speak-button";
import { submitVocabQuiz } from "@/lib/actions/vocab";
import {
  checkVocabAnswer,
  CLOZE_BLANK,
  type MaskedSentence,
  type QuizQuestion
} from "@/lib/vocab-quiz";

const KIND_LABELS = {
  meaning: "Chọn nghĩa",
  reverse: "Chọn từ",
  cloze: "Điền từ"
} as const;

function questionTitle(question: QuizQuestion) {
  switch (question.kind) {
    case "meaning":
      return (
        <>
          <span className="font-bold">{question.prompt}</span> nghĩa là gì?
        </>
      );
    case "reverse":
      return (
        <>
          Từ nào nghĩa là <span className="font-bold">“{question.prompt}”</span>?
        </>
      );
    case "cloze":
      return <>Điền từ còn thiếu vào câu:</>;
  }
}

// Câu ví dụ với từ cần học in đậm — hiện khi chữa bài.
function ExampleSentence({ example, fallback }: { example: MaskedSentence | null; fallback: string }) {
  if (!example) {
    return <>“{fallback}”</>;
  }

  return (
    <>
      “{example.before}
      <strong className="font-semibold not-italic text-foreground">{example.match}</strong>
      {example.after}”
    </>
  );
}

// Câu đục lỗ — ô trống kẻ chân cho dễ nhìn trên điện thoại.
function ClozePrompt({ prompt }: { prompt: string }) {
  const [before, after] = prompt.split(CLOZE_BLANK);

  return (
    <p className="mt-2 text-sm leading-6">
      {before}
      <span className="mx-1 inline-block min-w-[5rem] border-b-2 border-primary align-baseline" aria-label="chỗ trống" />
      {after}
    </p>
  );
}

export function VocabQuizForm({ questions }: { questions: QuizQuestion[] }) {
  // Khoá cứng bộ câu hỏi ngay lần render đầu. Sau khi nộp, action gọi
  // revalidatePath nên máy chủ dựng lại trang với bộ từ MỚI; nếu không khoá thì
  // phần chữa bài sẽ nhảy sang những câu học viên chưa hề làm.
  const [items] = useState(questions);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [graded, setGraded] = useState(false);

  const answered = items.every((question) => (chosen[question.wordId] ?? "").trim().length > 0);

  const answersJson = JSON.stringify({
    answers: items.map((question) => ({
      wordId: question.wordId,
      kind: question.kind,
      chosen: (chosen[question.wordId] ?? "").trim()
    }))
  });

  const pick = (wordId: string, value: string) =>
    setChosen((prev) => ({ ...prev, [wordId]: value }));

  return (
    <ActionForm
      action={submitVocabQuiz}
      className="space-y-5"
      onResult={(result) => {
        if (result.ok) {
          setGraded(true);
        }
      }}
    >
      <input type="hidden" name="answersJson" value={answersJson} />

      {items.map((question, index) => {
        const picked = chosen[question.wordId] ?? "";
        const isRight = graded && checkVocabAnswer(question.kind, question, picked);
        const answer = question.kind === "cloze" ? question.example?.match ?? question.display : question.options[question.correctIndex];

        return (
          <fieldset
            key={question.wordId}
            className={`rounded-xl border bg-card p-4 shadow-card ${
              graded ? (isRight ? "border-primary/50" : "border-destructive/50") : "border-border"
            }`}
          >
            <legend className="flex flex-wrap items-center gap-2 px-1 text-sm font-semibold">
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {KIND_LABELS[question.kind]}
              </span>
              <span>
                Câu {index + 1}: {questionTitle(question)}
              </span>
            </legend>

            {question.kind === "cloze" ? (
              <>
                <ClozePrompt prompt={question.prompt} />
                <p className="mt-1 text-xs text-muted-foreground">Gợi ý: {question.meaningVi}</p>
                <input
                  type="text"
                  value={picked}
                  disabled={graded}
                  onChange={(event) => pick(question.wordId, event.target.value)}
                  placeholder="Gõ từ tiếng Anh…"
                  autoCapitalize="off"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  inputMode="text"
                  enterKeyHint="next"
                  className={`mt-2 w-full max-w-xs rounded-lg border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary ${
                    graded
                      ? isRight
                        ? "border-primary bg-primary/10 font-semibold text-primary"
                        : "border-destructive bg-destructive/10 text-destructive"
                      : "border-border"
                  }`}
                />
              </>
            ) : (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {question.options.map((option) => {
                  const isPicked = picked === option;
                  const showRight = graded && option === answer;
                  const showWrong = graded && isPicked && option !== answer;

                  return (
                    <label
                      key={option}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                        showRight
                          ? "border-primary bg-primary/10 font-semibold text-primary"
                          : showWrong
                            ? "border-destructive bg-destructive/10 text-destructive"
                            : isPicked
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${question.wordId}`}
                        value={option}
                        checked={isPicked}
                        disabled={graded}
                        onChange={() => pick(question.wordId, option)}
                      />
                      {option}
                    </label>
                  );
                })}
              </div>
            )}

            {graded ? (
              <div className="mt-3 rounded-lg border border-border bg-background/60 p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <span className={isRight ? "text-primary" : "text-destructive"}>
                    {isRight ? "✓ Đúng" : "✗ Sai"}
                  </span>
                  {!isRight ? (
                    <span className="text-muted-foreground">
                      · Bạn {question.kind === "cloze" ? "gõ" : "chọn"}: “{picked}”
                    </span>
                  ) : null}
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold">{question.display}</span>
                  {question.phonetic ? (
                    <span className="text-muted-foreground">{question.phonetic}</span>
                  ) : null}
                  <SpeakButton text={question.display} />
                  <span className="font-medium">— {question.meaningVi}</span>
                </p>
                <p className="mt-1.5 border-l-2 border-border pl-3 italic leading-6 text-muted-foreground">
                  <ExampleSentence example={question.example} fallback={question.exampleEn} />
                </p>
              </div>
            ) : null}
          </fieldset>
        );
      })}

      {graded ? (
        <a
          href="/student/vocab"
          className="inline-block rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold transition hover:border-primary hover:text-primary"
        >
          Làm lại với 5 từ khác
        </a>
      ) : (
        <button
          type="submit"
          disabled={!answered}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Nộp bài
        </button>
      )}
    </ActionForm>
  );
}
