"use client";

import Link from "next/link";
import {
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import {
  deleteHighlight,
  saveAttemptDraft,
  saveHighlight,
  submitAttempt
} from "@/lib/actions/attempts";
import { HighlightLayer, type HighlightPayload } from "@/components/highlight-layer";
import { AudioPlayer } from "@/components/audio-player";
import { AnimatedThemeToggle } from "@/components/ui/animated-theme-toggle";
import {
  parseGroupInstructions,
  parseMarkdownTable,
  parseQuestionOptions,
  parseUnitImages,
  parseUnitMetaString,
  promptHasGap,
  splitPromptIntoGapSegments,
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
  startOffset: number;
  endOffset: number;
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
    metadataJson: string | null;
    questions: Question[];
  };
};

type AttemptWorkspaceProps = {
  recipientId: string;
  attempt: {
    id: string;
    startedAt: Date | string;
    elapsedSeconds: number;
  };
  assignment: {
    title: string;
    instructions: string | null;
    timeLimitMinutes: number | null;
    units: AssignmentUnit[];
  };
  highlights: Highlight[];
  savedAnswers: Record<string, string>;
};

type AnswerChange = (questionId: string, value: string) => void;

type SaveState = "idle" | "saving" | "saved" | "error";

function usesLongAnswer(questionType: string) {
  return questionType.includes("essay") || questionType.includes("writing");
}

function countWords(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

// Render nội dung đề có thể chứa bảng markdown (Writing Task 1). Mỗi khối bảng
// liên tiếp (các dòng có "|") được dựng thành <table>; phần còn lại giữ nguyên text.
function SourceContent({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const blocks: Array<{ type: "text"; value: string } | { type: "table"; value: string }> = [];
  let buffer: string[] = [];
  let bufferIsTable = false;

  const flush = () => {
    if (buffer.length === 0) {
      return;
    }
    blocks.push({ type: bufferIsTable ? "table" : "text", value: buffer.join("\n") });
    buffer = [];
  };

  lines.forEach((line) => {
    const looksTable = line.includes("|");
    if (looksTable !== bufferIsTable) {
      flush();
      bufferIsTable = looksTable;
    }
    buffer.push(line);
  });
  flush();

  return (
    <div className="space-y-3 text-sm leading-7 text-foreground">
      {blocks.map((block, index) => {
        if (block.type === "table") {
          const table = parseMarkdownTable(block.value);
          if (table) {
            return (
              <div key={index} className="overflow-x-auto rounded-md border border-border">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-muted/60">
                      {table.headers.map((header, hi) => (
                        <th key={hi} className="border border-border px-3 py-2 text-left font-semibold">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="border border-border px-3 py-2 align-top">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
        }
        return (
          <p key={index} className="whitespace-pre-wrap">
            {block.value}
          </p>
        );
      })}
    </div>
  );
}

function LongAnswerInput({
  question,
  initialValue,
  onAnswerChange
}: {
  question: Question;
  initialValue: string;
  onAnswerChange: AnswerChange;
}) {
  const [value, setValue] = useState(initialValue);
  const fieldName = `q_${question.id}`;

  return (
    <div className="mt-3 flex h-full min-h-[16rem] flex-col">
      <textarea
        name={fieldName}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          onAnswerChange(question.id, event.target.value);
        }}
        placeholder="Nhập bài viết của bạn tại đây…"
        className="min-h-[16rem] w-full flex-1 resize-y rounded-md border border-border bg-background/60 px-3 py-2 text-sm leading-7 outline-none focus:border-primary"
      />
      <div className="mt-1 text-right text-xs font-medium text-muted-foreground">
        {countWords(value)} từ
      </div>
    </div>
  );
}

function QuestionInput({
  question,
  initialValue,
  onAnswerChange
}: {
  question: Question;
  initialValue: string;
  onAnswerChange: AnswerChange;
}) {
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
              defaultChecked={initialValue === option}
              onChange={(event) => onAnswerChange(question.id, event.target.value)}
              className="h-4 w-4 accent-primary"
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    );
  }

  if (usesLongAnswer(question.questionType)) {
    return (
      <LongAnswerInput
        question={question}
        initialValue={initialValue}
        onAnswerChange={onAnswerChange}
      />
    );
  }

  return (
    <input
      name={fieldName}
      defaultValue={initialValue}
      onChange={(event) => onAnswerChange(question.id, event.target.value)}
      className="mt-3 w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
      autoComplete="off"
    />
  );
}

function InlineGapQuestion({
  question,
  initialValue,
  onAnswerChange
}: {
  question: Question;
  initialValue: string;
  onAnswerChange: AnswerChange;
}) {
  const fieldName = `q_${question.id}`;
  const segments = splitPromptIntoGapSegments(question.prompt);
  let inputPlaced = false;

  return (
    <p className="mt-2 text-sm leading-9">
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return <span key={`text-${index}`}>{segment.value}</span>;
        }

        // Chỉ ô trống đầu tiên là input; câu điền từ thường chỉ có một chỗ trống.
        if (!inputPlaced) {
          inputPlaced = true;

          return (
            <input
              key={`blank-${index}`}
              name={fieldName}
              defaultValue={initialValue}
              onChange={(event) => onAnswerChange(question.id, event.target.value)}
              autoComplete="off"
              className="mx-1 inline-flex h-8 w-40 rounded-md border border-primary/50 bg-background/80 px-2 text-center align-middle text-sm font-medium outline-none ring-primary/40 focus:ring-2"
            />
          );
        }

        return <span key={`blank-${index}`}>_____</span>;
      })}
    </p>
  );
}

function DragDropQuestion({
  question,
  initialValue,
  onAnswerChange
}: {
  question: Question;
  initialValue: string;
  onAnswerChange: AnswerChange;
}) {
  const [answer, setAnswer] = useState(initialValue);
  const options = parseQuestionOptions(question.optionsJson);
  const segments = splitPromptIntoSegments(question.prompt);
  const fieldName = `q_${question.id}`;

  function applyAnswer(value: string) {
    setAnswer(value);
    onAnswerChange(question.id, value);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>, option?: string) {
    event.preventDefault();
    const droppedOption = option ?? event.dataTransfer.getData("text/plain");

    if (droppedOption) {
      applyAnswer(droppedOption);
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
          Lựa chọn
        </p>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            draggable
            onClick={() => applyAnswer(option)}
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
          onClick={() => applyAnswer("")}
          className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Xoá đáp án
        </button>
      ) : null}
    </div>
  );
}

function TableCompletionCell({
  value,
  questionsByOrder,
  savedAnswers,
  onAnswerChange
}: {
  value: string;
  questionsByOrder: Map<number, Question>;
  savedAnswers: Record<string, string>;
  onAnswerChange: AnswerChange;
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
            defaultValue={savedAnswers[question.id] ?? ""}
            onChange={(event) => onAnswerChange(question.id, event.target.value)}
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
  questions,
  savedAnswers,
  onAnswerChange
}: {
  content: string;
  questions: Question[];
  savedAnswers: Record<string, string>;
  onAnswerChange: AnswerChange;
}) {
  const table = parseMarkdownTable(content);
  const questionsByOrder = new Map(questions.map((question) => [question.order, question]));

  if (!table) {
    return (
      <div className="space-y-4">
        {questions.map((question) => (
          <article
            key={question.id}
            id={`question-${question.id}`}
            className="scroll-mt-24 rounded-md border border-border bg-background/40 p-4"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Câu {question.order}
            </p>
            <p className="mt-2 text-sm leading-6">{question.prompt}</p>
            <QuestionInput
              question={question}
              initialValue={savedAnswers[question.id] ?? ""}
              onAnswerChange={onAnswerChange}
            />
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
                  <TableCompletionCell
                    value={cell}
                    questionsByOrder={questionsByOrder}
                    savedAnswers={savedAnswers}
                    onAnswerChange={onAnswerChange}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NoteCompletionQuestionSet({
  content,
  questions,
  savedAnswers,
  onAnswerChange
}: {
  content: string;
  questions: Question[];
  savedAnswers: Record<string, string>;
  onAnswerChange: AnswerChange;
}) {
  const questionsByOrder = new Map(questions.map((question) => [question.order, question]));

  // Ô trống inline (dùng chung cho từng dòng ghi chú).
  const renderBlank = (order: string, key: string) => {
    const question = questionsByOrder.get(Number(order));
    if (!question) {
      return <span key={key}>[[{order}]]</span>;
    }
    return (
      <input
        key={key}
        name={`q_${question.id}`}
        placeholder={order}
        defaultValue={savedAnswers[question.id] ?? ""}
        onChange={(event) => onAnswerChange(question.id, event.target.value)}
        autoComplete="off"
        className="mx-1 inline-flex h-8 w-28 items-center rounded-md border border-primary/60 bg-background px-2 text-center align-middle text-sm font-semibold outline-none ring-primary/40 focus:ring-2"
      />
    );
  };

  const renderLineContent = (text: string, lineKey: string) =>
    splitPromptIntoSegments(text).map((segment, index) =>
      segment.type === "blank" ? (
        renderBlank(segment.value, `${lineKey}-b-${index}`)
      ) : (
        <span key={`${lineKey}-t-${index}`}>{segment.value}</span>
      )
    );

  // Ghi chú kiểu chin.edu.vn: dòng "# " = tiêu đề canh giữa; "## " = tiểu mục
  // in đậm; dòng trống = khoảng cách; còn lại là dòng nội dung có ô trống inline.
  const lines = content.split(/\r?\n/);

  return (
    <div className="overflow-hidden rounded-lg border border-primary/20 bg-primary/5">
      <div className="space-y-2 px-5 py-4 text-sm leading-8">
        {lines.map((line, index) => {
          const key = `line-${index}`;
          const trimmed = line.trim();

          if (trimmed === "") {
            return <div key={key} className="h-2" />;
          }
          if (trimmed.startsWith("# ")) {
            return (
              <p key={key} className="text-center text-base font-bold">
                {trimmed.slice(2)}
              </p>
            );
          }
          if (trimmed.startsWith("## ")) {
            return (
              <p key={key} className="pt-1 font-bold">
                {trimmed.slice(3)}
              </p>
            );
          }
          return (
            <p key={key} className="leading-8">
              {renderLineContent(line, key)}
            </p>
          );
        })}
      </div>
    </div>
  );
}

function MatchingQuestionSet({
  questions,
  savedAnswers,
  onAnswerChange
}: {
  questions: Question[];
  savedAnswers: Record<string, string>;
  onAnswerChange: AnswerChange;
}) {
  const sharedOptions = useMemo(() => {
    const seen = new Set<string>();
    const pool: string[] = [];

    questions.forEach((question) => {
      parseQuestionOptions(question.optionsJson).forEach((option) => {
        if (!seen.has(option)) {
          seen.add(option);
          pool.push(option);
        }
      });
    });

    return pool;
  }, [questions]);

  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};

    questions.forEach((question) => {
      if (savedAnswers[question.id]) {
        initial[question.id] = savedAnswers[question.id];
      }
    });

    return initial;
  });
  const [activeOption, setActiveOption] = useState<string | null>(null);

  function assign(questionId: string, value: string) {
    setSelections((previous) => ({ ...previous, [questionId]: value }));
    onAnswerChange(questionId, value);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.85fr)]">
      <div className="space-y-2">
        {questions.map((question) => {
          const value = selections[question.id] ?? "";

          return (
            <div
              key={question.id}
              id={`question-${question.id}`}
              className="flex scroll-mt-24 items-center gap-3 rounded-md border border-border bg-background/40 px-3 py-2"
            >
              <input type="hidden" name={`q_${question.id}`} value={value} />
              <span className="w-6 shrink-0 text-sm font-semibold text-muted-foreground">
                {question.order}.
              </span>
              <span className="flex-1 text-sm">{question.prompt}</span>
              <button
                type="button"
                onClick={() => {
                  if (activeOption) {
                    assign(question.id, activeOption);
                  }
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const dropped = event.dataTransfer.getData("text/plain");
                  if (dropped) {
                    assign(question.id, dropped);
                  }
                }}
                className="inline-flex min-h-9 min-w-28 items-center justify-center rounded-md border border-dashed border-primary/60 bg-primary/10 px-3 py-1 text-sm font-medium text-foreground transition hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                aria-label={`Answer ${question.order}`}
              >
                {value || "—"}
              </button>
              {value ? (
                <button
                  type="button"
                  onClick={() => assign(question.id, "")}
                  className="shrink-0 text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  Xoá
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Lựa chọn (có thể dùng nhiều lần)
        </p>
        {sharedOptions.length > 0 ? (
          sharedOptions.map((option) => (
            <button
              key={option}
              type="button"
              draggable
              aria-pressed={activeOption === option}
              onClick={() => setActiveOption((previous) => (previous === option ? null : option))}
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", option);
                event.dataTransfer.effectAllowed = "copy";
              }}
              className={
                activeOption === option
                  ? "block w-full cursor-grab rounded-md border border-primary bg-primary/15 px-3 py-2 text-left text-sm font-medium transition active:cursor-grabbing"
                  : "block w-full cursor-grab rounded-md border border-border bg-background/60 px-3 py-2 text-left text-sm transition hover:border-primary hover:bg-primary/10 active:cursor-grabbing"
              }
            >
              {option}
            </button>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">Chưa có lựa chọn.</p>
        )}
        {activeOption ? (
          <p className="text-xs text-muted-foreground">
            Đã chọn “{activeOption}” — bấm vào ô trống để điền.
          </p>
        ) : null}
      </div>
    </div>
  );
}

// Khung hướng dẫn cho một nhóm câu (kiểu chin.edu.vn): tiêu đề "Câu X–Y" + nội
// dung yêu cầu, viền đỏ nổi bật phía trên nhóm.
function GroupInstructionBox({ rangeLabel, text }: { rangeLabel: string; text: string }) {
  return (
    <div className="rounded-md border border-rose-400/60 bg-rose-500/10 px-4 py-3 dark:border-rose-400/40">
      <p className="text-sm font-bold text-rose-700 dark:text-rose-300">{rangeLabel}</p>
      <p className="mt-1 whitespace-pre-line text-sm leading-6 text-foreground">{text}</p>
    </div>
  );
}

// Bỏ phần nhãn dẫn ("Đoạn nào (A–G) chứa thông tin sau: ...") để bảng chỉ hiện
// nội dung cần ghép, gọn như đề gốc. Chỉ cắt khi nhãn ngắn (<= 60 ký tự).
function stripGridPrefix(prompt: string) {
  const idx = prompt.indexOf(": ");
  if (idx > 0 && idx <= 60) {
    return prompt.slice(idx + 2);
  }
  return prompt;
}

// Dạng "ghép thông tin với đoạn A–G": nhiều câu cùng bộ lựa chọn chữ cái hiển
// thị thành một bảng — hàng là câu hỏi, cột là các chữ cái, học sinh tick 1 ô.
function MatchingGridQuestionSet({
  questions,
  options,
  savedAnswers,
  onAnswerChange,
  flagged,
  onToggleFlag
}: {
  questions: Question[];
  options: string[];
  savedAnswers: Record<string, string>;
  onAnswerChange: AnswerChange;
  flagged: Set<string>;
  onToggleFlag: (questionId: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-background/40">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted/60">
            <th className="border border-border px-3 py-2 text-left font-semibold">Thông tin</th>
            {options.map((option) => (
              <th
                key={option}
                className="border border-border px-2 py-2 text-center font-semibold"
              >
                {option}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {questions.map((question) => {
            const value = savedAnswers[question.id] ?? "";
            const isFlagged = flagged.has(question.id);

            return (
              <tr key={question.id} id={`question-${question.id}`} className="scroll-mt-24">
                <td className="border border-border px-3 py-2 align-top leading-6">
                  <div className="flex items-start justify-between gap-2">
                    <span>
                      <span className="font-semibold">{question.order}.</span>{" "}
                      {stripGridPrefix(question.prompt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onToggleFlag(question.id)}
                      aria-pressed={isFlagged}
                      title={isFlagged ? "Bỏ đánh dấu" : "Đánh dấu"}
                      className={
                        isFlagged
                          ? "shrink-0 text-amber-500"
                          : "shrink-0 text-muted-foreground hover:text-amber-500"
                      }
                    >
                      {isFlagged ? "★" : "☆"}
                    </button>
                  </div>
                </td>
                {options.map((option) => (
                  <td key={option} className="border border-border px-2 py-2 text-center align-middle">
                    <input
                      type="radio"
                      name={`q_${question.id}`}
                      value={option}
                      checked={value === option}
                      onChange={() => onAnswerChange(question.id, option)}
                      className="h-4 w-4 accent-primary"
                      aria-label={`Câu ${question.order} — ${option}`}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Dạng TRUE/FALSE/NOT GIVEN (và YES/NO/NOT GIVEN): nhiều câu xếp lưới 2 cột,
// mỗi câu là một ô gọn với 3 lựa chọn nằm ngang — đỡ phải cuộn nhiều.
function TfngGridQuestionSet({
  questions,
  options,
  savedAnswers,
  onAnswerChange,
  flagged,
  onToggleFlag
}: {
  questions: Question[];
  options: string[];
  savedAnswers: Record<string, string>;
  onAnswerChange: AnswerChange;
  flagged: Set<string>;
  onToggleFlag: (questionId: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {questions.map((question) => {
        const value = savedAnswers[question.id] ?? "";
        const isFlagged = flagged.has(question.id);

        return (
          <div
            key={question.id}
            id={`question-${question.id}`}
            className="flex scroll-mt-24 flex-col rounded-md border border-border bg-background/40 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm leading-6">
                <span className="font-semibold">{question.order}.</span> {question.prompt}
              </p>
              <button
                type="button"
                onClick={() => onToggleFlag(question.id)}
                aria-pressed={isFlagged}
                title={isFlagged ? "Bỏ đánh dấu" : "Đánh dấu"}
                className={
                  isFlagged
                    ? "shrink-0 text-amber-500"
                    : "shrink-0 text-muted-foreground hover:text-amber-500"
                }
              >
                {isFlagged ? "★" : "☆"}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
              {options.map((option) => (
                <label key={option} className="inline-flex cursor-pointer items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name={`q_${question.id}`}
                    value={option}
                    checked={value === option}
                    onChange={() => onAnswerChange(question.id, option)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CountdownTimer({
  startedAtMs,
  timeLimitMinutes
}: {
  startedAtMs: number;
  timeLimitMinutes: number;
}) {
  const endMs = startedAtMs + timeLimitMinutes * 60 * 1000;
  const [remaining, setRemaining] = useState(() => Math.max(0, endMs - Date.now()));

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining(Math.max(0, endMs - Date.now()));
    }, 1000);

    return () => window.clearInterval(id);
  }, [endMs]);

  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const expired = totalSeconds <= 0;
  const low = totalSeconds <= 60;

  return (
    <div
      className={[
        "inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold tabular-nums",
        expired || low
          ? "border-red-400/60 bg-red-500/10 text-red-600 dark:text-red-300"
          : "border-accent/40 bg-accent/10 text-accent-foreground dark:text-accent"
      ].join(" ")}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" strokeLinecap="round" />
      </svg>
      {expired ? (
        <span className="font-semibold uppercase tracking-wide">Hết giờ</span>
      ) : (
        <>
          <span className="hidden text-[11px] font-medium uppercase tracking-wide opacity-80 sm:inline">
            Còn lại
          </span>
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </>
      )}
    </div>
  );
}

// Bố cục 2 cột có thanh chia KÉO ĐƯỢC để chỉnh độ rộng (giống IELTSITY/chin).
// Trên màn lớn: hai cột cạnh nhau, kéo thanh giữa để đổi tỉ lệ. Màn nhỏ: xếp dọc.
function SplitPane({
  left,
  right,
  fontScale
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  fontScale: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [leftPct, setLeftPct] = useState(58);
  const [isDesktop, setIsDesktop] = useState(false);
  const zoomStyle = { zoom: fontScale } as React.CSSProperties;

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    function onMove(event: PointerEvent) {
      if (!draggingRef.current || !containerRef.current) {
        return;
      }
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((event.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(80, Math.max(25, pct)));
    }
    function onUp() {
      if (!draggingRef.current) {
        return;
      }
      draggingRef.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden"
    >
      <div
        className="space-y-4 p-5 lg:h-full lg:overflow-y-auto"
        style={isDesktop ? { width: `${leftPct}%`, flex: "none" } : undefined}
      >
        <div style={zoomStyle} className="space-y-4">
          {left}
        </div>
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Kéo để chỉnh độ rộng"
        onPointerDown={() => {
          draggingRef.current = true;
          document.body.style.userSelect = "none";
          document.body.style.cursor = "col-resize";
        }}
        onDoubleClick={() => setLeftPct(58)}
        title="Kéo để chỉnh độ rộng · nhấp đúp để đặt lại"
        className="hidden shrink-0 cursor-col-resize items-center justify-center border-x border-border bg-muted/60 transition hover:bg-primary/30 lg:flex lg:w-2"
      >
        <div className="h-10 w-0.5 rounded-full bg-muted-foreground/50" />
      </div>

      <div className="space-y-4 p-5 lg:h-full lg:flex-1 lg:overflow-y-auto">
        <div style={zoomStyle} className="space-y-4">
          {right}
        </div>
      </div>
    </div>
  );
}

export function AttemptWorkspace({
  recipientId,
  attempt,
  assignment,
  highlights,
  savedAnswers
}: AttemptWorkspaceProps) {
  const elapsedRef = useRef<HTMLInputElement>(null);
  const submitReasonRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const startedAtMs = useMemo(() => new Date(attempt.startedAt).getTime(), [attempt.startedAt]);
  const timeLimitMinutes = assignment.timeLimitMinutes;

  const [answers, setAnswers] = useState<Record<string, string>>(savedAnswers);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [activePart, setActivePart] = useState(0);
  // Cỡ chữ vùng nội dung (đề + câu hỏi) cho học sinh tự chỉnh; lưu localStorage.
  const [fontScale, setFontScale] = useState(1.1);
  // Render the full-screen test room through a portal so it escapes any
  // transformed ancestor (the app shell's fade-in wrapper) that would otherwise
  // trap `position: fixed` and collapse the layout.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = Number(window.localStorage.getItem("attemptFontScale"));
    if (saved >= 0.9 && saved <= 1.6) {
      setFontScale(saved);
    }
  }, []);

  const adjustFontScale = useCallback((delta: number) => {
    setFontScale((previous) => {
      const next = Math.min(1.6, Math.max(0.9, Math.round((previous + delta) * 100) / 100));
      window.localStorage.setItem("attemptFontScale", String(next));
      return next;
    });
  }, []);

  const goToPart = useCallback((partIndex: number) => {
    setActivePart(partIndex);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const handleAnswerChange = useCallback<AnswerChange>((questionId, value) => {
    setAnswers((previous) => {
      if (previous[questionId] === value) {
        return previous;
      }

      return { ...previous, [questionId]: value };
    });
  }, []);

  const toggleFlag = useCallback((questionId: string) => {
    setFlagged((previous) => {
      const next = new Set(previous);

      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }

      return next;
    });
  }, []);

  const persistDraft = useCallback(async () => {
    setSaveState("saving");

    try {
      const formData = new FormData();
      formData.set("attemptId", attempt.id);
      Object.entries(answers).forEach(([questionId, value]) => {
        formData.set(`q_${questionId}`, value);
      });

      await saveAttemptDraft(formData);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [answers, attempt.id]);

  // Khoá cuộn nền khi đang ở chế độ làm bài toàn màn hình.
  useEffect(() => {
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Autosave answers shortly after they change.
  const firstRenderRef = useRef(true);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void persistDraft();
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [persistDraft]);

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

  // Lưu ý: KHÔNG tự động nộp khi hết giờ. Đồng hồ chỉ đếm ngược và báo "Hết giờ";
  // học sinh tự bấm "Nộp bài". (Tránh việc mở lại bài quá giờ bị nộp ngay.)

  async function createHighlight(
    assignableUnitId: string,
    sourceType: string,
    payload: HighlightPayload
  ): Promise<string> {
    const formData = new FormData();
    formData.set("attemptId", attempt.id);
    formData.set("assignableUnitId", assignableUnitId);
    formData.set("sourceType", sourceType);
    formData.set("selectedText", payload.selectedText);
    formData.set("startOffset", String(payload.startOffset));
    formData.set("endOffset", String(payload.endOffset));
    formData.set("color", payload.color);
    formData.set("note", payload.note);

    const result = await saveHighlight(formData);
    return result.id;
  }

  async function removeHighlight(highlightId: string) {
    const formData = new FormData();
    formData.set("highlightId", highlightId);

    await deleteHighlight(formData);
  }

  function scrollToQuestion(anchorId: string) {
    const target = document.getElementById(anchorId);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });

    if (anchorId.startsWith("question-")) {
      const input = target?.querySelector<HTMLElement>(
        "input:not([type=hidden]), textarea, button"
      );
      input?.focus({ preventScroll: true });
    }
  }

  const totalQuestions = assignment.units.reduce(
    (sum, unit) => sum + unit.assignableUnit.questions.length,
    0
  );
  const answeredCount = Object.values(answers).filter((value) => value.trim() !== "").length;

  // Question palette grouped by unit ("Phần").
  const parts = assignment.units.map((assignmentUnit) => {
    const unit = assignmentUnit.assignableUnit;

    return {
      unitId: assignmentUnit.id,
      order: assignmentUnit.order,
      title: unit.title,
      entries: [...unit.questions]
        .sort((a, b) => a.order - b.order)
        .map((question) => ({
          id: question.id,
          order: question.order,
          anchorId:
            question.questionType === "table_completion"
              ? `tablesection-${assignmentUnit.id}`
              : question.questionType === "note_completion"
                ? `notesection-${assignmentUnit.id}`
                : `question-${question.id}`
        }))
    };
  });

  const content = (
    <form
      ref={formRef}
      action={submitAttempt}
      onKeyDown={(event) => {
        // Tránh nộp bài ngoài ý muốn: theo mặc định, bấm Enter trong ô <input>
        // sẽ submit form. Chặn Enter trong input (vẫn cho Enter xuống dòng trong
        // textarea của bài viết). Bài chỉ nộp khi bấm nút "Nộp bài".
        const target = event.target as HTMLElement;
        if (event.key === "Enter" && target.tagName === "INPUT") {
          event.preventDefault();
        }
      }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      <input type="hidden" name="attemptId" value={attempt.id} />
      <input ref={elapsedRef} type="hidden" name="elapsedSeconds" defaultValue={attempt.elapsedSeconds} />
      <input ref={submitReasonRef} type="hidden" name="submitReason" defaultValue="manual" />
      <input type="hidden" name="recipientId" value={recipientId} />

      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/student"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-primary transition hover:border-primary"
          >
            ‹ Bảng điều khiển
          </Link>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Phòng làm bài</p>
            <h2 className="truncate text-base font-bold tracking-tight sm:text-lg">{assignment.title}</h2>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center overflow-hidden rounded-lg border border-border" title="Cỡ chữ">
            <button
              type="button"
              onClick={() => adjustFontScale(-0.1)}
              disabled={fontScale <= 0.9}
              aria-label="Giảm cỡ chữ"
              className="px-2.5 py-2 text-xs font-bold text-foreground hover:bg-muted disabled:opacity-40"
            >
              A−
            </button>
            <span className="border-x border-border px-2 py-2 text-[11px] font-semibold tabular-nums text-muted-foreground">
              {Math.round(fontScale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => adjustFontScale(0.1)}
              disabled={fontScale >= 1.6}
              aria-label="Tăng cỡ chữ"
              className="px-2.5 py-2 text-sm font-bold text-foreground hover:bg-muted disabled:opacity-40"
            >
              A+
            </button>
          </div>
          <AnimatedThemeToggle />
          {timeLimitMinutes ? (
            <CountdownTimer startedAtMs={startedAtMs} timeLimitMinutes={timeLimitMinutes} />
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
      {assignment.units.map((assignmentUnit, partIndex) => {
        const unit = assignmentUnit.assignableUnit;
        const tableCompletionQuestions = unit.questions.filter(
          (question) => question.questionType === "table_completion"
        );
        const noteCompletionQuestions = unit.questions.filter(
          (question) => question.questionType === "note_completion"
        );
        const matchingQuestions = unit.questions.filter(
          (question) => question.questionType === "matching"
        );
        // Thân bài ghi chú/bảng có thể tách riêng khỏi passage qua metadata
        // (noteBody/tableBody). Khi có → passage vẫn hiện bên trái, khối điền
        // chỗ trống dùng thân riêng này. Khi không → dùng unit.content như cũ.
        const noteBody = parseUnitMetaString(unit.metadataJson, "noteBody");
        const tableBody = parseUnitMetaString(unit.metadataJson, "tableBody");
        const noteBodyContent = noteBody ?? unit.content;
        const tableBodyContent = tableBody ?? unit.content;
        // Chỉ "ăn" mất passage khi có câu điền chỗ trống MÀ dùng chính unit.content.
        const inlineCompletionConsumesContent =
          (tableCompletionQuestions.length > 0 && !tableBody) ||
          (noteCompletionQuestions.length > 0 && !noteBody);
        const regularQuestions = unit.questions.filter(
          (question) =>
            question.questionType !== "table_completion" &&
            question.questionType !== "note_completion" &&
            question.questionType !== "matching"
        );
        const isListening =
          unit.unitType === "listening_part" || unit.skill === "listening";
        // Không hiện transcript khi đang làm bài (tránh lộ đáp án nghe). Đoạn văn
        // để tô màu chỉ áp dụng cho Reading: là nội dung bài đọc (khi không bị
        // bảng/ghi chú "ăn" mất content).
        const isWriting = unit.unitType === "writing_task" || unit.skill === "writing";
        const sourceText = inlineCompletionConsumesContent ? "" : unit.content;
        const sourceType = "content";
        const images = parseUnitImages(unit.metadataJson);
        const groupInstructions = parseGroupInstructions(unit.metadataJson);
        // Dải câu của mỗi nhóm = từ key (câu đầu nhóm) tới ngay trước key kế tiếp,
        // hoặc tới câu cuối của phần. Nhờ vậy nhãn hiện đúng "Câu 7–13" dù nhóm gồm
        // nhiều thẻ câu riêng lẻ.
        const groupKeys = Object.keys(groupInstructions)
          .map(Number)
          .sort((a, b) => a - b);
        const maxUnitOrder = unit.questions.reduce(
          (max, question) => Math.max(max, question.order),
          0
        );
        const groupRangeLabel: Record<number, string> = {};
        groupKeys.forEach((key, index) => {
          const nextKey = groupKeys[index + 1];
          const end = nextKey ? nextKey - 1 : maxUnitOrder;
          groupRangeLabel[key] = end > key ? `Câu ${key}–${end}` : `Câu ${key}`;
        });

        // Khung hướng dẫn: hiện một lần phía trên nhóm có câu đầu khớp một key.
        const groupBox = (groupQuestions: Question[]) => {
          if (groupQuestions.length === 0) {
            return null;
          }
          const startOrder = Math.min(...groupQuestions.map((question) => question.order));
          const text = groupInstructions[startOrder];
          if (!text) {
            return null;
          }
          return (
            <GroupInstructionBox
              rangeLabel={groupRangeLabel[startOrder] ?? `Câu ${startOrder}`}
              text={text}
            />
          );
        };
        const hasPassage = !isListening && (Boolean(sourceText) || images.length > 0);
        const unitHighlights = highlights.filter(
          (highlight) =>
            highlight.assignableUnitId === unit.id && highlight.sourceType === sourceType
        );

        const audioSection = unit.audioUrl ? (
          <div className="shrink-0 border-b border-border bg-muted/30 px-5 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
              Bài nghe
            </p>
            <AudioPlayer src={unit.audioUrl} />
          </div>
        ) : isListening ? (
          <div className="shrink-0 border-b border-border bg-amber-500/10 px-5 py-3 text-sm font-medium text-amber-700 dark:text-amber-300">
            Chưa có file nghe cho phần này. Vui lòng báo giáo viên bổ sung audio.
          </div>
        ) : null;

        // Gom các câu liên tiếp cùng bộ lựa chọn thành nhóm gọn:
        // - "grid": multiple_choice với lựa chọn là chữ cái đơn (vd A–G) → bảng ghép.
        // - "tfng": TRUE/FALSE/NOT GIVEN, YES/NO/NOT GIVEN → lưới 2 cột.
        // Còn lại render từng thẻ ("single").
        type RegularItem =
          | { kind: "grid"; key: string; questions: Question[]; options: string[] }
          | { kind: "tfng"; key: string; questions: Question[]; options: string[] }
          | { kind: "single"; key: string; question: Question };
        const regularRenderItems: RegularItem[] = [];
        // Gom các câu liên tiếp có cùng bộ lựa chọn, bắt đầu từ startIndex.
        const sameOptionsRun = (startIndex: number, options: string[]) => {
          const run = [regularQuestions[startIndex]];
          let j = startIndex + 1;
          while (j < regularQuestions.length) {
            const next = regularQuestions[j];
            if (next.questionType !== regularQuestions[startIndex].questionType) {
              break;
            }
            const nextOptions = parseQuestionOptions(next.optionsJson);
            const sameOptions =
              nextOptions.length === options.length &&
              nextOptions.every((option, k) => option === options[k]);
            if (!sameOptions) {
              break;
            }
            run.push(next);
            j += 1;
          }
          return run;
        };

        for (let i = 0; i < regularQuestions.length; i += 1) {
          const question = regularQuestions[i];
          const options = parseQuestionOptions(question.optionsJson);
          const isLetterMc =
            question.questionType === "multiple_choice" &&
            options.length >= 3 &&
            options.every((option) => option.trim().length <= 2);
          const isTfng =
            question.questionType === "true_false_not_given" && options.length >= 2;

          if (isLetterMc || isTfng) {
            const run = sameOptionsRun(i, options);
            if (run.length >= 2) {
              regularRenderItems.push({
                kind: isLetterMc ? "grid" : "tfng",
                key: `${isLetterMc ? "grid" : "tfng"}-${question.id}`,
                questions: run,
                options
              });
              i += run.length - 1;
              continue;
            }
          }

          regularRenderItems.push({ kind: "single", key: question.id, question });
        }

        const renderSingleQuestion = (question: Question) => {
          const options = parseQuestionOptions(question.optionsJson);
          const isDragDrop = usesDragDropAnswer(question.questionType, options);
          const isInlineGap =
            !isDragDrop &&
            options.length === 0 &&
            !usesLongAnswer(question.questionType) &&
            promptHasGap(question.prompt);

          return (
            <article
              key={question.id}
              id={`question-${question.id}`}
              className="scroll-mt-24 rounded-md border border-border bg-background/40 p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Câu {question.order}
                </p>
                <button
                  type="button"
                  onClick={() => toggleFlag(question.id)}
                  aria-pressed={flagged.has(question.id)}
                  className={
                    flagged.has(question.id)
                      ? "rounded-md border border-amber-400/70 bg-amber-400/15 px-2 py-1 text-xs font-medium text-amber-600 dark:text-amber-300"
                      : "rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:border-primary"
                  }
                >
                  {flagged.has(question.id) ? "★ Đã đánh dấu" : "☆ Đánh dấu"}
                </button>
              </div>
              {isDragDrop ? (
                <DragDropQuestion
                  question={question}
                  initialValue={answers[question.id] ?? ""}
                  onAnswerChange={handleAnswerChange}
                />
              ) : isInlineGap ? (
                <InlineGapQuestion
                  question={question}
                  initialValue={answers[question.id] ?? ""}
                  onAnswerChange={handleAnswerChange}
                />
              ) : (
                <>
                  <p className="mt-2 text-sm leading-6">{question.prompt}</p>
                  <QuestionInput
                    question={question}
                    initialValue={answers[question.id] ?? ""}
                    onAnswerChange={handleAnswerChange}
                  />
                </>
              )}
            </article>
          );
        };

        const questionsContent = (
          <>
            {tableCompletionQuestions.length > 0 ? (
              <div id={`tablesection-${assignmentUnit.id}`} className="scroll-mt-24 space-y-3">
                {groupBox(tableCompletionQuestions)}
                <TableCompletionQuestionSet
                  content={tableBodyContent}
                  questions={tableCompletionQuestions}
                  savedAnswers={answers}
                  onAnswerChange={handleAnswerChange}
                />
              </div>
            ) : null}
            {noteCompletionQuestions.length > 0 ? (
              <div id={`notesection-${assignmentUnit.id}`} className="scroll-mt-24 space-y-3">
                {groupBox(noteCompletionQuestions)}
                <NoteCompletionQuestionSet
                  content={noteBodyContent}
                  questions={noteCompletionQuestions}
                  savedAnswers={answers}
                  onAnswerChange={handleAnswerChange}
                />
              </div>
            ) : null}
            {matchingQuestions.length > 0 ? (
              <div className="space-y-3">
                {groupBox(matchingQuestions)}
                <MatchingQuestionSet
                  questions={matchingQuestions}
                  savedAnswers={answers}
                  onAnswerChange={handleAnswerChange}
                />
              </div>
            ) : null}
            {regularRenderItems.length > 0 ? (
              regularRenderItems.map((item) => {
                const groupQuestions = item.kind === "single" ? [item.question] : item.questions;
                const box = groupBox(groupQuestions);
                return (
                  <div key={item.key} className="space-y-3">
                    {box}
                    {item.kind === "grid" ? (
                      <MatchingGridQuestionSet
                        questions={item.questions}
                        options={item.options}
                        savedAnswers={answers}
                        onAnswerChange={handleAnswerChange}
                        flagged={flagged}
                        onToggleFlag={toggleFlag}
                      />
                    ) : item.kind === "tfng" ? (
                      <TfngGridQuestionSet
                        questions={item.questions}
                        options={item.options}
                        savedAnswers={answers}
                        onAnswerChange={handleAnswerChange}
                        flagged={flagged}
                        onToggleFlag={toggleFlag}
                      />
                    ) : (
                      renderSingleQuestion(item.question)
                    )}
                  </div>
                );
              })
            ) : tableCompletionQuestions.length === 0 &&
              noteCompletionQuestions.length === 0 &&
              matchingQuestions.length === 0 ? (
              <p className="rounded-md border border-border bg-muted/60 p-4 text-sm text-muted-foreground">
                Phần này không có câu hỏi tự động chấm.
              </p>
            ) : null}
          </>
        );

        return (
          <section
            key={assignmentUnit.id}
            className={
              partIndex === activePart
                ? "flex h-full flex-col bg-card"
                : "hidden"
            }
          >
            <div className="shrink-0 border-b border-border bg-muted/50 px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Phần {assignmentUnit.order} · {unit.skill.replaceAll("_", " ")}
              </p>
              <h3 className="mt-0.5 text-lg font-semibold">{unit.title}</h3>
              {unit.instructions ? (
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{unit.instructions}</p>
              ) : null}
            </div>

            {audioSection}

            {hasPassage ? (
              <SplitPane
                left={
                  <>
                    {images.length > 0 ? (
                      <div className="space-y-3">
                        {images.map((src, index) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={`${src}-${index}`}
                            src={src}
                            alt={`Hình ${index + 1}`}
                            className="w-full rounded-md border border-border bg-white"
                          />
                        ))}
                      </div>
                    ) : null}
                    {sourceText ? (
                      isWriting ? (
                        <SourceContent content={sourceText} />
                      ) : (
                        <HighlightLayer
                          text={sourceText}
                          highlights={unitHighlights}
                          onHighlight={(payload) => createHighlight(unit.id, sourceType, payload)}
                          onRemoveHighlight={removeHighlight}
                        />
                      )
                    ) : null}
                  </>
                }
                right={questionsContent}
                fontScale={fontScale}
              />
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div
                  className="mx-auto max-w-4xl space-y-4 p-5"
                  style={{ zoom: fontScale } as React.CSSProperties}
                >
                  {questionsContent}
                </div>
              </div>
            )}
          </section>
        );
      })}
      </div>

      <div className="shrink-0 border-t border-border bg-card">
        <div className="flex w-full flex-col gap-2 px-4 py-3">
          {parts.length > 1 ? (
            <div className="flex flex-wrap items-center gap-2">
              {parts.map((part, index) => {
                const partAnswered = part.entries.filter(
                  (entry) => (answers[entry.id] ?? "").trim() !== ""
                ).length;

                return (
                  <button
                    key={part.unitId}
                    type="button"
                    onClick={() => goToPart(index)}
                    className={
                      index === activePart
                        ? "rounded-md border border-primary bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                        : "rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary"
                    }
                  >
                    Phần {part.order} ({partAnswered}/{part.entries.length})
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 overflow-x-auto">
              <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Phần {parts[activePart]?.order ?? 1}
              </span>
              {(parts[activePart]?.entries ?? []).map((entry) => {
                const isAnswered = (answers[entry.id] ?? "").trim() !== "";
                const isFlagged = flagged.has(entry.id);

                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => scrollToQuestion(entry.anchorId)}
                    title={isFlagged ? "Flagged" : undefined}
                    className={[
                      "relative h-8 min-w-8 rounded-md border px-2 text-xs font-semibold transition",
                      isAnswered
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:border-primary",
                      isFlagged ? "ring-2 ring-amber-400/70" : ""
                    ].join(" ")}
                  >
                    {entry.order}
                  </button>
                );
              })}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="mr-1 flex flex-col items-end text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  Đã trả lời {answeredCount}/{totalQuestions}
                </span>
                <span aria-live="polite">
                  {saveState === "saving"
                    ? "Đang lưu…"
                    : saveState === "saved"
                      ? "Đã lưu tất cả"
                      : saveState === "error"
                        ? "Lưu lỗi — đang thử lại"
                        : ""}
                </span>
              </div>

              <button
                type="button"
                onClick={() => goToPart(activePart - 1)}
                disabled={activePart === 0}
                aria-label="Phần trước"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              >
                ‹
              </button>
              <span className="text-xs font-medium tabular-nums">
                {activePart + 1}/{Math.max(parts.length, 1)}
              </span>
              <button
                type="button"
                onClick={() => goToPart(activePart + 1)}
                disabled={activePart >= parts.length - 1}
                aria-label="Phần sau"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              >
                ›
              </button>

              <button
                type="submit"
                onClick={(event) => {
                  if (!window.confirm("Nộp bài? Bạn sẽ không thể chỉnh sửa sau khi nộp.")) {
                    event.preventDefault();
                  }
                }}
                className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
              >
                Nộp bài
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );

  if (!mounted) {
    return null;
  }

  return createPortal(content, document.body);
}
