import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildStudentNotifications,
  countUnread,
  formatRelativeTime,
  NOTIFICATION_LIMIT,
} from "../lib/notifications";

describe("lược đồ thông báo", () => {
  it("StudentProfile có cột notificationsReadAt", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const model = schema.slice(
      schema.indexOf("model StudentProfile"),
      schema.indexOf("model Class")
    );
    expect(model).toContain("notificationsReadAt");
  });

  // Quên câu này là prod 500 rải rác: Prisma Client không kiểm schema lúc chạy,
  // lỗi chỉ lộ ra khi có request đụng đúng cột còn thiếu.
  it("ensure-db.mjs có câu thêm cột notificationsReadAt", () => {
    const script = readFileSync("scripts/ensure-db.mjs", "utf8");
    expect(script).toContain(
      '"StudentProfile" ADD COLUMN IF NOT EXISTS "notificationsReadAt"'
    );
  });
});

const review = (attemptId: string, iso: string, band: number | null = 6.5) => ({
  attemptId,
  title: `Bai ${attemptId}`,
  overallBand: band,
  reviewedAt: new Date(iso),
});

const assigned = (recipientId: string, iso: string) => ({
  recipientId,
  title: `Bai giao ${recipientId}`,
  assignedAt: new Date(iso),
});

describe("buildStudentNotifications", () => {
  it("gộp hai nguồn và sắp xếp mới nhất lên đầu", () => {
    const items = buildStudentNotifications(
      [review("a1", "2026-08-10T10:00:00Z")],
      [assigned("r1", "2026-08-12T10:00:00Z")],
      null
    );

    expect(items.map((item) => item.id)).toEqual(["assignment:r1", "review:a1"]);
    expect(items[0].href).toBe("/student/assignments/r1");
    expect(items[1].href).toBe("/student/results/a1");
  });

  it("thông báo chấm bài kèm band, bài mới giao thì không", () => {
    const items = buildStudentNotifications(
      [review("a1", "2026-08-10T10:00:00Z", 7)],
      [assigned("r1", "2026-08-09T10:00:00Z")],
      null
    );

    expect(items[0].detail).toBe("Band 7");
    expect(items[1].detail).toBeNull();
  });

  it("bài chấm chưa có band tổng thì không hiện chữ Band", () => {
    const items = buildStudentNotifications(
      [review("a1", "2026-08-10T10:00:00Z", null)],
      [],
      null
    );

    expect(items[0].detail).toBeNull();
  });

  it("mục mới hơn mốc đã đọc thì tính là chưa đọc", () => {
    const items = buildStudentNotifications(
      [review("moi", "2026-08-12T10:00:00Z")],
      [assigned("cu", "2026-08-01T10:00:00Z")],
      new Date("2026-08-10T00:00:00Z")
    );

    expect(items[0].unread).toBe(true);
    expect(items[1].unread).toBe(false);
    expect(countUnread(items)).toBe(1);
  });

  it("mốc null = đã đọc hết, không dội thông báo vào học viên mới", () => {
    const items = buildStudentNotifications(
      [review("a1", "2026-08-12T10:00:00Z")],
      [assigned("r1", "2026-08-12T10:00:00Z")],
      null
    );

    expect(countUnread(items)).toBe(0);
  });

  it("mục đúng bằng mốc đã đọc thì KHÔNG tính là chưa đọc", () => {
    const at = "2026-08-12T10:00:00Z";
    const items = buildStudentNotifications([review("a1", at)], [], new Date(at));

    expect(items[0].unread).toBe(false);
  });

  it("cắt còn tối đa NOTIFICATION_LIMIT mục", () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      review(`a${i}`, new Date(Date.UTC(2026, 7, 1, i)).toISOString())
    );
    const more = Array.from({ length: 25 }, (_, i) =>
      assigned(`r${i}`, new Date(Date.UTC(2026, 6, 1, i)).toISOString())
    );

    expect(buildStudentNotifications(many, more, null)).toHaveLength(NOTIFICATION_LIMIT);
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-08-18T12:00:00+07:00");

  it("dưới một phút", () => {
    expect(formatRelativeTime(new Date("2026-08-18T11:59:40+07:00"), now)).toBe("Vừa xong");
  });

  it("theo phút, giờ, ngày", () => {
    expect(formatRelativeTime(new Date("2026-08-18T11:30:00+07:00"), now)).toBe("30 phút trước");
    expect(formatRelativeTime(new Date("2026-08-18T09:00:00+07:00"), now)).toBe("3 giờ trước");
    expect(formatRelativeTime(new Date("2026-08-16T12:00:00+07:00"), now)).toBe("2 ngày trước");
  });

  it("quá một tuần thì hiện ngày tháng", () => {
    expect(formatRelativeTime(new Date("2026-08-01T12:00:00+07:00"), now)).toBe("01/08/2026");
  });
});
