import { describe, expect, it } from "vitest";
import type { ActivityDay } from "@/lib/activity-heatmap";
import { busiestDayLabel, resolveProfileMonth, summarizeMonthActivity } from "@/lib/profile-activity";

const day = (submits: number, vocabCards: number, count: number): ActivityDay => ({ submits, vocabCards, count });

describe("summarizeMonthActivity", () => {
  const days = new Map<string, ActivityDay>([
    ["2026-09-30", day(1, 0, 1)],
    ["2026-10-01", day(1, 0, 1)],
    ["2026-10-02", day(3, 20, 5)],
    ["2026-10-04", day(0, 4, 1)]
  ]);

  it("tháng hiện tại: tỉ lệ = ngày học / số ngày đã qua", () => {
    const summary = summarizeMonthActivity(days, "2026-10", "2026-10-05");
    expect(summary.activeDays).toBe(3);
    expect(summary.ratePercent).toBe(60); // 3/5
    expect(summary.attendance.days.filter((cell) => cell.active).map((cell) => cell.day)).toEqual([1, 2, 4]);
    expect(summary.busiest).toEqual({ dayKey: "2026-10-02", submits: 3, vocabCards: 20 });
  });

  it("tháng đã qua: tỉ lệ = ngày học / số ngày của tháng", () => {
    const summary = summarizeMonthActivity(days, "2026-09", "2026-10-05");
    expect(summary.activeDays).toBe(1);
    expect(summary.ratePercent).toBe(3); // 1/30
  });

  it("tháng không học ngày nào", () => {
    const summary = summarizeMonthActivity(days, "2026-08", "2026-10-05");
    expect(summary).toMatchObject({ activeDays: 0, ratePercent: 0, busiest: null });
  });
});

describe("busiestDayLabel", () => {
  it("ghi thứ, ngày và số việc", () => {
    expect(busiestDayLabel({ dayKey: "2026-10-02", submits: 3, vocabCards: 20 })).toBe(
      "Thứ 6 (02/10): 3 phần bài · 20 thẻ"
    );
    expect(busiestDayLabel({ dayKey: "2026-10-04", submits: 0, vocabCards: 4 })).toBe("Chủ nhật (04/10): 4 thẻ");
  });
});

describe("resolveProfileMonth", () => {
  it("nhận tháng hợp lệ không vượt hiện tại, còn lại về tháng hiện tại", () => {
    expect(resolveProfileMonth("2026-08", "2026-10")).toBe("2026-08");
    expect(resolveProfileMonth("2026-11", "2026-10")).toBe("2026-10");
    expect(resolveProfileMonth("abc", "2026-10")).toBe("2026-10");
    expect(resolveProfileMonth(undefined, "2026-10")).toBe("2026-10");
  });
});
