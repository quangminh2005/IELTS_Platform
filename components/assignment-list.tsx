import { deleteAssignment, updateAssignment } from "@/lib/actions/assignments";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

type UnitOption = {
  id: string;
  title: string;
  skill: string;
  unitType: string;
  unitNumber: number;
  defaultTimeLimitMinutes: number | null;
};

type MaterialGroup = {
  id: string;
  title: string;
  skill: string;
  units: UnitOption[];
};

type StudentOption = {
  id: string;
  displayName: string;
  email: string;
  classes: string[];
};

export type AssignmentItem = {
  id: string;
  title: string;
  instructions: string | null;
  deadline: Date | null;
  timeLimitMinutes: number | null;
  mode: string;
  unitCount: number;
  recipientCount: number;
  unitIds: string[];
  unitTitles: string[];
  studentIds: string[];
};

type AssignmentListProps = {
  assignments: AssignmentItem[];
  materials: MaterialGroup[];
  students: StudentOption[];
};

const fieldClass =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:ring-2";

const secondaryButtonClass =
  "rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:border-primary";

const dangerButtonClass =
  "rounded-md border border-red-400/60 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-500/15 dark:text-red-300";

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
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

export function AssignmentList({ assignments, materials, students }: AssignmentListProps) {
  const hasUnits = materials.some((material) => material.units.length > 0);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold">Bài đã giao gần đây</h3>
      </div>
      <div className="divide-y divide-border">
        {assignments.length > 0 ? (
          assignments.map((assignment) => {
            const deadlineParts = deadlineToParts(assignment.deadline);
            const selectedUnits = new Set(assignment.unitIds);
            const selectedStudents = new Set(assignment.studentIds);

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
                  <p className="text-sm capitalize text-muted-foreground">{assignment.mode}</p>
                </div>

                {assignment.unitTitles.length > 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {assignment.unitTitles.slice(0, 3).join(", ")}
                    {assignment.unitTitles.length > 3 ? "..." : ""}
                  </p>
                ) : null}

                <details className="mt-3 rounded-lg border border-border bg-muted/60 p-4">
                  <summary className="cursor-pointer text-sm font-semibold">Sửa bài giao</summary>
                  <form action={updateAssignment} className="mt-4 grid gap-4">
                    <input type="hidden" name="assignmentId" value={assignment.id} />

                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem]">
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
                          htmlFor={`assignment-time-${assignment.id}`}
                        >
                          Thời gian
                        </label>
                        <input
                          id={`assignment-time-${assignment.id}`}
                          name="timeLimitMinutes"
                          type="number"
                          min={1}
                          placeholder="Số phút (tuỳ chọn)"
                          defaultValue={assignment.timeLimitMinutes ?? ""}
                          className={fieldClass}
                        />
                      </div>
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
                        <input
                          id={`assignment-date-${assignment.id}`}
                          name="dueDate"
                          type="date"
                          defaultValue={deadlineParts.date}
                          className={fieldClass}
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
                      <div className="mt-2 space-y-3">
                        {hasUnits ? (
                          materials.map((material) =>
                            material.units.length > 0 ? (
                              <section
                                key={material.id}
                                className="rounded-md border border-border bg-background/40"
                              >
                                <div className="border-b border-border px-4 py-2">
                                  <p className="text-sm font-medium">{material.title}</p>
                                  <p className="mt-1 text-xs capitalize text-muted-foreground">
                                    {formatLabel(material.skill)}
                                  </p>
                                </div>
                                <div className="divide-y divide-border">
                                  {material.units.map((unit) => (
                                    <label key={unit.id} className="flex gap-3 px-4 py-2 text-sm">
                                      <input
                                        name="unitIds"
                                        value={unit.id}
                                        type="checkbox"
                                        defaultChecked={selectedUnits.has(unit.id)}
                                        className="mt-1 h-4 w-4 rounded border-border accent-primary"
                                      />
                                      <span>
                                        <span className="block font-medium">{unit.title}</span>
                                        <span className="mt-1 block text-xs capitalize text-muted-foreground">
                                          Phần {unit.unitNumber} · {formatLabel(unit.unitType)}
                                        </span>
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </section>
                            ) : null
                          )
                        ) : (
                          <p className="rounded-lg border border-border bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
                            Chưa có phần nào.
                          </p>
                        )}
                      </div>
                    </fieldset>

                    <fieldset>
                      <legend className="text-sm font-semibold">Học viên</legend>
                      <div className="mt-2 divide-y divide-border rounded-md border border-border bg-background/40">
                        {students.length > 0 ? (
                          students.map((student) => (
                            <label key={student.id} className="flex gap-3 px-4 py-2 text-sm">
                              <input
                                name="studentIds"
                                value={student.id}
                                type="checkbox"
                                defaultChecked={selectedStudents.has(student.id)}
                                className="mt-1 h-4 w-4 rounded border-border accent-primary"
                              />
                              <span>
                                <span className="block font-medium">{student.displayName}</span>
                                <span className="mt-1 block text-xs text-muted-foreground">
                                  {student.email}
                                  {student.classes.length > 0 ? ` | ${student.classes.join(", ")}` : ""}
                                </span>
                              </span>
                            </label>
                          ))
                        ) : (
                          <p className="px-4 py-3 text-sm text-muted-foreground">Chưa có học viên nào.</p>
                        )}
                      </div>
                    </fieldset>

                    <div className="flex flex-wrap gap-2">
                      <button className={secondaryButtonClass}>Lưu bài giao</button>
                      <ConfirmSubmitButton
                        formAction={deleteAssignment}
                        confirmMessage={`Xoá bài giao "${assignment.title}"? Không thể hoàn tác.`}
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
