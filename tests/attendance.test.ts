import { describe, expect, it } from "vitest";
import { buildAttendanceMonth, vnDateKey } from "../lib/attendance";

describe("vnDateKey", () => {
  it("bài nộp 23h30 giờ VN vẫn thuộc ngày hôm đó", () => {
    // Đây là lỗi dễ mắc nhất: 23h30 ngày 15/08 giờ VN = 16h30 ngày 15/08 UTC,
    // nhưng 23h30 ngày 15/08 UTC lại là 06h30 ngày 16/08 giờ VN. Tính nhầm theo
    // UTC là lệch cả một ô trên lịch.
    expect(vnDateKey(new Date("2026-08-15T23:30:00+07:00"))).toBe("2026-08-15");
  });

  it("bài nộp 00h30 giờ VN thuộc ngày mới, không phải ngày hôm trước", () => {
    expect(vnDateKey(new Date("2026-08-16T00:30:00+07:00"))).toBe("2026-08-16");
  });

  it("kiểu @db.Date (nửa đêm UTC) giữ nguyên ngày", () => {
    // VocabQuizDay.date là @db.Date, Prisma trả về Date ở nửa đêm UTC.
    expect(vnDateKey(new Date("2026-08-15T00:00:00Z"))).toBe("2026-08-15");
  });
});

describe("buildAttendanceMonth", () => {
  const month = new Date("2026-08-10T10:00:00+07:00"); // tháng 8/2026

  it("trả đúng số ngày của tháng", () => {
    const result = buildAttendanceMonth({ submittedAt: [], vocabDays: [], month });
    expect(result.year).toBe(2026);
    expect(result.month).toBe(8);
    expect(result.days).toHaveLength(31);
    expect(result.days[0]).toEqual({ day: 1, active: false });
  });

  it("tháng 2 năm không nhuận ra 28 ngày", () => {
    const result = buildAttendanceMonth({
      submittedAt: [],
      vocabDays: [],
      month: new Date("2026-02-10T10:00:00+07:00")
    });
    expect(result.days).toHaveLength(28);
  });

  it("tháng 2 năm nhuận ra 29 ngày", () => {
    const result = buildAttendanceMonth({
      submittedAt: [],
      vocabDays: [],
      month: new Date("2028-02-10T10:00:00+07:00")
    });
    expect(result.days).toHaveLength(29);
  });

  it("ngày có nộp bài thì sáng", () => {
    const result = buildAttendanceMonth({
      submittedAt: [new Date("2026-08-15T09:00:00+07:00")],
      vocabDays: [],
      month
    });
    expect(result.days[14]).toEqual({ day: 15, active: true });
    expect(result.days[13].active).toBe(false);
  });

  it("ngày chỉ học từ vựng cũng sáng", () => {
    const result = buildAttendanceMonth({
      submittedAt: [],
      vocabDays: [new Date("2026-08-20T00:00:00Z")],
      month
    });
    expect(result.days[19]).toEqual({ day: 20, active: true });
  });

  it("cùng ngày vừa nộp bài vừa học từ chỉ tính một ô sáng, không nổ", () => {
    const result = buildAttendanceMonth({
      submittedAt: [
        new Date("2026-08-05T09:00:00+07:00"),
        new Date("2026-08-05T21:00:00+07:00")
      ],
      vocabDays: [new Date("2026-08-05T00:00:00Z")],
      month
    });
    expect(result.days.filter((d) => d.active)).toEqual([{ day: 5, active: true }]);
  });

  it("hoạt động ở tháng khác không lọt vào tháng đang xem", () => {
    const result = buildAttendanceMonth({
      submittedAt: [new Date("2026-07-15T09:00:00+07:00")],
      vocabDays: [new Date("2026-09-15T00:00:00Z")],
      month
    });
    expect(result.days.some((d) => d.active)).toBe(false);
  });

  it("leadingBlanks tính theo tuần bắt đầu Thứ 2", () => {
    // 01/08/2026 là Thứ Bảy -> đứng ở cột thứ 6 -> 5 ô trống trước nó.
    const result = buildAttendanceMonth({ submittedAt: [], vocabDays: [], month });
    expect(result.leadingBlanks).toBe(5);
  });

  it("tháng bắt đầu đúng Thứ 2 thì không có ô trống", () => {
    // 01/06/2026 là Thứ Hai.
    const result = buildAttendanceMonth({
      submittedAt: [],
      vocabDays: [],
      month: new Date("2026-06-10T10:00:00+07:00")
    });
    expect(result.leadingBlanks).toBe(0);
  });
});
