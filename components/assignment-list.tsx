import Link from "next/link";
import type { ReactNode } from "react";
import { AssignmentEditDataProvider } from "@/components/assignment-edit-data";
import { AssignmentEditForm, type AssignmentItem } from "@/components/assignment-edit-form";
import type { StudentPickerClass, StudentPickerStudent } from "@/components/student-picker";
import type { UnitPickerMaterial } from "@/components/unit-picker";

export type { AssignmentItem };

type AssignmentListProps = {
  assignments: AssignmentItem[];
  materials: UnitPickerMaterial[];
  students: StudentPickerStudent[];
  classOptions: StudentPickerClass[];
  // Nút "+ Tạo bài giao" đặt ngay ở header thẻ danh sách.
  headerAction?: ReactNode;
};

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m9 6 6 6-6 6" />
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

// Khoá gộp nhóm: ngày giao theo giờ Việt Nam (yyyy-mm-dd).
function dayKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(value);
}

function formatDayLabel(value: Date, todayKey: string, yesterdayKey: string) {
  const key = dayKey(value);
  const label = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(value);

  if (key === todayKey) {
    return `Hôm nay · ${label}`;
  }

  if (key === yesterdayKey) {
    return `Hôm qua · ${label}`;
  }

  return label;
}

// Gom bài giao theo ngày, giữ nguyên thứ tự mới nhất trước.
function groupByDay(assignments: AssignmentItem[]) {
  const groups: { key: string; label: string; items: AssignmentItem[] }[] = [];
  const now = new Date();
  const todayKey = dayKey(now);
  const yesterdayKey = dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));

  assignments.forEach((assignment) => {
    const key = dayKey(assignment.createdAt);
    const last = groups[groups.length - 1];

    if (last && last.key === key) {
      last.items.push(assignment);
      return;
    }

    groups.push({
      key,
      label: formatDayLabel(assignment.createdAt, todayKey, yesterdayKey),
      items: [assignment]
    });
  });

  return groups;
}

function AssignmentCard({ assignment }: { assignment: AssignmentItem }) {
  const fullySubmitted =
    assignment.recipientCount > 0 && assignment.submittedCount >= assignment.recipientCount;

  return (
    <article className="px-5 py-4">
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
          <Link
            href={`/teacher/assignments/${assignment.id}/stats`}
            className="inline-flex items-center rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-primary transition hover:border-primary"
          >
            Thống kê
          </Link>
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

      <AssignmentEditForm assignment={assignment} />
    </article>
  );
}

export function AssignmentList({
  assignments,
  materials,
  students,
  classOptions,
  headerAction
}: AssignmentListProps) {
  const groups = groupByDay(assignments);

  return (
    <AssignmentEditDataProvider
      materials={materials}
      students={students}
      classOptions={classOptions}
    >
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold">Bài đã giao</h3>
          <div className="flex flex-wrap items-center gap-3">
            {assignments.length > 0 ? (
              <span className="text-xs text-muted-foreground">
                {assignments.length} bài · {groups.length} ngày
              </span>
            ) : null}
            {headerAction}
          </div>
        </div>
        {groups.length > 0 ? (
          <div className="divide-y divide-border">
            {groups.map((group, groupIndex) => (
              // Chỉ mở sẵn nhóm ngày mới nhất, các ngày cũ gập lại cho đỡ cuộn.
              <details key={group.key} open={groupIndex === 0} className="group">
                <summary className="flex cursor-pointer items-center justify-between gap-2 bg-muted/40 px-5 py-2.5 text-sm font-semibold hover:bg-muted">
                  <span className="flex items-center gap-2">
                    <ChevronIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                    {group.label}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {group.items.length} bài
                  </span>
                </summary>
                <div className="divide-y divide-border">
                  {group.items.map((assignment) => (
                    <AssignmentCard key={assignment.id} assignment={assignment} />
                  ))}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <p className="px-5 py-8 text-sm text-muted-foreground">
            Chưa có bài giao nào. Hãy tạo bài tập ở khung bên cạnh.
          </p>
        )}
      </div>
    </AssignmentEditDataProvider>
  );
}
