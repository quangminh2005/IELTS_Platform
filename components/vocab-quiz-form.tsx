"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { submitVocabQuiz } from "@/lib/actions/vocab";
import type { QuizQuestion } from "@/lib/vocab-quiz";

export function VocabQuizForm({ questions }: { questions: QuizQuestion[] }) {
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [graded, setGraded] = useState(false);

  const answered = questions.every((question) => chosen[question.wordId]);

  const answersJson = JSON.stringify({
    answers: questions.map((question) => ({
      wordId: question.wordId,
      chosen: chosen[question.wordId] ?? ""
    }))
  });

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

      {questions.map((question, index) => {
        const picked = chosen[question.wordId];
        const answer = question.options[question.correctIndex];

        return (
          <fieldset
            key={question.wordId}
            className="rounded-xl border border-border bg-card p-4 shadow-card"
          >
            <legend className="px-1 text-sm font-semibold">
              Câu {index + 1}: <span className="font-bold">{question.display}</span>{" "}
              nghĩa là gì?
            </legend>
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
                      checked={isPicked ?? false}
                      disabled={graded}
                      onChange={() =>
                        setChosen((prev) => ({ ...prev, [question.wordId]: option }))
                      }
                    />
                    {option}
                  </label>
                );
              })}
            </div>
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
