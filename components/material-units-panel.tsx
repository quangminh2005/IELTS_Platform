"use client";

import { useState } from "react";
import { ActionDeleteButton, ActionForm, ActionSubmitButton, type ServerAction } from "@/components/action-form";
import { AudioUpload } from "@/components/audio-upload";
import { ImageUpload } from "@/components/image-upload";
import { QuestionFields } from "@/components/question-fields";
import { parseUnitImages } from "@/lib/question-interactions";

export type UnitDetailQuestion = {
  id: string;
  order: number;
  questionType: string;
  points: number;
  prompt: string;
  optionsJson: string | null;
  correctAnswerJson: string | null;
  explanation: string | null;
  answerEvidence: string | null;
};

export type UnitDetail = {
  id: string;
  unitNumber: number;
  title: string;
  unitType: string;
  instructions: string | null;
  content: string;
  audioUrl: string | null;
  transcript: string | null;
  defaultTimeLimitMinutes: number | null;
  metadataJson: string | null;
  questions: UnitDetailQuestion[];
};

type MaterialUnitsPanelProps = {
  materialId: string;
  unitCount: number;
  questionCount: number;
  updateUnit: ServerAction;
  deleteUnit: ServerAction;
  updateQuestion: ServerAction;
  deleteQuestion: ServerAction;
};

const fieldClass =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:ring-2";

const secondaryButtonClass =
  "rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:border-primary";

const dangerButtonClass =
  "rounded-md border border-red-400/60 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-500/15 dark:text-red-300";

const unitTypeOptions = [
  { value: "listening_part", label: "Listening part" },
  { value: "reading_passage", label: "Reading passage" },
  { value: "writing_task", label: "Writing task" },
  { value: "speaking_part", label: "Speaking part" }
];

function formatValue(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

// Panel "Xem N phần" tải nội dung theo yêu cầu. Trang Kho tài liệu chỉ tải phần
// nhẹ (tiêu đề + số đếm); toàn bộ form sửa phần/câu hỏi (hàng trăm ô nhập) chỉ
// dựng khi giáo viên thật sự bấm mở — tránh dựng cả nghìn form ngay lúc tải trang.
export function MaterialUnitsPanel({
  materialId,
  unitCount,
  questionCount,
  updateUnit,
  deleteUnit,
  updateQuestion,
  deleteQuestion
}: MaterialUnitsPanelProps) {
  const [units, setUnits] = useState<UnitDetail[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function loadDetail() {
    if (units || status === "loading") {
      return;
    }
    setStatus("loading");
    try {
      const response = await fetch(`/api/teacher/materials/${materialId}/detail`);
      if (!response.ok) {
        throw new Error("fetch failed");
      }
      const data = (await response.json()) as { units: UnitDetail[] };
      setUnits(data.units);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <details
      onToggle={(event) => {
        if ((event.currentTarget as HTMLDetailsElement).open) {
          void loadDetail();
        }
      }}
    >
      <summary className="cursor-pointer px-5 py-3 text-sm font-semibold transition-colors hover:bg-muted/50">
        <EyeIcon className="mr-1.5 -mt-0.5 inline-block size-4 align-middle text-muted-foreground" />
        Xem {unitCount} phần · {questionCount} câu hỏi
      </summary>
      <div className="border-t border-border py-2 pl-4 pr-2 sm:pl-6">
        {status === "loading" ? (
          <p className="py-4 text-sm text-muted-foreground">Đang tải nội dung…</p>
        ) : null}
        {status === "error" ? (
          <div className="py-4 text-sm text-red-600 dark:text-red-300">
            Không tải được nội dung.{" "}
            <button type="button" onClick={() => void loadDetail()} className="font-semibold underline">
              Thử lại
            </button>
          </div>
        ) : null}
        {units ? (
          <div className="divide-y divide-border border-l-2 border-primary/25 pl-3 sm:pl-4">
            {units.map((unit) => (
              <div key={unit.id} className="py-4 pr-3">
                <div>
                  <p className="font-medium">
                    {unit.unitNumber}. {unit.title}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatValue(unit.unitType)} · {unit.questions.length} câu hỏi
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {unit.questions.slice(0, 3).map((question) => (
                    <span
                      key={question.id}
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground"
                    >
                      Q{question.order} {formatValue(question.questionType)}
                    </span>
                  ))}
                  {unit.questions.length > 3 ? (
                    <span className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
                      +{unit.questions.length - 3}
                    </span>
                  ) : null}
                </div>
                <details className="mt-3 rounded-lg border border-border bg-muted/60 p-4 transition-colors hover:border-primary/40 hover:bg-muted">
                  <summary className="cursor-pointer text-sm font-semibold">
                    <PencilIcon className="mr-1.5 -mt-0.5 inline-block size-4 align-middle text-muted-foreground" />
                    Sửa phần
                  </summary>
                  <ActionForm action={updateUnit} className="mt-4 grid gap-3">
                    <input type="hidden" name="unitId" value={unit.id} />
                    <input type="hidden" name="materialId" value={materialId} />
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_6rem]">
                      <div>
                        <label className="text-sm font-medium" htmlFor={`unit-title-${unit.id}`}>
                          Tiêu đề
                        </label>
                        <input
                          id={`unit-title-${unit.id}`}
                          name="title"
                          minLength={2}
                          required
                          defaultValue={unit.title}
                          className={fieldClass}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium" htmlFor={`unit-type-${unit.id}`}>
                          Loại phần
                        </label>
                        <select
                          id={`unit-type-${unit.id}`}
                          name="unitType"
                          required
                          defaultValue={unit.unitType}
                          className={fieldClass}
                        >
                          {unitTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium" htmlFor={`unit-number-${unit.id}`}>
                          Số thứ tự
                        </label>
                        <input
                          id={`unit-number-${unit.id}`}
                          name="unitNumber"
                          type="number"
                          min={1}
                          required
                          defaultValue={unit.unitNumber}
                          className={fieldClass}
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium" htmlFor={`unit-instructions-${unit.id}`}>
                          Hướng dẫn
                        </label>
                        <textarea
                          id={`unit-instructions-${unit.id}`}
                          name="instructions"
                          rows={3}
                          defaultValue={unit.instructions ?? ""}
                          className={fieldClass}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium" htmlFor={`unit-content-${unit.id}`}>
                          Nội dung
                        </label>
                        <textarea
                          id={`unit-content-${unit.id}`}
                          name="content"
                          rows={5}
                          defaultValue={unit.content}
                          className={fieldClass}
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_8rem]">
                      <div>
                        <label className="text-sm font-medium" htmlFor={`unit-audio-${unit.id}`}>
                          Âm thanh
                        </label>
                        <AudioUpload id={`unit-audio-${unit.id}`} defaultValue={unit.audioUrl ?? ""} />
                      </div>
                      <div>
                        <label className="text-sm font-medium" htmlFor={`unit-time-${unit.id}`}>
                          Thời gian (phút)
                        </label>
                        <input
                          id={`unit-time-${unit.id}`}
                          name="defaultTimeLimitMinutes"
                          type="number"
                          min={1}
                          defaultValue={unit.defaultTimeLimitMinutes ?? ""}
                          className={fieldClass}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium" htmlFor={`unit-image-${unit.id}`}>
                        Hình ảnh (biểu đồ/bản đồ Writing Task 1, ...)
                      </label>
                      <div className="mt-2">
                        <ImageUpload id={`unit-image-${unit.id}`} defaultValue={parseUnitImages(unit.metadataJson)} />
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium" htmlFor={`unit-transcript-${unit.id}`}>
                          Lời thoại (transcript)
                        </label>
                        <textarea
                          id={`unit-transcript-${unit.id}`}
                          name="transcript"
                          rows={3}
                          defaultValue={unit.transcript ?? ""}
                          className={fieldClass}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium" htmlFor={`unit-metadata-${unit.id}`}>
                          Metadata (JSON)
                        </label>
                        <textarea
                          id={`unit-metadata-${unit.id}`}
                          name="metadataJson"
                          rows={3}
                          defaultValue={unit.metadataJson ?? ""}
                          className={fieldClass}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ActionSubmitButton className={secondaryButtonClass}>Lưu phần</ActionSubmitButton>
                      <ActionDeleteButton
                        action={deleteUnit}
                        confirmMessage={`Xoá phần "${unit.title}" cùng toàn bộ câu hỏi? Không thể hoàn tác.`}
                        className={dangerButtonClass}
                      >
                        Xoá phần
                      </ActionDeleteButton>
                    </div>
                  </ActionForm>
                </details>
                {unit.questions.length > 0 ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
                      <ListIcon className="mr-1.5 -mt-0.5 inline-block size-4 align-middle" />
                      Danh sách câu hỏi ({unit.questions.length})
                    </summary>
                    <div className="mt-3 space-y-3">
                      {unit.questions.map((question) => (
                        <details
                          key={question.id}
                          className="rounded-md border border-border bg-background/45 p-4 transition-colors hover:border-primary/40"
                        >
                          <summary className="cursor-pointer text-sm font-semibold">
                            <PencilIcon className="mr-1.5 -mt-0.5 inline-block size-4 align-middle text-muted-foreground" />
                            Sửa câu {question.order} · {formatValue(question.questionType)}
                          </summary>
                          <QuestionFields
                            formAction={updateQuestion}
                            submitLabel="Lưu câu hỏi"
                            idPrefix={`edit-${question.id}`}
                            selectedUnitId={unit.id}
                            hiddenFields={{ questionId: question.id }}
                            defaults={{
                              questionType: question.questionType,
                              order: question.order,
                              points: question.points,
                              prompt: question.prompt,
                              optionsJson: question.optionsJson,
                              correctAnswerJson: question.correctAnswerJson,
                              explanation: question.explanation,
                              answerEvidence: question.answerEvidence
                            }}
                            deleteAction={deleteQuestion}
                            deleteConfirm={`Xoá câu ${question.order}? Không thể hoàn tác.`}
                          />
                        </details>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </details>
  );
}
