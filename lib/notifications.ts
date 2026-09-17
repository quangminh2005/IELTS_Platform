// Thông báo cho học viên KHÔNG có bảng riêng: danh sách được suy ra lúc đọc từ
// TeacherReview (đã chấm xong) và AssignmentRecipient (bài mới giao). Nhờ vậy
// không phải sửa đường ghi khi chấm/giao bài — không có nguy cơ "chấm xong mà
// quên báo" — và bài cũ tự có mặt, khỏi script vá dữ liệu.
//
// Tệp này KHÔNG được import prisma: chuông là client component và import
// formatRelativeTime từ đây. Phần truy vấn nằm ở lib/notifications-feed.ts.

import { bugCategoryLabel } from "@/lib/bug-report";

export const NOTIFICATION_LIMIT = 30;

export type StudentNotificationType = "review_done" | "assignment_new" | "bug_resolved";

export type StudentNotification = {
  // "review:<attemptId>" | "assignment:<recipientId>" — đủ để làm key React và để
  // nhớ mục nào vừa xem, không cần id thật trong DB.
  id: string;
  type: StudentNotificationType;
  title: string;
  detail: string | null;
  href: string;
  createdAt: Date;
  unread: boolean;
};

export type ReviewNotificationSource = {
  attemptId: string;
  title: string;
  overallBand: number | null;
  reviewedAt: Date;
};

export type AssignmentNotificationSource = {
  recipientId: string;
  title: string;
  assignedAt: Date;
};

export type BugResolvedNotificationSource = {
  id: string;
  category: string;
  teacherNote: string | null;
  resolvedAt: Date;
};

// readAt null = chưa từng có mốc. Coi như đã đọc hết thay vì chưa đọc hết, để học
// viên mới (hoặc DB chưa kịp có cột) không bị dội cả chục thông báo cũ.
function isUnread(createdAt: Date, readAt: Date | null): boolean {
  if (!readAt) {
    return false;
  }

  return createdAt.getTime() > readAt.getTime();
}

export function buildStudentNotifications(
  reviews: ReviewNotificationSource[],
  assignments: AssignmentNotificationSource[],
  readAt: Date | null,
  // Tham số thứ 4 tuỳ chọn: chỗ gọi cũ và test cũ không phải sửa.
  bugs: BugResolvedNotificationSource[] = []
): StudentNotification[] {
  const items: StudentNotification[] = [
    ...reviews.map((item) => ({
      id: `review:${item.attemptId}`,
      type: "review_done" as const,
      title: item.title,
      detail: item.overallBand === null ? null : `Band ${item.overallBand}`,
      href: `/student/results/${item.attemptId}`,
      createdAt: item.reviewedAt,
      unread: isUnread(item.reviewedAt, readAt)
    })),
    ...assignments.map((item) => ({
      id: `assignment:${item.recipientId}`,
      type: "assignment_new" as const,
      title: item.title,
      detail: null,
      href: `/student/assignments/${item.recipientId}`,
      createdAt: item.assignedAt,
      unread: isUnread(item.assignedAt, readAt)
    })),
    ...bugs.map((item) => ({
      id: `bug:${item.id}`,
      type: "bug_resolved" as const,
      title: `Đã xử lý báo lỗi: ${bugCategoryLabel(item.category)}`,
      detail: item.teacherNote?.trim() ? item.teacherNote.trim() : null,
      href: "/student/bugs",
      createdAt: item.resolvedAt,
      unread: isUnread(item.resolvedAt, readAt)
    }))
  ];

  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return items.slice(0, NOTIFICATION_LIMIT);
}

export function countUnread(items: StudentNotification[]): number {
  return items.filter((item) => item.unread).length;
}

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh"
});

export function formatRelativeTime(value: Date, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - value.getTime()) / 60_000);

  if (minutes < 1) {
    return "Vừa xong";
  }

  if (minutes < 60) {
    return `${minutes} phút trước`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} giờ trước`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days} ngày trước`;
  }

  return dateFormatter.format(value);
}
