"use client";

import { useState } from "react";
import { ActionForm, ActionSubmitButton, type ServerAction } from "@/components/action-form";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { parseQuestionOptions, splitPromptIntoSegments } from "@/lib/question-interactions";

type UnitChoice = {
  id: string;
  label: string;
};

type QuestionDefaults = {
  questionType?: string;
  order?: number;
  points?: number;
  prompt?: string;
  optionsJson?: string | null;
  correctAnswerJson?: string | null;
  explanation?: string | null;
  answerEvidence?: string | null;
};

type QuestionFieldsProps = {
  formAction: ServerAction;
  submitLabel: string;
  idPrefix: string;
  units?: UnitChoice[];
  selectedUnitId?: string;
  hiddenFields?: Record<string, string>;
  defaults?: QuestionDefaults;
  deleteAction?: (formData: FormData) => void | Promise<void>;
  deleteConfirm?: string;
};

const questionTypeOptions = [
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "short_answer", label: "Short answer" },
  { value: "matching", label: "Matching" },
  { value: "drag_drop_matching", label: "Drag/drop matching" },
  { value: "gap_fill", label: "Gap fill" },
  { value: "inline_gap_fill", label: "Inline gap fill" },
  { value: "table_completion", label: "Table completion" },
  { value: "note_completion", label: "Note / summary completion" },
  { value: "true_false_not_given", label: "True / False / Not Given" }
];

type TypeMeta = {
  showOptions: boolean;
  blankIn?: "content" | "prompt";
  hint: string;
  optionsHint?: string;
  answerHint: string;
};

const typeMeta: Record<string, TypeMeta> = {
  multiple_choice: {
    showOptions: true,
    hint: "Trắc nghiệm chọn 1 đáp án.",
    optionsHint: 'Mỗi lựa chọn một phần tử, vd ["A. ...", "B. ...", "C. ..."].',
    answerHint: 'Đáp án phải trùng NGUYÊN VĂN một option, vd "B. ...".'
  },
  true_false_not_given: {
    showOptions: true,
    hint: "Chọn True / False / Not Given.",
    optionsHint: 'Thường là ["TRUE", "FALSE", "NOT GIVEN"].',
    answerHint: 'Trùng nguyên văn một option, vd "TRUE".'
  },
  matching: {
    showOptions: true,
    hint: "Nối: mỗi câu là một mục; options là kho dùng chung cho cả nhóm câu cùng dạng.",
    optionsHint: 'Danh sách đáp án dùng chung, vd ["A ...", "B ...", "C ..."]. Đặt giống nhau ở các câu trong nhóm.',
    answerHint: 'Đáp án đúng của mục này, trùng nguyên văn một option.'
  },
  drag_drop_matching: {
    showOptions: true,
    blankIn: "prompt",
    hint: "Kéo–thả một đáp án vào chỗ trống trong câu.",
    optionsHint: 'Các đáp án để kéo, vd ["increase", "decrease"].',
    answerHint: "Đáp án đúng, trùng nguyên văn một option."
  },
  inline_gap_fill: {
    showOptions: true,
    blankIn: "prompt",
    hint: "Điền/kéo vào chỗ trống [[n]] đặt ngay trong Prompt.",
    optionsHint: "Các đáp án để kéo (nếu có).",
    answerHint: "Đáp án đúng cho chỗ trống."
  },
  short_answer: {
    showOptions: false,
    hint: "Học sinh gõ câu trả lời ngắn.",
    answerHint: 'Một hoặc nhiều đáp án chấp nhận được, vd "London" hoặc ["London", "london city"].'
  },
  gap_fill: {
    showOptions: false,
    hint: "Điền từ vào chỗ trống.",
    answerHint: 'Đáp án đúng, vd "photosynthesis" hoặc mảng nhiều cách viết.'
  },
  table_completion: {
    showOptions: false,
    blankIn: "content",
    hint: "Điền ô trong bảng. Đặt [[order]] trong Content (dạng bảng markdown) của unit.",
    answerHint: "Đáp án cho ô [[order]] này."
  },
  note_completion: {
    showOptions: false,
    blankIn: "content",
    hint: "Điền ô trong đoạn ghi chú. Đặt [[order]] trong Content của unit.",
    answerHint: "Đáp án cho ô [[order]] này."
  }
};

const fieldClass =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:ring-2";

const secondaryButtonClass =
  "rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:border-primary";

const dangerButtonClass =
  "rounded-md border border-red-400/60 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-500/15 dark:text-red-300";

function safeParseAnswers(value: string): string[] {
  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);

    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item));
    }

    return [String(parsed)];
  } catch {
    return [];
  }
}

function QuestionPreview({
  type,
  prompt,
  optionsText,
  answerText
}: {
  type: string;
  prompt: string;
  optionsText: string;
  answerText: string;
}) {
  const meta = typeMeta[type];
  const options = parseQuestionOptions(optionsText || null);
  const answers = safeParseAnswers(answerText);
  const optionsLookValid = !optionsText.trim() || options.length > 0;

  const boxClass =
    "mx-1 inline-flex h-7 min-w-20 items-center justify-center rounded-md border border-primary/50 bg-primary/10 px-2 text-xs font-medium align-middle";

  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Xem trước</p>

      {!optionsLookValid ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-300">
          Options chưa đúng JSON — preview tạm ẩn.
        </p>
      ) : null}

      {meta?.blankIn === "content" ? (
        <div className="mt-2 text-sm leading-7">
          <span>{prompt || "(nhãn cho ô)"} </span>
          <span className={boxClass}>{answers[0] || "…"}</span>
          <p className="mt-1 text-xs text-muted-foreground">
            Ô này hiển thị trong Content của unit tại vị trí [[order]].
          </p>
        </div>
      ) : meta?.blankIn === "prompt" ? (
        <div className="mt-2 text-sm leading-7">
          {splitPromptIntoSegments(prompt || "").map((segment, index) =>
            segment.type === "blank" ? (
              <span key={index} className={boxClass}>
                {segment.value}
              </span>
            ) : (
              <span key={index}>{segment.value}</span>
            )
          )}
          {options.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {options.map((option) => (
                <span key={option} className="rounded-md border border-border bg-background px-2 py-1 text-xs">
                  {option}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : meta?.showOptions && options.length > 0 ? (
        <div className="mt-2 space-y-1.5">
          {prompt ? <p className="text-sm leading-6">{prompt}</p> : null}
          {options.map((option) => {
            const isAnswer = answers.some(
              (answer) => answer.trim().toLowerCase() === option.trim().toLowerCase()
            );

            return (
              <label key={option} className="flex items-center gap-2 text-sm">
                <input type="radio" disabled className="h-3.5 w-3.5 accent-primary" />
                <span className={isAnswer ? "font-semibold text-primary" : ""}>{option}</span>
                {isAnswer ? <span className="text-xs text-primary">(đáp án)</span> : null}
              </label>
            );
          })}
        </div>
      ) : (
        <div className="mt-2 text-sm leading-7">
          {prompt ? <p className="mb-2 leading-6">{prompt}</p> : null}
          <span className={boxClass}>{answers[0] || "câu trả lời"}</span>
        </div>
      )}
    </div>
  );
}

export function QuestionFields({
  formAction,
  submitLabel,
  idPrefix,
  units,
  selectedUnitId,
  hiddenFields,
  defaults,
  deleteAction,
  deleteConfirm
}: QuestionFieldsProps) {
  const [type, setType] = useState(defaults?.questionType ?? "multiple_choice");
  const [prompt, setPrompt] = useState(defaults?.prompt ?? "");
  const [optionsText, setOptionsText] = useState(defaults?.optionsJson ?? "");
  const [answerText, setAnswerText] = useState(defaults?.correctAnswerJson ?? "");

  const meta = typeMeta[type];

  return (
    <ActionForm action={formAction} className="mt-2 grid gap-3">
      {hiddenFields
        ? Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))
        : null}
      {selectedUnitId ? <input type="hidden" name="assignableUnitId" value={selectedUnitId} /> : null}

      {units ? (
        <div>
          <label className="text-sm font-medium" htmlFor={`${idPrefix}-unit`}>
            Phần
          </label>
          <select id={`${idPrefix}-unit`} name="assignableUnitId" required className={fieldClass}>
            <option value="">Chọn phần Listening hoặc Reading</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_5rem_5rem]">
        <div>
          <label className="text-sm font-medium" htmlFor={`${idPrefix}-type`}>
            Dạng câu
          </label>
          <select
            id={`${idPrefix}-type`}
            name="questionType"
            required
            value={type}
            onChange={(event) => setType(event.target.value)}
            className={fieldClass}
          >
            {questionTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor={`${idPrefix}-order`}>
            Thứ tự
          </label>
          <input
            id={`${idPrefix}-order`}
            name="order"
            type="number"
            min={1}
            required
            defaultValue={defaults?.order ?? 1}
            className={fieldClass}
          />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor={`${idPrefix}-points`}>
            Điểm
          </label>
          <input
            id={`${idPrefix}-points`}
            name="points"
            type="number"
            min={1}
            required
            defaultValue={defaults?.points ?? 1}
            className={fieldClass}
          />
        </div>
      </div>

      {meta ? (
        <p className="rounded-md border border-border bg-background/50 px-3 py-2 text-xs leading-5 text-muted-foreground">
          {meta.hint}
          {meta.blankIn === "content"
            ? " Nhớ đặt [[order]] trong Content của unit."
            : meta.blankIn === "prompt"
              ? " Đặt [[order]] trong Prompt nơi muốn có chỗ trống."
              : ""}
        </p>
      ) : null}

      <div>
        <label className="text-sm font-medium" htmlFor={`${idPrefix}-prompt`}>
          Đề bài {meta?.blankIn === "content" ? "(nhãn ngắn cho ô)" : ""}
        </label>
        <textarea
          id={`${idPrefix}-prompt`}
          name="prompt"
          rows={3}
          required
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          className={fieldClass}
        />
      </div>

      {meta?.showOptions ? (
        <div>
          <label className="text-sm font-medium" htmlFor={`${idPrefix}-options`}>
            Lựa chọn (JSON)
          </label>
          {meta.optionsHint ? (
            <p className="text-xs text-muted-foreground">{meta.optionsHint}</p>
          ) : null}
          <textarea
            id={`${idPrefix}-options`}
            name="optionsJson"
            rows={3}
            placeholder='["A", "B", "C"]'
            value={optionsText}
            onChange={(event) => setOptionsText(event.target.value)}
            className={`${fieldClass} font-mono`}
          />
        </div>
      ) : (
        <input type="hidden" name="optionsJson" value="" />
      )}

      <div>
        <label className="text-sm font-medium" htmlFor={`${idPrefix}-answer`}>
          Đáp án (JSON)
        </label>
        {meta?.answerHint ? (
          <p className="text-xs text-muted-foreground">{meta.answerHint}</p>
        ) : null}
        <textarea
          id={`${idPrefix}-answer`}
          name="correctAnswerJson"
          rows={2}
          placeholder='"A" hoặc ["a", "b"]'
          value={answerText}
          onChange={(event) => setAnswerText(event.target.value)}
          className={`${fieldClass} font-mono`}
        />
      </div>

      <div>
        <label className="text-sm font-medium" htmlFor={`${idPrefix}-explanation`}>
          Giải thích
        </label>
        <textarea
          id={`${idPrefix}-explanation`}
          name="explanation"
          rows={2}
          defaultValue={defaults?.explanation ?? ""}
          className={fieldClass}
        />
      </div>

      <div>
        <label className="text-sm font-medium" htmlFor={`${idPrefix}-answerEvidence`}>
          Dẫn chứng (đoạn chứa đáp án)
        </label>
        <textarea
          id={`${idPrefix}-answerEvidence`}
          name="answerEvidence"
          rows={2}
          defaultValue={defaults?.answerEvidence ?? ""}
          className={fieldClass}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Dán nguyên văn một câu từ transcript/bài đọc để hệ thống tô đúng chỗ.
        </p>
      </div>

      <QuestionPreview type={type} prompt={prompt} optionsText={optionsText} answerText={answerText} />

      <div className="flex flex-wrap gap-2">
        <ActionSubmitButton className={secondaryButtonClass}>{submitLabel}</ActionSubmitButton>
        {deleteAction ? (
          <ConfirmSubmitButton
            formAction={deleteAction}
            confirmMessage={deleteConfirm ?? "Xoá câu hỏi này? Không thể hoàn tác."}
            className={dangerButtonClass}
          >
            Xoá câu hỏi
          </ConfirmSubmitButton>
        ) : null}
      </div>
    </ActionForm>
  );
}
