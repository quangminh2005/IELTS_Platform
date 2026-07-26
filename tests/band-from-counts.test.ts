import { describe, expect, it } from "vitest";
import { attemptBand, attemptBandFromCounts } from "../lib/band-score";

describe("attemptBandFromCounts", () => {
  it("bài đủ 40 câu -> quy ra band như khi đếm từng câu trả lời", () => {
    expect(attemptBandFromCounts(null, [{ skill: "reading", correct: 30, total: 40 }])).toBe(7);
    expect(attemptBandFromCounts(null, [{ skill: "listening", correct: 30, total: 40 }])).toBe(7);
  });

  it("bài lẻ (không đủ 40 câu) -> null, chỉ hiển thị %", () => {
    expect(attemptBandFromCounts(null, [{ skill: "reading", correct: 8, total: 10 }])).toBeNull();
  });

  it("ưu tiên band giáo viên chấm", () => {
    expect(attemptBandFromCounts(6.5, [{ skill: "reading", correct: 40, total: 40 }])).toBe(6.5);
  });

  it("nhiều kỹ năng -> trung bình band, làm tròn nửa band", () => {
    expect(
      attemptBandFromCounts(null, [
        { skill: "listening", correct: 30, total: 40 }, // 7.0
        { skill: "reading", correct: 27, total: 40 } // 6.5
      ])
    ).toBe(7); // (7 + 6.5) / 2 = 6.75 -> 7.0
  });

  it("cho cùng kết quả với attemptBand tính từ danh sách câu trả lời", () => {
    const answers = [
      ...Array.from({ length: 30 }, () => ({ isCorrect: true, skill: "reading" })),
      ...Array.from({ length: 10 }, () => ({ isCorrect: false, skill: "reading" })),
      // Câu Viết chờ chấm không được tính vào tổng số câu.
      { isCorrect: null, skill: "writing" }
    ];

    expect(attemptBandFromCounts(null, [{ skill: "reading", correct: 30, total: 40 }])).toBe(
      attemptBand(null, answers)
    );
  });
});
