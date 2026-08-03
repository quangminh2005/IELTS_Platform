"use client";

import { useState } from "react";
import { deleteAssignment, updateAssignment } from "@/lib/actions/assignments";
import { useAssignmentEditData } from "@/components/assignment-edit-data";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DueDateField } from "@/components/due-date-field";
import { SkillTimeInputs } from "@/components/skill-time-inputs";
import { StudentPicker } from "@/components/student-picker";
import { UnitPicker } from "@/components/unit-picker";
import { parseSkillTimeLimits } from "@/lib/skill-parse";

export type AssignmentItem = {
  id: string;
  createdAt: Date;
  title: string;
  instructions: string | null;
  deadline: Date | null;
  timeLimitMinutes: number | null;
  skillTimeLimitsJson: string | null;
  lockAudio: boolean;
  mode: string;
  unitCount: number;
  recipientCount: number;
  submittedCount: number;
  unitIds: string[];
  unitTitles: string[];
  studentIds: string[];
};

const fieldClass =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:ring-2";

const secondaryButtonClass =
  "rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:border-primary";

const dangerButtonClass =
  "rounded-md border border-red-400/60 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-500/15 dark:text-red-300";

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

function deadlineToParts(value: Date | null) {
  if (!value) {
    return { date: "", time: "23:59" };
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(value);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${hour}:${get("minute")}`
  };
}

// Form sửa 1 bài giao. Chỉ dựng nội dung khi giáo viên bấm mở — cây chọn đề và
// danh sách học viên rất nặng, dựng sẵn cho cả trăm bài sẽ làm trang đơ.
export function AssignmentEditForm({ assignment }: { assignment: AssignmentItem }) {
  const [opened, setOpened] = useState(false);
  const { materials, students, classOptions, unitSkills } = useAssignmentEditData();

  const deadlineParts = deadlineToParts(assignment.deadline);
  const deleteConfirmMessage =
    assignment.submittedCount > 0
      ? `Xoá bài giao "${assignment.title}"?\n\nĐã có ${assignment.submittedCount} học viên nộp bài — toàn bộ bài làm và kết quả của họ sẽ bị xoá vĩnh viễn và KHÔNG thể khôi phục.\n\nBạn chắc chắn muốn xoá?`
      : `Xoá bài giao "${assignment.title}"? Không thể hoàn tác.`;

  return (
    <details className="mt-3 rounded-lg border border-border bg-muted/60 p-4 transition-colors hover:border-primary/40 hover:bg-muted">
      <summary
        className="cursor-pointer text-sm font-semibold"
        onClick={() => setOpened(true)}
      >
        <PencilIcon className="mr-1.5 -mt-0.5 inline-block size-4 align-middle text-muted-foreground" />
        Sửa bài giao
      </summary>

      {opened ? (
        <form action={updateAssignment} className="mt-4 grid gap-4">
          <input type="hidden" name="assignmentId" value={assignment.id} />

          <div>
            <label className="text-sm font-medium" htmlFor={`assignment-title-${assignment.id}`}>
              Tiêu đề
            </label>
            <input
              id={`assignment-title-${assignment.id}`}
              name="title"
              minLength={2}
              required
              defaultValue={assignment.title}
              className={fieldClass}
            />
          </div>

          <div>
            <label
              className="text-sm font-medium"
              htmlFor={`assignment-instructions-${assignment.id}`}
            >
              Hướng dẫn
            </label>
            <textarea
              id={`assignment-instructions-${assignment.id}`}
              name="instructions"
              rows={3}
              defaultValue={assignment.instructions ?? ""}
              className={fieldClass}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium" htmlFor={`assignment-date-${assignment.id}`}>
                Ngày hết hạn
              </label>
              <DueDateField
                id={`assignment-date-${assignment.id}`}
                name="dueDate"
                defaultValue={deadlineParts.date}
              />
            </div>
            <div>
              <label
                className="text-sm font-medium"
                htmlFor={`assignment-duetime-${assignment.id}`}
              >
                Giờ hết hạn
              </label>
              <input
                id={`assignment-duetime-${assignment.id}`}
                name="dueTime"
                type="time"
                defaultValue={deadlineParts.time}
                className={fieldClass}
              />
            </div>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold">Các phần</legend>
            <div className="mt-2">
              <UnitPicker materials={materials} selectedUnitIds={assignment.unitIds} compact />
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold">Thời gian mỗi kỹ năng</legend>
            <p className="mt-1 text-xs text-muted-foreground">
              Mỗi kỹ năng là một phiên riêng, có đồng hồ riêng. Bỏ trống = không giới hạn.
            </p>
            <div className="mt-2">
              <SkillTimeInputs
                unitSkills={unitSkills}
                defaultValues={parseSkillTimeLimits(assignment.skillTimeLimitsJson)}
              />
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold">Chế độ thi thật (Listening)</legend>
            <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-background p-3">
              <input
                type="checkbox"
                name="lockAudio"
                defaultChecked={assignment.lockAudio}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              />
              <span className="text-sm leading-5">
                <span className="font-medium">Ẩn thanh audio</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Audio tự phát liên tục, học viên chỉ chỉnh được âm lượng và phải kiểm tra âm
                  thanh trước khi vào bài.
                </span>
              </span>
            </label>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold">Học viên</legend>
            <div className="mt-2">
              <StudentPicker
                students={students}
                classOptions={classOptions}
                selectedStudentIds={assignment.studentIds}
                compact
              />
            </div>
          </fieldset>

          <div className="flex flex-wrap gap-2">
            <button className={secondaryButtonClass}>Lưu bài giao</button>
            <ConfirmSubmitButton
              formAction={deleteAssignment}
              confirmMessage={deleteConfirmMessage}
              className={dangerButtonClass}
            >
              Xoá bài giao
            </ConfirmSubmitButton>
          </div>
        </form>
      ) : null}
    </details>
  );
}
