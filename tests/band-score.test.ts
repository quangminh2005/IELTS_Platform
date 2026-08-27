import { describe, expect, it } from "vitest";
import { averageBandsBySkillAcrossAttempts, bandScore, formatBand } from "../lib/band-score";

// Dựng nhanh mảng câu trả lời cho MỘT kỹ năng: `correct` câu đúng, phần còn lại
// (tới `total`) là câu sai — đủ để bandsBySkill quy đổi band cho lần làm đó.
function answersFor(skill: string, correct: number, total: number) {
  return Array.from({ length: total }, (_, index) => ({
    isCorrect: index < correct,
    skill
  }));
}

describe("bandScore - Listening", () => {
  it("maps correct counts to the official Listening bands (out of 40)", () => {
    expect(bandScore("listening", 40, 40)).toBe(9);
    expect(bandScore("listening", 39, 40)).toBe(9);
    expect(bandScore("listening", 38, 40)).toBe(8.5);
    expect(bandScore("listening", 35, 40)).toBe(8);
    expect(bandScore("listening", 34, 40)).toBe(7.5);
    expect(bandScore("listening", 30, 40)).toBe(7);
    expect(bandScore("listening", 29, 40)).toBe(6.5);
    expect(bandScore("listening", 23, 40)).toBe(6);
    expect(bandScore("listening", 18, 40)).toBe(5.5);
    expect(bandScore("listening", 16, 40)).toBe(5);
    expect(bandScore("listening", 13, 40)).toBe(4.5);
    expect(bandScore("listening", 11, 40)).toBe(4);
  });

  it("returns null below the lowest Listening threshold", () => {
    expect(bandScore("listening", 10, 40)).toBeNull();
    expect(bandScore("listening", 0, 40)).toBeNull();
  });
});

describe("bandScore - Reading (Academic)", () => {
  it("maps correct counts to the official Reading bands (out of 40)", () => {
    expect(bandScore("reading", 40, 40)).toBe(9);
    expect(bandScore("reading", 37, 40)).toBe(8.5);
    expect(bandScore("reading", 33, 40)).toBe(7.5);
    expect(bandScore("reading", 32, 40)).toBe(7);
    expect(bandScore("reading", 27, 40)).toBe(6.5);
    expect(bandScore("reading", 23, 40)).toBe(6);
    expect(bandScore("reading", 19, 40)).toBe(5.5);
    expect(bandScore("reading", 15, 40)).toBe(5);
    expect(bandScore("reading", 13, 40)).toBe(4.5);
    expect(bandScore("reading", 10, 40)).toBe(4);
    expect(bandScore("reading", 4, 40)).toBe(2.5);
    expect(bandScore("reading", 3, 40)).toBeNull();
  });
});

describe("bandScore - scaling and edge cases", () => {
  it("does NOT scale partial tests — only full 40-question tests get a band", () => {
    // Bài lẻ (không đủ 40 câu) -> null, không tự quy đổi lên thang 40.
    expect(bandScore("reading", 8, 10)).toBeNull();
    expect(bandScore("listening", 9, 10)).toBeNull();
    expect(bandScore("listening", 7, 10)).toBeNull();
    expect(bandScore("reading", 30, 38)).toBeNull();
  });

  it("returns null for non-band skills and non-40 tests", () => {
    expect(bandScore("writing", 40, 40)).toBeNull();
    expect(bandScore("speaking", 40, 40)).toBeNull();
    expect(bandScore("listening", 5, 0)).toBeNull();
  });

  it("formats bands with one decimal, dash for null", () => {
    expect(formatBand(7.5)).toBe("7.5");
    expect(formatBand(9)).toBe("9.0");
    expect(formatBand(null)).toBe("—");
  });
});

describe("averageBandsBySkillAcrossAttempts", () => {
  it("một lần làm bài -> band của lần đó, không phải trung bình rỗng", () => {
    const result = averageBandsBySkillAcrossAttempts([answersFor("listening", 40, 40)]);

    expect(result).toEqual([{ skill: "listening", band: 9 }]);
  });

  it("nhiều lần làm CÙNG một kỹ năng -> trung bình các band từng lần, không gộp câu trả lời", () => {
    // reading 40/40 -> band 9; reading 27/40 -> band 6.5. Trung bình (9+6.5)/2=7.75
    // làm tròn nửa band gần nhất -> 8.
    const result = averageBandsBySkillAcrossAttempts([
      answersFor("reading", 40, 40),
      answersFor("reading", 27, 40)
    ]);

    expect(result).toEqual([{ skill: "reading", band: 8 }]);
  });

  it("nhiều kỹ năng khác nhau -> mỗi kỹ năng ra một dòng band riêng", () => {
    const result = averageBandsBySkillAcrossAttempts([
      answersFor("listening", 40, 40),
      answersFor("reading", 27, 40)
    ]);

    expect(result).toEqual(
      expect.arrayContaining([
        { skill: "listening", band: 9 },
        { skill: "reading", band: 6.5 }
      ])
    );
    expect(result).toHaveLength(2);
  });

  it("lần làm không đủ 40 câu (band null) bị loại khỏi trung bình, không tính là 0", () => {
    const result = averageBandsBySkillAcrossAttempts([
      answersFor("reading", 40, 40), // band 9
      answersFor("reading", 8, 10) // bài lẻ 10 câu -> band null, phải bị bỏ qua
    ]);

    expect(result).toEqual([{ skill: "reading", band: 9 }]);
  });

  it("không có lần làm nào (hoặc toàn bài lẻ) -> mảng rỗng", () => {
    expect(averageBandsBySkillAcrossAttempts([])).toEqual([]);
    expect(averageBandsBySkillAcrossAttempts([answersFor("reading", 8, 10)])).toEqual([]);
  });
});
