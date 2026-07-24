import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  groupForQuestionType,
  LOW_DATA_THRESHOLD,
  QUESTION_GROUPS,
  questionTypeStatsBySkill,
  weakestGroup,
  WEAKEST_MIN_ANSWERS,
  type GroupStat,
  type QuestionGroupKey
} from "../lib/question-stats";

function answer(skill: string, questionType: string | null, isCorrect: boolean | null) {
  return { skill, questionType, isCorrect };
}

describe("groupForQuestionType", () => {
  it("phủ đủ mọi dạng auto-grade khai báo trong materials.ts", () => {
    // Đọc thẳng nguồn để danh sách dạng câu không bao giờ lệch với import:
    // thêm questionType mới mà quên thêm nhóm -> test này fail.
    const source = readFileSync(
      path.join(process.cwd(), "lib", "actions", "materials.ts"),
      "utf8"
    );
    const match = source.match(/const questionTypes = \[([^\]]+)\]/);
    expect(match).not.toBeNull();
    const declared = [...match![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(declared.length).toBeGreaterThanOrEqual(11);

    const manual = new Set(["writing_task", "speaking_task"]);
    for (const type of declared) {
      if (manual.has(type)) {
        expect(groupForQuestionType(type)).toBeNull();
      } else {
        expect(groupForQuestionType(type)).not.toBeNull();
      }
    }
  });

  it("dạng không quen biết -> null", () => {
    expect(groupForQuestionType("mystery_type")).toBeNull();
  });
});

describe("questionTypeStatsBySkill", () => {
  it("tính đúng/tổng theo nhóm và theo kỹ năng", () => {
    const stats = questionTypeStatsBySkill([
      answer("listening", "multiple_choice", true),
      answer("listening", "multiple_choice", false),
      answer("reading", "multiple_choice", true),
      answer("reading", "note_completion", false),
      answer("reading", "gap_fill", true)
    ]);

    const mcAll = stats.all.find((s) => s.key === "multiple_choice")!;
    expect(mcAll).toMatchObject({ correct: 2, total: 3, percent: 67 });

    const mcListening = stats.listening.find((s) => s.key === "multiple_choice")!;
    expect(mcListening).toMatchObject({ correct: 1, total: 2, percent: 50 });

    // gap_fill + note_completion gộp chung nhóm "Điền từ".
    const completion = stats.reading.find((s) => s.key === "completion")!;
    expect(completion).toMatchObject({ correct: 1, total: 2, percent: 50 });
  });

  it("bỏ qua câu chấm tay (isCorrect null) và câu mất liên kết dạng", () => {
    const stats = questionTypeStatsBySkill([
      answer("writing", "writing_task", null),
      answer("reading", null, true)
    ]);
    for (const stat of stats.all) {
      expect(stat.total).toBe(0);
    }
  });

  it("luôn trả đủ 5 nhóm theo đúng thứ tự khai báo", () => {
    const stats = questionTypeStatsBySkill([]);
    expect(stats.all.map((s) => s.key)).toEqual(QUESTION_GROUPS.map((g) => g.key));
  });
});

describe("weakestGroup", () => {
  const make = (key: QuestionGroupKey, percent: number, total: number): GroupStat => ({
    key,
    label: key,
    correct: Math.round((percent / 100) * total),
    total,
    percent
  });

  it("chọn nhóm % thấp nhất trong các nhóm đủ dữ liệu", () => {
    const weakest = weakestGroup([
      make("multiple_choice", 40, WEAKEST_MIN_ANSWERS),
      make("completion", 30, 4), // dưới ngưỡng -> bỏ qua dù % thấp hơn
      make("matching", 80, 30)
    ]);
    expect(weakest?.key).toBe("multiple_choice");
  });

  it("hòa % -> chọn nhóm nhiều câu hơn", () => {
    const weakest = weakestGroup([
      make("multiple_choice", 50, 10),
      make("completion", 50, 20)
    ]);
    expect(weakest?.key).toBe("completion");
  });

  it("không nhóm nào đủ ngưỡng -> null", () => {
    expect(weakestGroup([make("multiple_choice", 10, WEAKEST_MIN_ANSWERS - 1)])).toBeNull();
  });
});

describe("ngưỡng nghiệp vụ", () => {
  // Ghim 2 con số đã chốt trong spec — đổi ngưỡng là phải sửa test có chủ đích.
  it("chưa đủ dữ liệu < 5 câu; nhóm yếu nhất cần >= 10 câu", () => {
    expect(LOW_DATA_THRESHOLD).toBe(5);
    expect(WEAKEST_MIN_ANSWERS).toBe(10);
  });
});
