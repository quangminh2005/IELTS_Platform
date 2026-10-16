import { describe, expect, it } from "vitest";
import {
  daysUntilExam,
  examCountdown,
  examDateInputValue,
  parseExamDateInput
} from "@/lib/exam-countdown";

// 16/10/2026 10:00 giờ VN
const NOW = new Date("2026-10-16T03:00:00Z");

describe("parseExamDateInput", () => {
  it("chuỗi rỗng -> null (xoá ngày thi)", () => {
    expect(parseExamDateInput("", NOW)).toBeNull();
    expect(parseExamDateInput("   ", NOW)).toBeNull();
  });

  it("lưu ở 0h giờ VN của ngày đã chọn", () => {
    const date = parseExamDateInput("2026-12-05", NOW);
    expect(date?.toISOString()).toBe("2026-12-04T17:00:00.000Z");
    expect(examDateInputValue(date)).toBe("2026-12-05");
  });

  it("chặn sai định dạng và ngày không có thật", () => {
    expect(() => parseExamDateInput("05/12/2026", NOW)).toThrow();
    expect(() => parseExamDateInput("2026-02-30", NOW)).toThrow();
  });

  it("chặn ngày quá xa (quá 3 năm tới hoặc quá 1 năm trước)", () => {
    expect(() => parseExamDateInput("2030-01-01", NOW)).toThrow();
    expect(() => parseExamDateInput("2025-01-01", NOW)).toThrow();
    expect(parseExamDateInput("2026-01-01", NOW)).not.toBeNull();
  });
});

describe("daysUntilExam", () => {
  it("đếm theo ngày lịch giờ VN, không theo 24h", () => {
    // 23:30 tối 16/10 VN -> thi 17/10 vẫn là "còn 1 ngày"
    const lateNight = new Date("2026-10-16T16:30:00Z");
    const exam = parseExamDateInput("2026-10-17", NOW)!;
    expect(daysUntilExam(exam, lateNight)).toBe(1);
    expect(daysUntilExam(exam, NOW)).toBe(1);
  });

  it("hôm nay = 0, đã qua = số âm", () => {
    expect(daysUntilExam(parseExamDateInput("2026-10-16", NOW)!, NOW)).toBe(0);
    expect(daysUntilExam(parseExamDateInput("2026-10-10", NOW)!, NOW)).toBe(-6);
  });
});

describe("examCountdown", () => {
  it("chưa đặt ngày thi -> null", () => {
    expect(examCountdown(null, NOW)).toBeNull();
  });

  it("còn nhiều ngày: có số tuần", () => {
    const view = examCountdown(parseExamDateInput("2026-12-05", NOW)!, NOW)!;
    expect(view.state).toBe("upcoming");
    expect(view.days).toBe(50);
    expect(view.weeksText).toBe("khoảng 7 tuần");
    expect(view.dateText).toBe("05/12/2026");
  });

  it("dưới 2 tuần thì không ghi số tuần", () => {
    const view = examCountdown(parseExamDateInput("2026-10-26", NOW)!, NOW)!;
    expect(view.weeksText).toBeNull();
    expect(view.state).toBe("soon");
  });

  it("hôm nay thi / đã thi", () => {
    expect(examCountdown(parseExamDateInput("2026-10-16", NOW)!, NOW)!.state).toBe("today");
    expect(examCountdown(parseExamDateInput("2026-10-01", NOW)!, NOW)!.state).toBe("past");
  });
});
