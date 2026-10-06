"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { deleteComment } from "@/lib/actions/feed";
import type { RecentCommentView } from "@/lib/feed-data";
import { formatRelativeTime } from "@/lib/notifications";

// Tab "Bình luận mới" ở /teacher/feed (Mạng xã hội Đợt 3): thầy đọc lướt và gỡ.
// Gỡ phải bấm 2 lần ("Gỡ" → "Chắc chắn gỡ?") thay cho hộp thoại confirm của trình duyệt.
export function TeacherCommentList({ comments }: { comments: RecentCommentView[] }) {
  const { notify } = useToast();
  const [rows, setRows] = useState(comments);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function handleRemove(id: string) {
    if (armedId !== id) {
      setArmedId(id);
      return;
    }
    setArmedId(null);
    startTransition(async () => {
      try {
        const result = await deleteComment(id);
        if (result.ok) setRows((list) => list.filter((row) => row.id !== id));
        notify(result);
      } catch {
        notify({ ok: false, message: "Không kết nối được, thử lại sau nhé." });
      }
    });
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-12 text-center text-sm text-muted-foreground shadow-card">
        Chưa có bình luận nào.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{row.authorName}</span>
              {row.authorIsTeacher ? (
                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  Giáo viên
                </span>
              ) : null}
              <span suppressHydrationWarning>· {formatRelativeTime(new Date(row.at))}</span>
            </p>
            {/* Văn bản thuần — không render HTML. */}
            <p className="mt-1 whitespace-pre-line break-words text-sm">{row.body}</p>
            <p className="mt-1.5 truncate text-xs text-muted-foreground">
              Trên hoạt động của{" "}
              <Link href={`/teacher/students/${row.owner.studentId}`} className="font-medium hover:text-primary hover:underline">
                {row.owner.displayName}
              </Link>
              : {row.eventText ?? "Hoạt động cũ (quá 14 ngày)"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleRemove(row.id)}
            onBlur={() => setArmedId((current) => (current === row.id ? null : current))}
            disabled={busy}
            className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
              armedId === row.id
                ? "border-red-300 bg-red-50 text-red-600 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {armedId === row.id ? "Chắc chắn gỡ?" : "Gỡ"}
          </button>
        </li>
      ))}
    </ul>
  );
}
