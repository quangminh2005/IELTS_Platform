"use client";

import Link from "next/link";
import { ActionForm, ActionSubmitButton } from "@/components/action-form";
import { StudentAvatar } from "@/components/student-avatar";
import { reopenBugReport, resolveBugReport } from "@/lib/actions/bug-reports";
import { BUG_TEACHER_NOTE_MAX, bugCategoryLabel } from "@/lib/bug-report";
import { formatRelativeTime } from "@/lib/notifications";

// Dữ liệu đã "phẳng hoá" ở server (page.tsx): ngữ cảnh đã format, link bài làm đã
// xác minh. Component này chỉ vẽ + gắn hai action.
export type TeacherBugReportRow = {
  id: string;
  category: string;
  description: string;
  imageUrl: string | null;
  pageUrl: string;
  device: string;
  viewport: string | null;
  contextLine: string | null;
  attemptTitle: string | null;
  attemptHref: string | null;
  status: string;
  teacherNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  student: {
    displayName: string;
    avatarUrl: string | null;
    avatarPreset: string | null;
    userImage: string | null;
    classNames: string[];
  };
};

export function BugReportTeacherRow({ report }: { report: TeacherBugReportRow }) {
  const resolved = report.status === "resolved";

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-3">
        <StudentAvatar
          avatarUrl={report.student.avatarUrl}
          avatarPreset={report.student.avatarPreset}
          userImage={report.student.userImage}
          displayName={report.student.displayName}
          size="list"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{report.student.displayName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {report.student.classNames.length ? report.student.classNames.join(", ") : "Chưa vào lớp"}
          </p>
        </div>
        <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold">
          {bugCategoryLabel(report.category)}
        </span>
        <span className="text-xs text-muted-foreground" suppressHydrationWarning>
          {formatRelativeTime(new Date(report.createdAt))}
        </span>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{report.description}</p>

      <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="shrink-0 font-semibold">Trang</dt>
          <dd className="truncate">{report.pageUrl}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 font-semibold">Thiết bị</dt>
          <dd>
            {report.device}
            {report.viewport ? ` · ${report.viewport}` : ""}
          </dd>
        </div>
        {report.contextLine ? (
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold">Vị trí</dt>
            <dd>{report.contextLine}</dd>
          </div>
        ) : null}
        {report.attemptTitle ? (
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold">Bài</dt>
            <dd>
              {report.attemptHref ? (
                <Link href={report.attemptHref} className="text-primary hover:underline">
                  {report.attemptTitle} →
                </Link>
              ) : (
                `${report.attemptTitle} (đang làm)`
              )}
            </dd>
          </div>
        ) : null}
      </dl>

      {report.imageUrl ? (
        <a href={report.imageUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={report.imageUrl}
            alt="Ảnh chụp màn hình"
            className="max-h-48 rounded-lg border border-border object-contain"
          />
        </a>
      ) : null}

      {resolved ? (
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
          <div className="text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Đã xử lý
              {report.resolvedAt ? ` · ${formatRelativeTime(new Date(report.resolvedAt))}` : ""}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{report.teacherNote?.trim() || "(không có phản hồi)"}</p>
          </div>
          <ActionForm action={reopenBugReport}>
            <input type="hidden" name="id" value={report.id} />
            <ActionSubmitButton
              pendingLabel="Đang mở…"
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:border-primary"
            >
              Mở lại
            </ActionSubmitButton>
          </ActionForm>
        </div>
      ) : (
        <ActionForm action={resolveBugReport} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="id" value={report.id} />
          <label className="flex-1 text-xs font-semibold text-muted-foreground">
            Phản hồi cho học viên (tuỳ chọn)
            <input
              name="teacherNote"
              maxLength={BUG_TEACHER_NOTE_MAX}
              placeholder="Ví dụ: Đã thay file audio, em thử lại nhé."
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-foreground focus:border-primary focus:outline-none"
            />
          </label>
          <ActionSubmitButton
            pendingLabel="Đang lưu…"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card hover:bg-primary/90"
          >
            Đã xử lý
          </ActionSubmitButton>
        </ActionForm>
      )}
    </article>
  );
}
