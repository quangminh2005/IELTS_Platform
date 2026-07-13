"use client";

import Link from "next/link";
import {
  type DragEvent,
  Fragment,
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
  startSkillSession,
  submitSkill
} from "@/lib/actions/attempts";
import { HighlightLayer, type HighlightPayload } from "@/components/highlight-layer";
import { SkillPicker } from "@/components/skill-picker";
import { orderedSkillsOfAssignment, unitsForSkill } from "@/lib/skill-sessions";
import { parseSkillTimeLimits } from "@/lib/skill-parse";
import { accumulateActiveSeconds, AUTO_SUBMIT_SKILLS } from "@/lib/active-time";
import { parsePartTimes, SKILL_TIME_LABELS } from "@/lib/skill-times";
import { AudioPlayer } from "@/components/audio-player";
import { AudioRecorderAnswer } from "@/components/audio-recorder-answer";
import { AnimatedThemeToggle } from "@/components/ui/animated-theme-toggle";
import {
  parseGroupInstructions,
  parseGroupTitles,
  parseMarkdownTable,
  parseQuestionOptions,
  parseUnitImages,
  parseUnitMetaString,
  promptHasGap,
  splitPromptIntoGapSegments,
  splitPromptIntoSegments,
  usesDragDropAnswer
} from "@/lib/question-interactions";
import type { MultiSelectGroup } from "@/lib/multi-select";

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
    partTimesJson?: string | null;
  };
  assignment: {
    title: string;
    instructions: string | null;
    timeLimitMinutes: number | null;
    skillTimeLimitsJson?: string | null;
    units: AssignmentUnit[];
  };
  highlights: Highlight[];
  savedAnswers: Record<string, string>;
  multiSelectGroups: MultiSelectGroup[];
  // Hàng AttemptSkill (kỹ năng + trạng thái + mốc bắt đầu) để dựng màn chọn kỹ
  // năng và đồng hồ theo kỹ năng. Rỗng ở chế độ xem trước của giáo viên.
  attemptSkills?: Array<{
    skill: string;
    status: string;
    startedAt: string | Date | null;
    elapsedSeconds: number;
  }>;
  // Chế độ giáo viên xem trước giao diện làm bài: KHÔNG lưu nháp, KHÔNG ghi
  // highlight vào DB, nút "Nộp bài" chỉ đóng lại (không chấm điểm).
  previewMode?: boolean;
};

type AnswerChange = (questionId: string, value: string) => void;

type SaveState = "idle" | "saving" | "saved" | "error";

function usesLongAnswer(questionType: string) {
  return (
    questionType.includes("essay") ||
    questionType.includes("writing") ||
    questionType.includes("speaking")
  );
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

// Tách noteBody thành các đoạn (segment) ở cấp cao để mỗi nhóm note hiển thị
// đúng thứ tự dù bị chen bởi câu loại khác (bảng/trắc nghiệm...):
//  - ":::map ... :::"  = đoạn bản đồ (hiện ẢNH + các dòng địa điểm có ô điền chữ cái).
//  - ":::break"        = ngắt sang đoạn note mới (vd fact-sheet nằm sau một bảng).
//  - :::flow / :::branch vẫn nằm TRONG đoạn plain và do NoteCompletionQuestionSet tự vẽ.
type NoteSegment = { kind: "plain" | "map"; text: string };
function splitNoteSegments(content: string): NoteSegment[] {
  const segments: NoteSegment[] = [];
  let inMap = false;
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (trimmed === ":::map") {
      inMap = true;
      segments.push({ kind: "map", text: "" });
      return;
    }
    if (trimmed === ":::" && inMap) {
      inMap = false;
      return;
    }
    if (trimmed === ":::break" && !inMap) {
      segments.push({ kind: "plain", text: "" });
      return;
    }
    if (inMap) {
      const seg = segments[segments.length - 1];
      seg.text += seg.text ? `\n${line}` : line;
      return;
    }
    const last = segments[segments.length - 1];
    if (last && last.kind === "plain") {
      last.text += `\n${line}`;
    } else {
      segments.push({ kind: "plain", text: line });
    }
  });
  return segments.filter((seg) => seg.text.trim() !== "");
}

function placeholderOrdersIn(text: string): Set<number> {
  const orders = new Set<number>();
  const pattern = /\[\[(\d+)\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    orders.add(Number(match[1]));
  }
  return orders;
}

function NoteCompletionQuestionSet({
  content,
  questions,
  savedAnswers,
  onAnswerChange,
  images = []
}: {
  content: string;
  questions: Question[];
  savedAnswers: Record<string, string>;
  onAnswerChange: AnswerChange;
  images?: string[];
}) {
  const questionsByOrder = new Map(questions.map((question) => [question.order, question]));

  // "Ô ghép": một câu hỏi mà đề in thành nhiều chỗ trống ("both ___ and ___").
  // Đếm số lần mỗi order xuất hiện trong nội dung — >1 nghĩa là ô ghép.
  const partCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    const pattern = /\[\[(\d+)\]\]/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const order = Number(match[1]);
      counts[order] = (counts[order] ?? 0) + 1;
    }
    return counts;
  }, [content]);

  // Đáp án ô ghép = các phần nối bằng " and " (khớp chữ "and" giữa các ô, giống
  // đề). Chỉ tính đúng khi TẤT CẢ các phần đúng (server so khớp cả cụm). Nếu mọi
  // phần đều trống thì coi như chưa trả lời.
  const splitParts = (value: string, count: number) => {
    const raw = value ? value.split(" and ") : [];
    return Array.from({ length: count }, (_, index) => raw[index] ?? "");
  };
  const combineParts = (parts: string[]) =>
    parts.every((part) => !part.trim()) ? "" : parts.join(" and ");

  const [compositeParts, setCompositeParts] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    questions.forEach((question) => {
      const count = partCounts[question.order] ?? 1;
      if (count > 1) {
        initial[question.id] = splitParts(savedAnswers[question.id] ?? "", count);
      }
    });
    return initial;
  });

  // Đếm lần xuất hiện của mỗi order trong MỘT lượt render để biết đây là phần thứ mấy.
  const seen: Record<number, number> = {};
  const blankClass =
    "mx-1 inline-flex h-8 w-28 items-center rounded-md border border-primary/60 bg-background px-2 text-center align-middle text-sm font-semibold outline-none ring-primary/40 focus:ring-2";

  // Ô trống inline (dùng chung cho từng dòng ghi chú).
  const renderBlank = (order: string, key: string) => {
    const question = questionsByOrder.get(Number(order));
    if (!question) {
      return <span key={key}>[[{order}]]</span>;
    }
    const count = partCounts[Number(order)] ?? 1;
    const partIndex = seen[Number(order)] ?? 0;
    seen[Number(order)] = partIndex + 1;

    // Ô đơn (một chỗ trống cho một câu) — như cũ.
    if (count <= 1) {
      return (
        <input
          key={key}
          name={`q_${question.id}`}
          placeholder={order}
          defaultValue={savedAnswers[question.id] ?? ""}
          onChange={(event) => onAnswerChange(question.id, event.target.value)}
          autoComplete="off"
          className={blankClass}
        />
      );
    }

    // Ô ghép: nhiều ô cho cùng một câu. Ô ẩn q_<id> mang cả cụm để nộp/chấm.
    const parts = compositeParts[question.id] ?? Array.from({ length: count }, () => "");
    const handleChange = (value: string) => {
      const next = [...(compositeParts[question.id] ?? Array.from({ length: count }, () => ""))];
      next[partIndex] = value;
      setCompositeParts((previous) => ({ ...previous, [question.id]: next }));
      onAnswerChange(question.id, combineParts(next));
    };
    return (
      <span key={key} className="inline-flex align-middle">
        {partIndex === 0 ? (
          <input type="hidden" name={`q_${question.id}`} value={combineParts(parts)} readOnly />
        ) : null}
        <input
          value={parts[partIndex] ?? ""}
          placeholder={partIndex === 0 ? order : ""}
          onChange={(event) => handleChange(event.target.value)}
          autoComplete="off"
          className={blankClass}
        />
      </span>
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

  // Một dòng văn bản thường: "# " = tiêu đề canh giữa; "## " = tiểu mục in đậm;
  // dòng trống = khoảng cách; còn lại là dòng có ô trống inline.
  const renderPlainLine = (line: string, key: string) => {
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
  };

  // Flow-chart dọc (Part 3 kiểu "Foundation for Essay Writing"): mỗi dòng là một
  // khung, có mũi tên ↓ nối giữa các khung. Ô trống nằm inline trong khung.
  const renderFlowBlock = (blockLines: string[], key: string) => {
    const boxes = blockLines.filter((line) => line.trim() !== "");
    return (
      <div key={key} className="mx-auto flex max-w-xl flex-col items-center py-1">
        {boxes.map((line, index) => (
          <Fragment key={`${key}-b-${index}`}>
            <div className="w-full rounded-md border-2 border-primary/50 bg-background px-4 py-3 text-center leading-7">
              {renderLineContent(line, `${key}-box-${index}`)}
            </div>
            {index < boxes.length - 1 ? (
              <div className="my-1 text-2xl leading-none text-primary/70">↓</div>
            ) : null}
          </Fragment>
        ))}
      </div>
    );
  };

  // Sơ đồ nhánh (Part 4): mỗi nhóm "= Nhãn" là một khung bên trái, mũi tên → sang
  // danh sách gạch đầu dòng bên phải (có ô trống inline).
  const renderBranchBlock = (blockLines: string[], key: string) => {
    const groups: { label: string; items: string[] }[] = [];
    blockLines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed === "") {
        return;
      }
      if (trimmed.startsWith("= ")) {
        groups.push({ label: trimmed.slice(2), items: [] });
      } else if (groups.length > 0) {
        groups[groups.length - 1].items.push(line);
      } else {
        groups.push({ label: "", items: [line] });
      }
    });
    return (
      <div key={key} className="space-y-3 py-1">
        {groups.map((group, gi) => (
          <div key={`${key}-g-${gi}`} className="flex items-stretch gap-2">
            <div className="flex w-32 shrink-0 items-center justify-center rounded-md border-2 border-primary/50 bg-background px-2 py-2 text-center text-sm font-semibold">
              {group.label}
            </div>
            <div className="flex shrink-0 items-center text-2xl text-primary/70">→</div>
            <ul className="flex-1 space-y-1">
              {group.items.map((item, ii) => (
                <li key={`${key}-g-${gi}-i-${ii}`} className="flex gap-2 leading-7">
                  <span className="text-primary/70">•</span>
                  <span className="flex-1">{renderLineContent(item, `${key}-item-${gi}-${ii}`)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  };

  // Tách nội dung thành các khối: văn bản thường, flow-chart (:::flow ... :::),
  // sơ đồ nhánh (:::branch ... :::).
  type NoteBlock = { kind: "plain" | "flow" | "branch"; lines: string[] };
  const blocks: NoteBlock[] = [];
  let openFence: "flow" | "branch" | null = null;
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (trimmed === ":::flow" || trimmed === ":::branch") {
      openFence = trimmed === ":::flow" ? "flow" : "branch";
      blocks.push({ kind: openFence, lines: [] });
      return;
    }
    if (trimmed === ":::") {
      openFence = null;
      return;
    }
    if (openFence) {
      blocks[blocks.length - 1].lines.push(line);
      return;
    }
    const last = blocks[blocks.length - 1];
    if (last && last.kind === "plain") {
      last.lines.push(line);
    } else {
      blocks.push({ kind: "plain", lines: [line] });
    }
  });

  return (
    <div className="overflow-hidden rounded-lg border border-primary/20 bg-primary/5">
      {images.length > 0 ? (
        <div className="space-y-3 border-b border-primary/20 bg-white p-3">
          {images.map((src, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${src}-${index}`}
              src={src}
              alt={`Sơ đồ ${index + 1}`}
              className="mx-auto w-full max-w-2xl rounded-md border border-border"
            />
          ))}
        </div>
      ) : null}
      <div className="space-y-2 px-5 py-4 text-sm leading-8">
        {blocks.map((block, blockIndex) => {
          const key = `block-${blockIndex}`;
          if (block.kind === "flow") {
            return renderFlowBlock(block.lines, key);
          }
          if (block.kind === "branch") {
            return renderBranchBlock(block.lines, key);
          }
          return (
            <div key={key} className="space-y-2">
              {block.lines.map((line, lineIndex) =>
                renderPlainLine(line, `${key}-line-${lineIndex}`)
              )}
            </div>
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
    setActiveOption(null);
  }

  // Mỗi lựa chọn chỉ dùng một lần: đáp án đã gán cho một câu sẽ biến mất khỏi
  // hộp (giống chin.edu.vn). Xoá đáp án ở một câu thì lựa chọn quay lại hộp.
  // NGOẠI LỆ: dạng phân loại (vd "xếp nhóm vào làn sóng A/B/C") có ít lựa chọn
  // hơn số câu → một chữ cái dùng cho nhiều câu, nên KHÔNG rút khỏi hộp.
  const allowReuse = sharedOptions.length < questions.length;
  const usedOptions = new Set(
    Object.values(selections).filter((value) => value.length > 0)
  );
  const availableOptions = allowReuse
    ? sharedOptions
    : sharedOptions.filter((option) => !usedOptions.has(option));

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
          Lựa chọn (kéo vào ô trống)
        </p>
        {sharedOptions.length === 0 ? (
          <p className="text-xs text-muted-foreground">Chưa có lựa chọn.</p>
        ) : availableOptions.length > 0 ? (
          availableOptions.map((option) => (
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
          <p className="text-xs text-muted-foreground">Đã điền hết lựa chọn.</p>
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
function GroupInstructionBox({
  rangeLabel,
  text,
  title
}: {
  rangeLabel: string;
  text: string;
  title?: string;
}) {
  return (
    <div className="space-y-2">
      {text ? (
        <div className="rounded-md border border-rose-400/60 bg-rose-500/10 px-4 py-3 dark:border-rose-400/40">
          <p className="text-sm font-bold text-rose-700 dark:text-rose-300">{rangeLabel}</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-6 text-foreground">{text}</p>
        </div>
      ) : null}
      {title ? (
        <p className="text-center text-base font-bold uppercase tracking-wide text-foreground">
          {title}
        </p>
      ) : null}
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

// Dạng "Choose N letters" (vd chọn 2 đáp án): N câu liên tiếp cùng bộ lựa chọn
// được gộp thành MỘT khối checkbox. Học sinh tick tối đa N; N chữ đã chọn gán vào
// N ô ẩn q_<id> để nộp/chấm như các dạng khác. Xem lib/multi-select.ts.
function MultiSelectQuestionSet({
  questions,
  options,
  selectCount,
  savedAnswers,
  onAnswerChange,
  flagged,
  onToggleFlag
}: {
  questions: Question[];
  options: string[];
  selectCount: number;
  savedAnswers: Record<string, string>;
  onAnswerChange: AnswerChange;
  flagged: Set<string>;
  onToggleFlag: (questionId: string) => void;
}) {
  const selected = questions
    .map((question) => savedAnswers[question.id] ?? "")
    .filter((value) => value.length > 0);
  const selectedSet = new Set(selected);
  const atLimit = selected.length >= selectCount;
  const firstQuestion = questions[0];
  const isFlagged = flagged.has(firstQuestion.id);

  // Gán lại danh sách chữ đã chọn vào N ô theo thứ tự (ô thừa để trống).
  const assignSlots = (letters: string[]) => {
    questions.forEach((question, index) => {
      const next = letters[index] ?? "";
      if ((savedAnswers[question.id] ?? "") !== next) {
        onAnswerChange(question.id, next);
      }
    });
  };

  const toggle = (option: string) => {
    if (selectedSet.has(option)) {
      assignSlots(selected.filter((value) => value !== option));
    } else if (!atLimit) {
      assignSlots([...selected, option]);
    }
  };

  return (
    <div
      id={`question-${firstQuestion.id}`}
      className="scroll-mt-24 rounded-md border border-border bg-background/40 p-4"
    >
      {/* Neo cuộn cho từng số câu để thanh điều hướng (vd 17, 18) đều nhảy tới khối. */}
      {questions.slice(1).map((question) => (
        <span key={question.id} id={`question-${question.id}`} className="sr-only" />
      ))}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Chọn {selectCount} đáp án{" "}
          <span className={selected.length === selectCount ? "text-primary" : ""}>
            ({selected.length}/{selectCount})
          </span>
        </p>
        <button
          type="button"
          onClick={() => onToggleFlag(firstQuestion.id)}
          aria-pressed={isFlagged}
          className={
            isFlagged
              ? "rounded-md border border-amber-400/70 bg-amber-400/15 px-2 py-1 text-xs font-medium text-amber-600 dark:text-amber-300"
              : "rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:border-primary"
          }
        >
          {isFlagged ? "★ Đã đánh dấu" : "☆ Đánh dấu"}
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {options.map((option) => {
          const checked = selectedSet.has(option);
          const disabled = !checked && atLimit;

          return (
            <label
              key={option}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
                checked
                  ? "border-primary bg-primary/5"
                  : disabled
                    ? "border-border opacity-50"
                    : "border-border hover:border-primary/50"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => toggle(option)}
                className="h-4 w-4 accent-primary"
              />
              <span>{option}</span>
            </label>
          );
        })}
      </div>
      {/* Ô ẩn để nộp bài: mỗi câu một chữ đã chọn (hoặc rỗng). */}
      {questions.map((question) => (
        <input
          key={question.id}
          type="hidden"
          name={`q_${question.id}`}
          value={savedAnswers[question.id] ?? ""}
        />
      ))}
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

// Dạng "Choose the correct letter, A/B/C(/D)" với lựa chọn là câu đầy đủ: nhiều
// câu liên tiếp xếp lưới 2 cột, mỗi câu một thẻ gọn — đỡ phải cuộn nhiều
// (giống chin.edu.vn hiển thị 17|18, 19|20 cạnh nhau).
function ChoiceGridQuestionSet({
  questions,
  savedAnswers,
  onAnswerChange,
  flagged,
  onToggleFlag
}: {
  questions: Question[];
  savedAnswers: Record<string, string>;
  onAnswerChange: AnswerChange;
  flagged: Set<string>;
  onToggleFlag: (questionId: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {questions.map((question) => {
        const options = parseQuestionOptions(question.optionsJson);
        const value = savedAnswers[question.id] ?? "";
        const isFlagged = flagged.has(question.id);

        return (
          <div
            key={question.id}
            id={`question-${question.id}`}
            className="flex scroll-mt-24 flex-col rounded-md border border-border bg-background/40 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-6">
                <span className="font-semibold text-muted-foreground">{question.order}.</span>{" "}
                {question.prompt}
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
            <div className="mt-2 space-y-1">
              {options.map((option) => (
                <label
                  key={option}
                  className={`flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-1.5 text-sm transition ${
                    value === option
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:border-primary/40 hover:bg-primary/5"
                  }`}
                >
                  <input
                    type="radio"
                    name={`q_${question.id}`}
                    value={option}
                    checked={value === option}
                    onChange={() => onAnswerChange(question.id, option)}
                    className="mt-0.5 h-4 w-4 accent-primary"
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

function CountdownTimer({ remainingSeconds }: { remainingSeconds: number }) {
  const totalSeconds = Math.max(0, Math.floor(remainingSeconds));
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
  savedAnswers,
  multiSelectGroups,
  attemptSkills = [],
  previewMode = false
}: AttemptWorkspaceProps) {
  const elapsedRef = useRef<HTMLInputElement>(null);
  const submitReasonRef = useRef<HTMLInputElement>(null);
  const partTimesInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // Bộ đếm "thời gian làm thực" (giây) của kỹ năng đang mở + cờ chống tự-nộp trùng.
  const consumedRef = useRef(0);
  const autoSubmittedRef = useRef(false);
  const timeLimitMinutes = assignment.timeLimitMinutes;

  // Danh sách kỹ năng của bài (theo thứ tự IELTS) + giới hạn phút mỗi kỹ năng.
  const skillOrder = useMemo(
    () => orderedSkillsOfAssignment(assignment.units),
    [assignment.units]
  );
  const isMultiSkill = skillOrder.length > 1;
  const skillLimits = useMemo(
    () => parseSkillTimeLimits(assignment.skillTimeLimitsJson ?? null),
    [assignment.skillTimeLimitsJson]
  );

  // Kỹ năng đang mở phiên; null = đang ở màn chọn kỹ năng. Bài 1 kỹ năng (và mọi
  // bài khi xem trước KHÔNG multi-skill) tự mở luôn để giữ hành vi cũ; bài nhiều
  // kỹ năng bắt đầu ở màn chọn (trừ xem trước — xem trước hiện tất cả phần).
  const [activeSkill, setActiveSkill] = useState<string | null>(() =>
    !isMultiSkill && !previewMode ? skillOrder[0] ?? null : null
  );

  // Các phần đang hiển thị = phần của kỹ năng đang mở. Xem trước: hiện TẤT CẢ phần
  // (như trước đây) để giáo viên xem toàn bộ đề trong một phiên.
  const activeUnits = useMemo(() => {
    if (previewMode) {
      return assignment.units;
    }
    if (!activeSkill) {
      return [];
    }
    return unitsForSkill(assignment.units, activeSkill);
  }, [previewMode, activeSkill, assignment.units]);

  // Bấm giờ theo phần: mỗi phần gắn với một assignableUnitId. `committedPartTimesRef`
  // giữ số giây đã chốt cho từng phần (khởi tạo từ dữ liệu đã lưu để resume không
  // mất giờ); `activeUnitIdRef`/`activePartSinceRef` theo dõi phần đang mở để cộng
  // thêm phần thời gian đang trôi khi cần chụp nhanh (snapshot).
  const partUnitIds = useMemo(
    () => activeUnits.map((assignmentUnit) => assignmentUnit.assignableUnit.id),
    [activeUnits]
  );
  const committedPartTimesRef = useRef<Record<string, number>>(
    parsePartTimes(attempt.partTimesJson)
  );
  const activeUnitIdRef = useRef<string | null>(null);
  const activePartSinceRef = useRef<number>(Date.now());

  // Chụp nhanh thời gian theo phần tại thời điểm hiện tại: giờ đã chốt + phần đang
  // trôi của phần đang mở. Không làm thay đổi dữ liệu đã chốt (tránh cộng trùng).
  const snapshotPartTimes = useCallback((): Record<string, number> => {
    const snapshot = { ...committedPartTimesRef.current };
    const unitId = activeUnitIdRef.current;
    if (unitId) {
      const delta = Math.max(0, Math.floor((Date.now() - activePartSinceRef.current) / 1000));
      snapshot[unitId] = (snapshot[unitId] ?? 0) + delta;
    }
    return snapshot;
  }, []);

  // Tra cứu nhóm "Choose N": theo câu MỞ ĐẦU nhóm, và tập id mọi thành viên nhóm.
  const multiSelectByFirstId = useMemo(() => {
    const map = new Map<string, MultiSelectGroup>();
    multiSelectGroups.forEach((group) => map.set(group.questionIds[0], group));
    return map;
  }, [multiSelectGroups]);
  const multiSelectMemberIds = useMemo(() => {
    const set = new Set<string>();
    multiSelectGroups.forEach((group) => group.questionIds.forEach((id) => set.add(id)));
    return set;
  }, [multiSelectGroups]);

  const [answers, setAnswers] = useState<Record<string, string>>(savedAnswers);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [activePart, setActivePart] = useState(0);
  // Số giây còn lại của kỹ năng đang mở (null = không giới hạn / chưa mở kỹ năng).
  const [remaining, setRemaining] = useState<number | null>(null);
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

  // Giới hạn = phút cấu hình cho kỹ năng đó; bài 1 kỹ năng không có cấu hình riêng
  // thì dùng thời gian chung của bài (giữ hành vi cũ). null = không giới hạn.
  const activeSkillRow = attemptSkills.find((row) => row.skill === activeSkill);
  const activeSkillLimit = activeSkill
    ? skillLimits[activeSkill] ?? (isMultiSkill ? null : timeLimitMinutes)
    : timeLimitMinutes;

  // Tự động nộp kỹ năng khi hết giờ: chỉ Listening/Reading/Writing, không xem trước,
  // và chỉ một lần. Gọi requestSubmit() nên KHÔNG đi qua hộp thoại xác nhận của nút Nộp.
  const maybeAutoSubmit = useCallback(() => {
    if (autoSubmittedRef.current || previewMode) return;
    if (!activeSkill || !AUTO_SUBMIT_SKILLS.has(activeSkill)) return;
    autoSubmittedRef.current = true;
    if (submitReasonRef.current) {
      submitReasonRef.current.value = "auto_timeout";
    }
    formRef.current?.requestSubmit();
  }, [activeSkill, previewMode]);

  // Mở một kỹ năng từ màn chọn: đánh dấu "đang làm" trên server (bỏ qua khi xem
  // trước) rồi vào phiên.
  async function openSkill(skill: string) {
    if (!previewMode) {
      const formData = new FormData();
      formData.set("attemptId", attempt.id);
      formData.set("skill", skill);
      await startSkillSession(formData);
    }
    setActiveSkill(skill);
  }

  const persistDraft = useCallback(async () => {
    if (previewMode || !activeSkill) {
      return;
    }
    setSaveState("saving");

    try {
      const formData = new FormData();
      formData.set("attemptId", attempt.id);
      formData.set("skill", activeSkill);
      formData.set("elapsedSeconds", String(Math.floor(consumedRef.current)));
      Object.entries(answers).forEach(([questionId, value]) => {
        formData.set(`q_${questionId}`, value);
      });
      formData.set("partTimesJson", JSON.stringify(snapshotPartTimes()));

      await saveAttemptDraft(formData);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [answers, attempt.id, snapshotPartTimes, activeSkill, previewMode]);

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
    // Xem trước: không lưu nháp lên server.
    if (previewMode) {
      return;
    }

    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void persistDraft();
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [persistDraft, previewMode]);

  // Heartbeat: định kỳ lưu tiến độ (đáp án + thời gian làm thực) kể cả khi học sinh
  // chỉ ngồi đọc không gõ, để mất mạng/đóng tab thì mở lại tiếp tục đúng chỗ.
  useEffect(() => {
    if (previewMode || !activeSkill) {
      return;
    }
    const intervalId = window.setInterval(() => {
      void persistDraft();
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, [previewMode, activeSkill, persistDraft]);

  // Khi học sinh chuyển sang phần khác: chốt thời gian đang trôi vào phần vừa rời,
  // rồi bắt đầu đếm cho phần mới. Lần chạy đầu (mount) chỉ đặt phần đang mở.
  useEffect(() => {
    const now = Date.now();
    const previousUnitId = activeUnitIdRef.current;
    if (previousUnitId) {
      const delta = Math.max(0, Math.floor((now - activePartSinceRef.current) / 1000));
      committedPartTimesRef.current[previousUnitId] =
        (committedPartTimesRef.current[previousUnitId] ?? 0) + delta;
    }
    activeUnitIdRef.current = partUnitIds[activePart] ?? null;
    activePartSinceRef.current = now;
  }, [activePart, partUnitIds]);

  // Đổi kỹ năng thì quay về phần đầu tiên của kỹ năng mới (tránh activePart trỏ
  // ra ngoài danh sách phần của kỹ năng vừa mở).
  useEffect(() => {
    setActivePart(0);
  }, [activeSkill]);

  // Đếm "thời gian làm thực" cho kỹ năng đang mở: mỗi giây cộng tối đa cap giây (bỏ
  // qua khoảng lặng do máy ngủ/tab nền/mất mạng). Cập nhật đồng hồ + trường ẩn nộp bài;
  // khi hết ngân sách thì tự nộp.
  useEffect(() => {
    if (previewMode || !activeSkill) {
      setRemaining(null);
      return;
    }

    autoSubmittedRef.current = false;
    consumedRef.current = activeSkillRow?.elapsedSeconds ?? 0;
    const budgetSeconds = activeSkillLimit != null ? activeSkillLimit * 60 : null;
    let lastTick = Date.now();

    function tick() {
      const now = Date.now();
      consumedRef.current = accumulateActiveSeconds(consumedRef.current, now - lastTick);
      lastTick = now;

      if (elapsedRef.current) {
        elapsedRef.current.value = String(Math.floor(consumedRef.current));
      }
      if (partTimesInputRef.current) {
        partTimesInputRef.current.value = JSON.stringify(snapshotPartTimes());
      }

      if (budgetSeconds == null) {
        setRemaining(null);
        return;
      }
      const rem = Math.max(0, budgetSeconds - consumedRef.current);
      setRemaining(rem);
      if (rem <= 0) {
        maybeAutoSubmit();
      }
    }

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [
    previewMode,
    activeSkill,
    activeSkillLimit,
    activeSkillRow?.elapsedSeconds,
    snapshotPartTimes,
    maybeAutoSubmit
  ]);

  // Đồng hồ đếm theo "thời gian làm thực": hết ngân sách thì tự nộp (Listening/Reading/
  // Writing) qua maybeAutoSubmit; đồng hồ tạm dừng khi mất mạng/đóng tab/máy ngủ.

  async function createHighlight(
    assignableUnitId: string,
    sourceType: string,
    payload: HighlightPayload
  ): Promise<string> {
    // Xem trước: tô màu chỉ hiển thị tại chỗ, không ghi vào DB.
    if (previewMode) {
      return `preview-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

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
    if (previewMode) {
      return;
    }

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

  const activeQuestionIds = activeUnits.flatMap((unit) =>
    unit.assignableUnit.questions.map((question) => question.id)
  );
  const totalQuestions = activeQuestionIds.length;
  // Chỉ đếm câu đã trả lời THUỘC kỹ năng đang mở (state `answers` giữ đáp án của
  // mọi kỹ năng đã đụng tới, nên không lọc sẽ vượt quá tổng số câu của kỹ năng).
  const answeredCount = activeQuestionIds.filter(
    (id) => (answers[id] ?? "").trim() !== ""
  ).length;

  // Question palette grouped by unit ("Phần").
  const parts = activeUnits.map((assignmentUnit) => {
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
      action={previewMode ? undefined : submitSkill}
      onSubmit={previewMode ? (event) => event.preventDefault() : undefined}
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
      <input type="hidden" name="skill" value={activeSkill ?? ""} />
      <input ref={elapsedRef} type="hidden" name="elapsedSeconds" defaultValue={attempt.elapsedSeconds} />
      <input
        ref={partTimesInputRef}
        type="hidden"
        name="partTimesJson"
        defaultValue={attempt.partTimesJson ?? "{}"}
      />
      <input ref={submitReasonRef} type="hidden" name="submitReason" defaultValue="manual" />
      <input type="hidden" name="recipientId" value={recipientId} />

      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {isMultiSkill && !previewMode ? (
            <button
              type="button"
              onClick={() => setActiveSkill(null)}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-primary transition hover:border-primary"
            >
              ‹ Kỹ năng
            </button>
          ) : (
            <Link
              href={previewMode ? "/teacher/materials" : "/student"}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-primary transition hover:border-primary"
            >
              {previewMode ? "‹ Kho tài liệu" : "‹ Bảng điều khiển"}
            </Link>
          )}
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-primary">
              {previewMode ? "Phòng làm bài" : "Phòng làm bài"}
              {previewMode ? (
                <span className="rounded-full border border-amber-400/60 bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300">
                  Xem trước
                </span>
              ) : null}
            </p>
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
          {activeSkillLimit != null && remaining != null ? (
            <CountdownTimer remainingSeconds={remaining} />
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
      {activeUnits.map((assignmentUnit, partIndex) => {
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
        const groupTitles = parseGroupTitles(unit.metadataJson);
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
          const title = groupTitles[startOrder];
          if (!text && !title) {
            return null;
          }
          return (
            <GroupInstructionBox
              rangeLabel={groupRangeLabel[startOrder] ?? `Câu ${startOrder}`}
              text={text ?? ""}
              title={title}
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
          | {
              kind: "multiselect";
              key: string;
              questions: Question[];
              options: string[];
              selectCount: number;
            }
          | { kind: "choicegrid"; key: string; questions: Question[] }
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

          // Nhóm "Choose N" ưu tiên trước grid/single: gộp N câu thành một khối
          // checkbox. Câu thành viên (không phải câu đầu) đã được nuốt → bỏ qua.
          if (multiSelectMemberIds.has(question.id)) {
            const group = multiSelectByFirstId.get(question.id);
            if (group) {
              const groupQuestions = group.questionIds
                .map((id) => regularQuestions.find((item) => item.id === id))
                .filter((item): item is Question => Boolean(item));
              if (groupQuestions.length === group.questionIds.length) {
                regularRenderItems.push({
                  kind: "multiselect",
                  key: `ms-${question.id}`,
                  questions: groupQuestions,
                  options,
                  selectCount: group.selectCount
                });
                i += groupQuestions.length - 1;
                continue;
              }
            } else {
              continue;
            }
          }

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

          // "Choose the correct letter" với lựa chọn là câu đầy đủ (không phải chữ
          // cái đơn): gộp các câu multiple_choice liên tiếp thành lưới 2 cột. Mỗi
          // câu giữ bộ lựa chọn riêng, nên KHÔNG yêu cầu trùng options.
          const isStandardMc =
            question.questionType === "multiple_choice" &&
            options.length >= 2 &&
            !options.every((option) => option.trim().length <= 2);
          if (isStandardMc) {
            const run = [question];
            let j = i + 1;
            while (j < regularQuestions.length) {
              const next = regularQuestions[j];
              if (multiSelectMemberIds.has(next.id)) {
                break;
              }
              // Không gộp qua ranh giới nhóm hướng dẫn khác (vd tóm tắt 33–37 và
              // trắc nghiệm 38–40): giữ khung hướng dẫn của từng nhóm.
              if (groupKeys.includes(next.order)) {
                break;
              }
              const nextOptions = parseQuestionOptions(next.optionsJson);
              const nextIsStandardMc =
                next.questionType === "multiple_choice" &&
                nextOptions.length >= 2 &&
                !nextOptions.every((option) => option.trim().length <= 2);
              if (!nextIsStandardMc) {
                break;
              }
              run.push(next);
              j += 1;
            }
            if (run.length >= 2) {
              regularRenderItems.push({
                kind: "choicegrid",
                key: `mc-${question.id}`,
                questions: run
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
          const isSpeaking = question.questionType.includes("speaking");
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
              {isSpeaking ? (
                <>
                  <p className="mt-2 text-sm leading-6">{question.prompt}</p>
                  <AudioRecorderAnswer
                    questionId={question.id}
                    initialValue={answers[question.id] ?? ""}
                    onAnswerChange={handleAnswerChange}
                  />
                </>
              ) : isDragDrop ? (
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

        // Gom tất cả khối câu hỏi (bảng / ghi chú / ghép / các câu thường) rồi
        // sắp theo SỐ THỨ TỰ câu nhỏ nhất của khối — để thứ tự hiển thị đúng như
        // đề gốc (vd ghi chú 23–26 nằm SAU trắc nghiệm 14–22, không nhảy lên trên).
        const minOrder = (qs: Question[]) =>
          qs.reduce((min, q) => Math.min(min, q.order), Number.POSITIVE_INFINITY);
        const orderedSections: { order: number; node: React.ReactNode }[] = [];

        if (tableCompletionQuestions.length > 0) {
          orderedSections.push({
            order: minOrder(tableCompletionQuestions),
            node: (
              <div
                key="table-section"
                id={`tablesection-${assignmentUnit.id}`}
                className="scroll-mt-24 space-y-3"
              >
                {groupBox(tableCompletionQuestions)}
                <TableCompletionQuestionSet
                  content={tableBodyContent}
                  questions={tableCompletionQuestions}
                  savedAnswers={answers}
                  onAnswerChange={handleAnswerChange}
                />
              </div>
            )
          });
        }
        if (noteCompletionQuestions.length > 0) {
          const noteSegments = splitNoteSegments(noteBodyContent);
          const hasMapSegment = noteSegments.some((seg) => seg.kind === "map");
          let mapImageIndex = 0;
          let plainImagesAssigned = false;
          noteSegments.forEach((seg, segIndex) => {
            const segOrders = placeholderOrdersIn(seg.text);
            const segQuestions = noteCompletionQuestions.filter((q) => segOrders.has(q.order));
            if (segQuestions.length === 0) {
              return;
            }
            // Ảnh: đoạn bản đồ lấy ảnh theo thứ tự; nếu không có bản đồ thì đoạn
            // note đầu tiên giữ ảnh (hành vi cũ cho label-the-diagram).
            let segImages: string[] = [];
            if (seg.kind === "map") {
              segImages = images[mapImageIndex] ? [images[mapImageIndex]] : [];
              mapImageIndex += 1;
            } else if (!hasMapSegment && !plainImagesAssigned) {
              segImages = images;
              plainImagesAssigned = true;
            }
            orderedSections.push({
              order: minOrder(segQuestions),
              node: (
                <div
                  key={`note-section-${segIndex}`}
                  id={segIndex === 0 ? `notesection-${assignmentUnit.id}` : undefined}
                  className="scroll-mt-24 space-y-3"
                >
                  {groupBox(segQuestions)}
                  <NoteCompletionQuestionSet
                    content={seg.text}
                    questions={segQuestions}
                    savedAnswers={answers}
                    onAnswerChange={handleAnswerChange}
                    images={segImages}
                  />
                </div>
              )
            });
          });
        }
        if (matchingQuestions.length > 0) {
          // Tách các câu "matching" thành từng nhóm riêng theo bộ lựa chọn và theo
          // ranh giới khung hướng dẫn. Nhờ vậy mỗi dạng ghép trong cùng một phần —
          // matching headings (i–x), ghép route trên bản đồ (A–F), phân loại A/B/C… —
          // có hộp lựa chọn + hướng dẫn RIÊNG, đúng như đề gốc (không dồn chung một hộp).
          const sortedMatching = [...matchingQuestions].sort((a, b) => a.order - b.order);
          const matchingRuns: Question[][] = [];
          sortedMatching.forEach((question) => {
            const current = matchingRuns[matchingRuns.length - 1];
            if (!current) {
              matchingRuns.push([question]);
              return;
            }
            const prevOptions = parseQuestionOptions(current[current.length - 1].optionsJson);
            const options = parseQuestionOptions(question.optionsJson);
            const sameOptions =
              options.length === prevOptions.length &&
              options.every((option, k) => option === prevOptions[k]);
            if (sameOptions && !groupKeys.includes(question.order)) {
              current.push(question);
            } else {
              matchingRuns.push([question]);
            }
          });
          matchingRuns.forEach((run, runIndex) => {
            orderedSections.push({
              order: minOrder(run),
              node: (
                <div key={`matching-section-${runIndex}`} className="space-y-3">
                  {groupBox(run)}
                  <MatchingQuestionSet
                    questions={run}
                    savedAnswers={answers}
                    onAnswerChange={handleAnswerChange}
                  />
                </div>
              )
            });
          });
        }
        regularRenderItems.forEach((item) => {
          const groupQuestions = item.kind === "single" ? [item.question] : item.questions;
          const box = groupBox(groupQuestions);
          orderedSections.push({
            order: minOrder(groupQuestions),
            node: (
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
                ) : item.kind === "multiselect" ? (
                  <MultiSelectQuestionSet
                    questions={item.questions}
                    options={item.options}
                    selectCount={item.selectCount}
                    savedAnswers={answers}
                    onAnswerChange={handleAnswerChange}
                    flagged={flagged}
                    onToggleFlag={toggleFlag}
                  />
                ) : item.kind === "choicegrid" ? (
                  <ChoiceGridQuestionSet
                    questions={item.questions}
                    savedAnswers={answers}
                    onAnswerChange={handleAnswerChange}
                    flagged={flagged}
                    onToggleFlag={toggleFlag}
                  />
                ) : (
                  renderSingleQuestion(item.question)
                )}
              </div>
            )
          });
        });
        orderedSections.sort((a, b) => a.order - b.order);

        const questionsContent = (
          <>
            {orderedSections.length > 0 ? (
              orderedSections.map((section) => section.node)
            ) : (
              <p className="rounded-md border border-border bg-muted/60 p-4 text-sm text-muted-foreground">
                Phần này không có câu hỏi tự động chấm.
              </p>
            )}
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
                    {/* Ảnh sơ đồ của phần điền-chỗ-trống hiển thị TRONG khối note
                        (bên phải, ngay trên các dòng nhãn) giống chin.edu.vn, nên
                        không lặp lại ở cột trái. Ảnh biểu đồ Writing/Reading khác
                        vẫn hiện bên trái như cũ. */}
                    {images.length > 0 && noteCompletionQuestions.length === 0 ? (
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
                type={previewMode ? "button" : "submit"}
                onClick={(event) => {
                  if (previewMode) {
                    if (
                      window.confirm(
                        "Đây là bản xem trước — không có bài nào được nộp hay chấm điểm. Thoát về Kho tài liệu?"
                      )
                    ) {
                      window.location.href = "/teacher/materials";
                    }
                    return;
                  }
                  if (!window.confirm("Nộp kỹ năng này? Bạn sẽ không sửa được sau khi nộp.")) {
                    event.preventDefault();
                  }
                }}
                className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
              >
                {previewMode
                  ? "Thoát xem trước"
                  : `Nộp ${activeSkill ? SKILL_TIME_LABELS[activeSkill] ?? activeSkill : ""}`}
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

  // Bài nhiều kỹ năng và chưa chọn kỹ năng: hiện màn chọn kỹ năng. Xem trước bỏ
  // qua màn này (không gọi server action, vào thẳng phiên hiển thị tất cả phần).
  if (isMultiSkill && !previewMode && activeSkill === null) {
    return createPortal(
      <SkillPicker
        title={assignment.title}
        items={skillOrder.map((skill) => {
          const units = unitsForSkill(assignment.units, skill);
          const row = attemptSkills.find((item) => item.skill === skill);
          return {
            skill,
            status: row?.status ?? "not_started",
            partCount: units.length,
            questionCount: units.reduce(
              (sum, unit) => sum + unit.assignableUnit.questions.length,
              0
            ),
            minutes: skillLimits[skill] ?? null
          };
        })}
        onOpen={openSkill}
        onViewResult={(skill) => {
          window.location.href = `/student/results/${attempt.id}?skill=${skill}`;
        }}
        onExit={() => {
          window.location.href = "/student";
        }}
      />,
      document.body
    );
  }

  return createPortal(content, document.body);
}
