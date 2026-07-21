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

// Một số câu Listening yêu cầu tick HAI đáp án (vd Test 16 câu 11): cả hai chữ
// lưu chung một ô, nối bằng " | ", và chỉ được điểm khi đúng cả hai.
const multiPickUnit = {
  assignableUnitId: "u3",
  skill: "listening",
  content: null,
  transcript: "Doors Open takes place every year. It's all completely free.",
  questions: [
    {
      id: "q11",
      order: 11,
      questionType: "multiple_choice",
      optionsJson: JSON.stringify([
        "A is an annual event",
        "B lasts for one week",
        "C is a free event"
      ]),
      correctAnswerJson: JSON.stringify(["A is an annual event", "C is a free event"]),
      explanation: null,
      answerEvidence: "It's all completely free.",
      points: 1
    }
  ]
};

describe("gradeUnits", () => {
  it("cho điểm câu tick-hai-đáp-án khi chọn đúng cả hai (không phụ thuộc thứ tự)", () => {
    const result = gradeUnits(
      [multiPickUnit],
      () => "C is a free event | A is an annual event"
    );
    expect(result.answerRows[0].isCorrect).toBe(true);
    expect(result.answerRows[0].pointsAwarded).toBe(1);
    expect(result.gradeItems[0].points).toBe(1);
  });

  it("không cho điểm câu tick-hai-đáp-án khi mới chọn một chữ", () => {
    const result = gradeUnits([multiPickUnit], () => "A is an annual event");
    expect(result.answerRows[0].isCorrect).toBe(false);
    expect(result.answerRows[0].pointsAwarded).toBe(0);
  });

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
