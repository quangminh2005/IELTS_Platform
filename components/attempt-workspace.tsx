"use client";

import { type DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { saveHighlight, submitAttempt } from "@/lib/actions/attempts";
import { HighlightLayer, type HighlightPayload } from "@/components/highlight-layer";
import {
  parseMarkdownTable,
  parseQuestionOptions,
  splitPromptIntoSegments,
  usesDragDropAnswer
} from "@/lib/question-interactions";

type Question = {
  id: string;
  order: number;
  questionType: string;
  prompt: string;
  optionsJson: string | null;
};

type Highlight = {
  id: string;
  assignableUnitId: string;
  selectedText: string;
  color: string;
  note: string | null;
  sourceType: string;
};

type AssignmentUnit = {
  id: string;
  order: number;
  customTimeLimitMinutes: number | null;
  assignableUnit: {
    id: string;
    skill: string;
    unitType: string;
    title: string;
    instructions: string | null;
    content: string;
    audioUrl: string | null;
    transcript: string | null;
    defaultTimeLimitMinutes: number | null;
    questions: Question[];
  };
};

type AttemptWorkspaceProps = {
  recipientId: string;
  attempt: {
    id: string;
    startedAt: Date | string;
    elapsedSeconds: number;
    tabSwitchCount: number;
  };
  assignment: {
    title: string;
    instructions: string | null;
    timeLimitMinutes: number | null;
    units: AssignmentUnit[];
  };
  highlights: Highlight[];
};

function usesLongAnswer(questionType: string) {
  return questionType.includes("essay") || questionType.includes("writing");
}

function QuestionInput({ question }: { question: Question }) {
  const options = parseQuestionOptions(question.optionsJson);
  const fieldName = `q_${question.id}`;

  if (options.length > 0) {
    return (
      <div className="mt-3 grid gap-2">
        {options.map((option) => (
          <label
            key={option}
            className="flex items-center gap-3 rounded-md border border-border bg-background/40 px-3 py-2 text-sm"
          >
            <input
              type="radio"
              name={fieldName}
              value={option}
              className="h-4 w-4 accent-teal-400"
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    );
  }

  if (usesLongAnswer(question.questionType)) {
    return (
      <textarea
        name={fieldName}
        rows={8}
        className="mt-3 w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
      />
    );
  }

  return (
    <input
      name={fieldName}
      className="mt-3 w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
      autoComplete="off"
    />
  );
}

function DragDropQuestion({ question }: { question: Question }) {
  const [answer, setAnswer] = useState("");
  const options = parseQuestionOptions(question.optionsJson);
  const segments = splitPromptIntoSegments(question.prompt);
  const fieldName = `q_${question.id}`;

  function handleDrop(event: DragEvent<HTMLButtonElement>, option?: string) {
    event.preventDefault();
    const droppedOption = option ?? event.dataTransfer.getData("text/plain");

    if (droppedOption) {
      setAnswer(droppedOption);
    }
  }

  function renderDropTarget(label: string) {
    return (
      <button
        type="button"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => handleDrop(event)}
        className="mx-1 inline-flex min-h-9 min-w-24 items-center justify-center rounded-md border border-dashed border-primary/60 bg-primary/10 px-3 py-1 text-sm font-medium text-foreground transition hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        aria-label={`Answer ${label}`}
      >
        {answer || label}
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-4">
      <input type="hidden" name={fieldName} value={answer} />

      <div className="rounded-md border border-border bg-background/40 p-3 text-sm leading-7">
        {segments.map((segment, index) =>
          segment.type === "blank" ? (
            <span key={`${segment.type}-${segment.value}-${index}`}>
              {renderDropTarget(segment.value)}
            </span>
          ) : (
            <span key={`${segment.type}-${index}`}>{segment.value}</span>
          )
        )}
        {segments.every((segment) => segment.type === "text") ? (
          <span className="ml-2">{renderDropTarget(String(question.order))}</span>
        ) : null}
      </div>

      <div className="grid gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Options
        </p>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            draggable
            onClick={() => setAnswer(option)}
            onDragStart={(event) => {
              event.dataTransfer.setData("text/plain", option);
              event.dataTransfer.effectAllowed = "move";
            }}
            className="cursor-grab rounded-md border border-border bg-background/60 px-3 py-2 text-left text-sm transition hover:border-primary hover:bg-primary/10 active:cursor-grabbing"
          >
            {option}
          </button>
        ))}
      </div>

      {answer ? (
        <button
          type="button"
          onClick={() => setAnswer("")}
          className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Clear answer
        </button>
      ) : null}
    </div>
  );
}

function TableCompletionCell({
  value,
  questionsByOrder
}: {
  value: string;
  questionsByOrder: Map<number, Question>;
}) {
  const segments = splitPromptIntoSegments(value);

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return <span key={`${segment.type}-${index}`}>{segment.value}</span>;
        }

        const question = questionsByOrder.get(Number(segment.value));

        if (!question) {
          return <span key={`${segment.type}-${segment.value}-${index}`}>[[{segment.value}]]</span>;
        }

        return (
          <input
            key={`${segment.type}-${segment.value}-${index}`}
            name={`q_${question.id}`}
            placeholder={segment.value}
            autoComplete="off"
            className="mx-1 inline-flex h-8 w-24 rounded-md border border-primary/50 bg-background/80 px-2 text-center text-sm font-medium outline-none ring-primary/40 focus:ring-2"
          />
        );
      })}
    </>
  );
}

function TableCompletionQuestionSet({
  content,
  questions
}: {
  content: string;
  questions: Question[];
}) {
  const table = parseMarkdownTable(content);
  const questionsByOrder = new Map(questions.map((question) => [question.order, question]));

  if (!table) {
    return (
      <div className="space-y-4">
        {questions.map((question) => (
          <article key={question.id} className="rounded-md border border-border bg-background/40 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Question {question.order}
            </p>
            <p className="mt-2 text-sm leading-6">{question.prompt}</p>
            <QuestionInput question={question} />
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-background/40">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted/60">
            {table.headers.map((header) => (
              <th key={header} className="border border-border px-3 py-2 text-left font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} className="border border-border px-3 py-3 align-top leading-7">
                  <TableCompletionCell value={cell} questionsByOrder={questionsByOrder} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AttemptWorkspace({
  recipientId,
  attempt,
  assignment,
  highlights
}: AttemptWorkspaceProps) {
  const elapsedRef = useRef<HTMLInputElement>(null);
  const tabSwitchRef = useRef<HTMLInputElement>(null);
  const submitReasonRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const startedAtMs = useMemo(() => new Date(attempt.startedAt).getTime(), [attempt.startedAt]);
  const timeLimitMinutes = assignment.timeLimitMinutes;

  useEffect(() => {
    function updateElapsed() {
      if (!elapsedRef.current) {
        return;
      }

      elapsedRef.current.value = String(
        Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
      );
    }

    updateElapsed();
    const intervalId = window.setInterval(updateElapsed, 1000);

    return () => window.clearInterval(intervalId);
  }, [startedAtMs]);

  useEffect(() => {
    function recordVisibilityChange() {
      if (!document.hidden || !tabSwitchRef.current) {
        return;
      }

      tabSwitchRef.current.value = String(Number(tabSwitchRef.current.value || "0") + 1);
    }

    document.addEventListener("visibilitychange", recordVisibilityChange);

    return () => document.removeEventListener("visibilitychange", recordVisibilityChange);
  }, []);

  useEffect(() => {
    if (!timeLimitMinutes || timeLimitMinutes <= 0) {
      return;
    }

    const timeoutMs = timeLimitMinutes * 60 * 1000 - (Date.now() - startedAtMs);

    if (timeoutMs <= 0) {
      submitReasonRef.current!.value = "auto_timeout";
      formRef.current?.requestSubmit();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (submitReasonRef.current) {
        submitReasonRef.current.value = "auto_timeout";
      }

      formRef.current?.requestSubmit();
    }, timeoutMs);

    return () => window.clearTimeout(timeoutId);
  }, [startedAtMs, timeLimitMinutes]);

  async function createHighlight(
    assignableUnitId: string,
    sourceType: string,
    payload: HighlightPayload
  ) {
    const formData = new FormData();
    formData.set("attemptId", attempt.id);
    formData.set("assignableUnitId", assignableUnitId);
    formData.set("sourceType", sourceType);
    formData.set("selectedText", payload.selectedText);
    formData.set("startOffset", String(payload.startOffset));
    formData.set("endOffset", String(payload.endOffset));
    formData.set("color", payload.color);
    formData.set("note", payload.note);

    await saveHighlight(formData);
  }

  return (
    <form ref={formRef} action={submitAttempt} className="space-y-8">
      <input type="hidden" name="attemptId" value={attempt.id} />
      <input ref={elapsedRef} type="hidden" name="elapsedSeconds" defaultValue={attempt.elapsedSeconds} />
      <input
        ref={tabSwitchRef}
        type="hidden"
        name="tabSwitchCount"
        defaultValue={attempt.tabSwitchCount}
      />
      <input ref={submitReasonRef} type="hidden" name="submitReason" defaultValue="manual" />
      <input type="hidden" name="recipientId" value={recipientId} />

      <section className="rounded-md border border-border bg-muted/35 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-primary">Attempt</p>
            <h2 className="mt-2 text-3xl font-semibold">{assignment.title}</h2>
            {assignment.instructions ? (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {assignment.instructions}
              </p>
            ) : null}
          </div>
          {timeLimitMinutes ? (
            <div className="rounded-md border border-border bg-background/50 px-3 py-2 text-sm text-muted-foreground">
              {timeLimitMinutes} minutes
            </div>
          ) : null}
        </div>
      </section>

      {assignment.units.map((assignmentUnit) => {
        const unit = assignmentUnit.assignableUnit;
        const tableCompletionQuestions = unit.questions.filter(
          (question) => question.questionType === "table_completion"
        );
        const regularQuestions = unit.questions.filter(
          (question) => question.questionType !== "table_completion"
        );
        const sourceText = unit.transcript || (tableCompletionQuestions.length > 0 ? "" : unit.content);
        const sourceType = unit.transcript ? "transcript" : "content";
        const unitHighlights = highlights.filter(
          (highlight) =>
            highlight.assignableUnitId === unit.id && highlight.sourceType === sourceType
        );

        return (
          <section key={assignmentUnit.id} className="rounded-md border border-border bg-muted/25">
            <div className="border-b border-border px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Unit {assignmentUnit.order} | {unit.skill.replaceAll("_", " ")}
              </p>
              <h3 className="mt-1 text-xl font-semibold">{unit.title}</h3>
              {unit.instructions ? (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{unit.instructions}</p>
              ) : null}
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
              <div className="space-y-4">
                {unit.audioUrl ? (
                  <audio controls src={unit.audioUrl} className="w-full">
                    <track kind="captions" />
                  </audio>
                ) : null}
                {sourceText ? (
                  <HighlightLayer
                    text={sourceText}
                    highlights={unitHighlights}
                    onHighlight={(payload) => createHighlight(unit.id, sourceType, payload)}
                  />
                ) : null}
              </div>

              <div className="space-y-4">
                {tableCompletionQuestions.length > 0 ? (
                  <TableCompletionQuestionSet
                    content={unit.content}
                    questions={tableCompletionQuestions}
                  />
                ) : null}
                {regularQuestions.length > 0 ? (
                  regularQuestions.map((question) => {
                    const options = parseQuestionOptions(question.optionsJson);
                    const isDragDrop = usesDragDropAnswer(question.questionType, options);

                    return (
                      <article
                        key={question.id}
                        className="rounded-md border border-border bg-background/40 p-4"
                      >
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Question {question.order}
                        </p>
                        {isDragDrop ? (
                          <DragDropQuestion question={question} />
                        ) : (
                          <>
                            <p className="mt-2 text-sm leading-6">{question.prompt}</p>
                            <QuestionInput question={question} />
                          </>
                        )}
                      </article>
                    );
                  })
                ) : tableCompletionQuestions.length === 0 ? (
                  <p className="rounded-md border border-border bg-background/40 p-4 text-sm text-muted-foreground">
                    No auto-graded questions are attached to this unit.
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        );
      })}

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
        >
          Submit attempt
        </button>
      </div>
    </form>
  );
}
