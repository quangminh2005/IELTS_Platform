import { describe, expect, it } from "vitest";
import { gradeUnits } from "@/lib/attempt-grading";

const readingUnit = {
  assignableUnitId: "u1",
  skill: "reading",
  questions: [
    { id: "q1", order: 1, questionType: "short_answer", optionsJson: null,
      correctAnswerJson: JSON.stringify(["Paris"]), explanation: null, points: 1 }
  ]
};

const writingUnit = {
  assignableUnitId: "u2",
  skill: "writing",
  questions: [
    { id: "q2", order: 1, questionType: "essay", optionsJson: null,
      correctAnswerJson: null, explanation: null, points: 1 }
  ]
};

describe("gradeUnits", () => {
  it("auto-grades reading answers", () => {
    const values: Record<string, string> = { q1: "paris" };
    const result = gradeUnits([readingUnit], (id) => values[id] ?? "");
    expect(result.answerRows[0].isCorrect).toBe(true);
    expect(result.answerRows[0].pointsAwarded).toBe(1);
    expect(result.gradeItems).toHaveLength(1);
  });

  it("leaves writing answers ungraded (chờ chấm)", () => {
    const values: Record<string, string> = { q2: "My essay" };
    const result = gradeUnits([writingUnit], (id) => values[id] ?? "");
    expect(result.answerRows[0].isCorrect).toBeNull();
    expect(result.answerRows[0].pointsAwarded).toBeNull();
    expect(result.gradeItems).toHaveLength(0);
  });
});
