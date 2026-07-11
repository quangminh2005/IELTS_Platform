import { deleteAssignment, updateAssignment } from "@/lib/actions/assignments";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DueDateField } from "@/components/due-date-field";
import { SkillTimeInputs } from "@/components/skill-time-inputs";
import {
  StudentPicker,
  type StudentPickerClass,
  type StudentPickerStudent
} from "@/components/student-picker";
import { UnitPicker, type UnitPickerMaterial } from "@/components/unit-picker";
import { parseSkillTimeLimits } from "@/lib/skill-parse";

export type AssignmentItem = {
  id: string;
  title: string;
  instructions: string | null;
  deadline: Date | null;
  timeLimitMinutes: number | null;
  skillTimeLimitsJson: string | null;
  mode: string;
  unitCount: number;
  recipientCount: number;
  submittedCount: number;
  unitIds: string[];
  unitTitles: string[];
  studentIds: string[];
};

type AssignmentListProps = {
  assignments: AssignmentItem[];
  materials: UnitPickerMaterial[];
  students: StudentPickerStudent[];
  classOptions: StudentPickerClass[];
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

function formatDeadline(value: Date | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh"
  }).format(value);
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

export function AssignmentList({
  assignments,
  materials,
  students,
  classOptions
}: AssignmentListProps) {
  const unitSkills: Record<string, string> = {};
  materials.forEach((material) =>
    material.units.forEach((unit) => {
      unitSkills[unit.id] = unit.skill;
    })
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold">Bài đã giao gần đây</h3>
      </div>
      <div className="divide-y divide-border">
        {assignments.length > 0 ? (
          assignments.map((assignment) => {
            const deadlineParts = deadlineToParts(assignment.deadline);
            const fullySubmitted =
              assignment.recipientCount > 0 &&
              assignment.submittedCount >= assignment.recipientCount;
            const deleteConfirmMessage =
              assignment.submittedCount > 0
                ? `Xoá bài giao "${assignment.title}"?\n\nĐã có ${assignment.submittedCount} học viên nộp bài — toàn bộ bài làm và kết quả của họ sẽ bị xoá vĩnh viễn và KHÔNG thể khôi phục.\n\nBạn chắc chắn muốn xoá?`
                : `Xoá bài giao "${assignment.title}"? Không thể hoàn tác.`;

            return (
              <article key={assignment.id} className="px-5 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">{assignment.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {assignment.unitCount} phần · {assignment.recipientCount} học viên
                    </p>
                    {assignment.deadline ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Hạn nộp: {formatDeadline(assignment.deadline)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-start gap-1.5 sm:items-end">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        fullySubmitted
                          ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                          : "border-amber-400/50 bg-amber-500/10 text-amber-600 dark:text-amber-300"
                      }`}
                    >
                      Đã nộp: {assignment.submittedCount}/{assignment.recipientCount}
                    </span>
                    <span className="text-xs capitalize text-muted-foreground">{assignment.mode}</span>
                  </div>
                </div>

                {assignment.unitTitles.length > 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {assignment.unitTitles.slice(0, 3).join(", ")}
                    {assignment.unitTitles.length > 3 ? "..." : ""}
                  </p>
                ) : null}

                <details className="mt-3 rounded-lg border border-border bg-muted/60 p-4 transition-colors hover:border-primary/40 hover:bg-muted">
                  <summary className="cursor-pointer text-sm font-semibold">
                    <PencilIcon className="mr-1.5 -mt-0.5 inline-block size-4 align-middle text-muted-foreground" />
                    Sửa bài giao
                  </summary>
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
                        <label
                          className="text-sm font-medium"
                          htmlFor={`assignment-date-${assignment.id}`}
                        >
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
                        <UnitPicker
                          materials={materials}
                          selectedUnitIds={assignment.unitIds}
                          compact
                        />
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
                </details>
              </article>
            );
          })
        ) : (
          <p className="px-5 py-8 text-sm text-muted-foreground">
            Chưa có bài giao nào. Hãy tạo bài tập ở khung bên cạnh.
          </p>
        )}
      </div>
    </div>
  );
}
