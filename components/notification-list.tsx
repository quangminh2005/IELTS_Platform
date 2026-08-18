"use client";

import Link from "next/link";
import { formatRelativeTime, type StudentNotificationType } from "@/lib/notifications";

// Bản đi qua JSON của StudentNotification: createdAt thành chuỗi ISO.
export type NotificationFeedItem = {
  id: string;
  type: StudentNotificationType;
  title: string;
  detail: string | null;
  href: string;
  createdAt: string;
  unread: boolean;
};

const LABELS: Record<StudentNotificationType, string> = {
  review_done: "Đã chấm xong",
  assignment_new: "Bài mới"
};

export function NotificationRow({
  item,
  onNavigate
}: {
  item: NotificationFeedItem;
  onNavigate?: () => void;
}) {
  const createdAt = new Date(item.createdAt);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={
        item.unread
          ? "flex gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 transition hover:border-primary"
          : "flex gap-3 rounded-lg border border-transparent px-3 py-2.5 transition hover:border-border hover:bg-muted"
      }
    >
      <span
        aria-hidden="true"
        className={
          item.unread
            ? "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
            : "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-transparent"
        }
      />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {LABELS[item.type]}
          {item.detail ? ` · ${item.detail}` : ""}
        </span>
        <span
          className={
            item.unread
              ? "mt-0.5 block truncate text-sm font-semibold text-foreground"
              : "mt-0.5 block truncate text-sm text-foreground"
          }
        >
          {item.title}
        </span>
        {/* Giờ tương đối tính ở server rồi tính lại ở client — lệch một nhịp phút
            là chuyện bình thường, không phải lỗi hydrate cần cảnh báo. */}
        <span className="mt-0.5 block text-xs text-muted-foreground" suppressHydrationWarning>
          {formatRelativeTime(createdAt)}
        </span>
      </span>
    </Link>
  );
}

export function NotificationEmpty() {
  return (
    <p className="px-3 py-6 text-center text-sm text-muted-foreground">Chưa có thông báo nào.</p>
  );
}
