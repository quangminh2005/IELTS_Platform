import { describe, expect, it } from "vitest";
import { calculateVocabStreak } from "../lib/vocab-streak";

const today = "2026-08-11";

describe("calculateVocabStreak", () => {
  it("chưa làm ngày nào thì chuỗi bằng 0", () => {
    expect(calculateVocabStreak({ days: [], today })).toEqual({
      days: 0,
      activeToday: false
    });
  });

  it("đếm các ngày liên tiếp tính từ hôm nay", () => {
    const result = calculateVocabStreak({
      days: ["2026-08-11", "2026-08-10", "2026-08-09"],
      today
    });
    expect(result).toEqual({ days: 3, activeToday: true });
  });

  it("hôm nay chưa làm nhưng hôm qua có thì chuỗi vẫn giữ", () => {
    const result = calculateVocabStreak({
      days: ["2026-08-10", "2026-08-09"],
      today
    });
    expect(result).toEqual({ days: 2, activeToday: false });
  });

  it("nghỉ một ngày thì chuỗi đứt", () => {
    const result = calculateVocabStreak({
      days: ["2026-08-09", "2026-08-08"],
      today
    });
    expect(result).toEqual({ days: 0, activeToday: false });
  });

  it("ngày trùng nhau chỉ tính một lần", () => {
    const result = calculateVocabStreak({
      days: ["2026-08-11", "2026-08-11", "2026-08-10"],
      today
    });
    expect(result.days).toBe(2);
  });

  it("không phụ thuộc thứ tự mảng đầu vào", () => {
    const result = calculateVocabStreak({
      days: ["2026-08-09", "2026-08-11", "2026-08-10"],
      today
    });
    expect(result.days).toBe(3);
  });

  it("chuỗi bắc qua ranh giới tháng", () => {
    const result = calculateVocabStreak({
      days: ["2026-08-01", "2026-07-31", "2026-07-30"],
      today: "2026-08-01"
    });
    expect(result.days).toBe(3);
  });
});
