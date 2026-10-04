import { describe, expect, it } from "vitest";
import {
  calculateDayStreak,
  dayRestoreKey,
  dayStreakRestoreOffer,
  formatDayShort,
  restoredDayOf,
  streakRestorePrice
} from "../lib/day-streak";

const today = "2026-10-04";

describe("calculateDayStreak", () => {
  it("chưa học ngày nào → 0", () => {
    expect(calculateDayStreak({ activeDays: [], restoredDays: [], today })).toEqual({
      days: 0,
      activeToday: false
    });
  });

  it("hôm nay có học → đếm cả hôm nay", () => {
    const r = calculateDayStreak({
      activeDays: ["2026-10-04", "2026-10-03", "2026-10-02", "2026-09-30"],
      restoredDays: [],
      today
    });
    expect(r).toEqual({ days: 3, activeToday: true });
  });

  it("hôm nay chưa học → không tính đứt (grace), đếm từ hôm qua", () => {
    const r = calculateDayStreak({
      activeDays: ["2026-10-03", "2026-10-02"],
      restoredDays: [],
      today
    });
    expect(r).toEqual({ days: 2, activeToday: false });
  });

  it("hôm qua không học, hôm nay chưa học → 0", () => {
    const r = calculateDayStreak({ activeDays: ["2026-10-02"], restoredDays: [], today });
    expect(r.days).toBe(0);
  });

  it("ngày đã cứu nối chuỗi và được đếm", () => {
    const r = calculateDayStreak({
      activeDays: ["2026-10-04", "2026-10-02", "2026-10-01"],
      restoredDays: ["2026-10-03"],
      today
    });
    expect(r).toEqual({ days: 4, activeToday: true });
  });

  it("chỉ có ngày cứu hôm nay không làm activeToday", () => {
    const r = calculateDayStreak({ activeDays: [], restoredDays: ["2026-10-04"], today });
    expect(r.activeToday).toBe(false);
  });

  it("bỏ trùng ngày", () => {
    const r = calculateDayStreak({
      activeDays: ["2026-10-04", "2026-10-04", "2026-10-03"],
      restoredDays: ["2026-10-03"],
      today
    });
    expect(r.days).toBe(2);
  });
});

describe("dayStreakRestoreOffer", () => {
  it("hôm qua lỡ, hôm kia có học → cứu hôm qua, giữ được chuỗi kết thúc ở hôm kia", () => {
    const offer = dayStreakRestoreOffer({
      activeDays: ["2026-10-02", "2026-10-01", "2026-09-30"],
      restoredDays: [],
      today
    });
    expect(offer).toEqual({ dayKey: "2026-10-03", lostDays: 3 });
  });

  it("hôm nay đã học lại vẫn còn cứu được hôm qua", () => {
    const offer = dayStreakRestoreOffer({
      activeDays: ["2026-10-04", "2026-10-02"],
      restoredDays: [],
      today
    });
    expect(offer).toEqual({ dayKey: "2026-10-03", lostDays: 1 });
  });

  it("hôm qua có học → không có gì để cứu", () => {
    expect(
      dayStreakRestoreOffer({ activeDays: ["2026-10-03", "2026-10-02"], restoredDays: [], today })
    ).toBeNull();
  });

  it("hôm qua đã cứu → null", () => {
    expect(
      dayStreakRestoreOffer({ activeDays: ["2026-10-02"], restoredDays: ["2026-10-03"], today })
    ).toBeNull();
  });

  it("lỡ 2 ngày liền → mất chuỗi, không cứu được", () => {
    expect(dayStreakRestoreOffer({ activeDays: ["2026-10-01"], restoredDays: [], today })).toBeNull();
  });

  it("hôm kia là ngày đã cứu cũng tính là còn chuỗi", () => {
    const offer = dayStreakRestoreOffer({
      activeDays: ["2026-10-01"],
      restoredDays: ["2026-10-02"],
      today
    });
    expect(offer).toEqual({ dayKey: "2026-10-03", lostDays: 2 });
  });
});

describe("giá + khoá sổ", () => {
  it("giá gấp đôi theo số lần trong tháng", () => {
    expect([0, 1, 2, 3].map(streakRestorePrice)).toEqual([100, 200, 400, 800]);
  });

  it("khoá ngày dùng prefix riêng, không đọc nhầm khoá tuần cũ", () => {
    expect(dayRestoreKey("2026-10-03")).toBe("restore-day:2026-10-03");
    expect(restoredDayOf("restore-day:2026-10-03")).toBe("2026-10-03");
    expect(restoredDayOf("restore:2026-09-22")).toBeNull();
    expect(restoredDayOf("buy:bg:ocean")).toBeNull();
  });

  it("formatDayShort", () => {
    expect(formatDayShort("2026-10-03")).toBe("3/10");
    expect(formatDayShort("2026-01-15")).toBe("15/1");
  });
});
