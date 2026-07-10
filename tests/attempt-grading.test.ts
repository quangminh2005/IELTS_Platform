import { describe, expect, it } from "vitest";
import { gradeUnits } from "@/lib/attempt-grading";

const readingUnit = {
  assignableUnitId: "u1",
  skill: "reading",
  content: "The capital of France is Paris, a large city.",
  transcript: null,
  questions: [
    { id: "q1", order: 1, questionType: "short_answer", optionsJson: null,
      correctAnswerJson: JSON.stringify(["Paris"]), explanation: null,
      answerEvidence: null, points: 1 }
  ]
};

const writingUnit = {
  assignableUnitId: "u2",
  skill: "writing",
  content: null,
  transcript: null,
  questions: [
    { id: "q2", order: 1, questionType: "essay", optionsJson: null,
      correctAnswerJson: null, explanation: null, answerEvidence: null, points: 1 }
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

  it("tự dò dẫn chứng từ content khi answerEvidence trống", () => {
    const result = gradeUnits([readingUnit], () => "paris");
    expect(result.answerRows[0].evidenceSnapshot).toBe(
      "The capital of France is Paris, a large city."
    );
  });

  it("ưu tiên answerEvidence có sẵn hơn tự dò", () => {
    const unit = {
      ...readingUnit,
      questions: [{ ...readingUnit.questions[0], answerEvidence: "Dẫn chứng do AI cung cấp." }]
    };
    const result = gradeUnits([unit], () => "paris");
    expect(result.answerRows[0].evidenceSnapshot).toBe("Dẫn chứng do AI cung cấp.");
  });
});
