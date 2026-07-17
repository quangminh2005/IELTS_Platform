"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ProctorFlag } from "@/components/proctor-flag";

export type QueueRow = {
  id: string;
  studentName: string;
  studentEmail: string;
  assignmentId: string;
  assignmentTitle: string;
  className: string | null;
  skills: string;
  submittedAt: string | null;
  status: string;
  reviewedAt: string | null;
  isLate: boolean;
  durationLabel: string;
  durationSuspect: boolean;
  tabSwitchCount: number;
  findAttemptCount: number;
};

type ReviewQueueProps = {
  rows: QueueRow[];
};

type StatusFilter = "all" | "ungraded" | "graded" | "late";

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "ungraded", label: "Chưa chấm" },
  { value: "graded", label: "Đã chấm" },
  { value: "late", label: "Trễ hạn" }
];

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function ReviewQueue({ rows }: ReviewQueueProps) {
  const [status, setStatus] = useState<StatusFilter>("ungraded");
  const [classFilter, setClassFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [search, setSearch] = useState("");

  const classOptions = useMemo(
    () =>
      Array.from(
        new Set(rows.map((row) => row.className).filter((name): name is string => Boolean(name)))
      ).sort((a, b) => a.localeCompare(b, "vi")),
    [rows]
  );

  const assignmentOptions = useMemo(
    () =>
      Array.from(
        new Map(rows.map((row) => [row.assignmentId, row.assignmentTitle])).entries()
      ).sort((a, b) => a[1].localeCompare(b[1], "vi")),
    [rows]
  );

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (status === "ungraded" && row.status !== "submitted") {
        return false;
      }
      if (status === "graded" && row.status !== "reviewed") {
        return false;
      }
      if (status === "late" && !row.isLate) {
        return false;
      }
      if (classFilter !== "all" && row.className !== classFilter) {
        return false;
      }
      if (assignmentFilter !== "all" && row.assignmentId !== assignmentFilter) {
        return false;
      }
      if (keyword) {
        const haystack = `${row.studentName} ${row.studentEmail}`.toLowerCase();
        if (!haystack.includes(keyword)) {
          return false;
        }
      }
      return true;
    });
  }, [rows, status, classFilter, assignmentFilter, search]);

  const ungradedCount = rows.filter((row) => row.status === "submitted").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((tab) => {
          const active = status === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatus(tab.value)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50"
              }`}
            >
              {tab.label}
              {tab.value === "ungraded" && ungradedCount > 0 ? ` (${ungradedCount})` : ""}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr]">
        <select
          value={classFilter}
          onChange={(event) => setClassFilter(event.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
        >
          <option value="all">Tất cả lớp</option>
          {classOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <select
          value={assignmentFilter}
          onChange={(event) => setAssignmentFilter(event.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
        >
          <option value="all">Tất cả bài tập</option>
          {assignmentOptions.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </select>

        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm theo tên học sinh hoặc email…"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Học sinh</th>
                <th className="px-4 py-3 font-medium">Bài tập</th>
                <th className="px-4 py-3 font-medium">Kỹ năng</th>
                <th className="px-4 py-3 font-medium">Thời gian nộp</th>
                <th className="px-4 py-3 font-medium">Thời gian làm</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length > 0 ? (
                filtered.map((row) => (
                  <tr key={row.id} className="transition hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="flex items-center gap-1 font-medium">
                        {row.studentName}
                        <ProctorFlag counts={row} />
                      </p>
                      <p className="text-xs text-muted-foreground">{row.studentEmail}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{row.assignmentTitle}</p>
                      {row.className ? (
                        <p className="text-xs text-muted-foreground">{row.className}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.skills || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDateTime(row.submittedAt)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="whitespace-nowrap">⏱ {row.durationLabel}</span>
                      {row.durationSuspect ? (
                        <span
                          className="ml-1 cursor-help"
                          title="Vượt quá giới hạn giờ — học sinh có thể đã tạm dừng rồi quay lại nộp"
                        >
                          ⚠️
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {row.status === "reviewed" ? (
                          <span className="rounded-full border border-emerald-400/50 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-300">
                            Đã chấm
                          </span>
                        ) : (
                          <span className="rounded-full border border-amber-400/50 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-300">
                            Chưa chấm
                          </span>
                        )}
                        {row.isLate ? (
                          <span className="rounded-full border border-red-400/50 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-300">
                            Trễ hạn
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/teacher/review/${row.id}`}
                        className="inline-flex rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground"
                      >
                        {row.status === "reviewed" ? "Xem / sửa" : "Chấm"}
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    Không có bài nào khớp bộ lọc hiện tại.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Hiển thị {filtered.length}/{rows.length} bài đã nộp.
      </p>
    </div>
  );
}
