import { describe, expect, it } from "vitest";
import { gradeAnswer, gradeAttempt } from "../lib/grading";

describe("gradeAnswer", () => {
  it("accepts exact answers case-insensitively", () => {
    expect(gradeAnswer("PARIS", ["paris"])).toEqual({
      isCorrect: true,
      pointsAwarded: 1,
    });
  });

  it("accepts any allowed answer", () => {
    expect(gradeAnswer("United States", ["USA", "United States"], 2)).toEqual({
      isCorrect: true,
      pointsAwarded: 2,
    });
  });

  it("treats skipped answers as incorrect and awards zero points", () => {
    expect(gradeAnswer("", ["answer"], 3)).toEqual({
      isCorrect: false,
      pointsAwarded: 0,
    });
  });
});

describe("gradeAttempt", () => {
  it("calculates score and percentage", () => {
    expect(
      gradeAttempt([
        { value: "alpha", correctAnswers: ["Alpha"], points: 2 },
        { value: "skipped", correctAnswers: ["beta"], points: 1 },
        { value: "gamma", correctAnswers: ["gamma"], points: 1 },
      ]),
    ).toEqual({
      score: 3,
      maxScore: 4,
      scorePercent: 75,
    });
  });
});
