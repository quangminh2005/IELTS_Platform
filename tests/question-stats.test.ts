import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assignmentQuestionStats,
  buildProgressSeries,
  groupForQuestionType,
  LOW_DATA_THRESHOLD,
  MAX_POINTS_PER_SKILL,
  QUESTION_GROUPS,
  questionTypeStatsBySkill,
  tallyWrongAnswers,
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

describe("buildProgressSeries", () => {
  const attempt = (
    title: string,
    iso: string,
    rows: Array<[skill: string, isCorrect: boolean]>
  ) => ({
    title,
    submittedAt: new Date(iso),
    answers: rows.map(([skill, isCorrect]) => ({ skill, isCorrect }))
  });

  it("mỗi kỹ năng một chuỗi, sắp theo thời gian tăng dần", () => {
    const series = buildProgressSeries([
      attempt("Bài 2", "2026-07-20T10:00:00Z", [
        ["listening", true],
        ["listening", false]
      ]),
      attempt("Bài 1", "2026-07-10T10:00:00Z", [
        ["listening", true],
        ["reading", false]
      ])
    ]);

    expect(series.listening.map((p) => p.label)).toEqual(["Bài 1", "Bài 2"]);
    expect(series.listening[1]).toMatchObject({
      percent: 50,
      correct: 1,
      total: 2,
      band: null
    });
    expect(series.reading).toHaveLength(1);
    expect(series.reading[0].percent).toBe(0);
  });

  it("band chỉ có ở bài đủ 40 câu", () => {
    const answers40 = Array.from(
      { length: 40 },
      (_, i) => ["listening", i < 30] as [string, boolean]
    );
    const series = buildProgressSeries([
      attempt("Full test", "2026-07-01T00:00:00Z", answers40)
    ]);
    // 30/40 câu Nghe -> band 7 theo bảng quy đổi.
    expect(series.listening[0].band).toBe(7);
  });

  it("cắt còn 20 bài gần nhất mỗi kỹ năng", () => {
    const attempts = Array.from({ length: 25 }, (_, i) =>
      attempt(
        `Bài ${i + 1}`,
        `2026-06-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
        [["reading", true]]
      )
    );
    const series = buildProgressSeries(attempts);
    expect(series.reading).toHaveLength(MAX_POINTS_PER_SKILL);
    expect(series.reading[0].label).toBe("Bài 6");
  });
});

describe("tallyWrongAnswers", () => {
  it("gộp không phân biệt hoa thường, giữ nhãn đầu tiên, cắt top 3", () => {
    expect(tallyWrongAnswers(["B", "b", "D", "", "", "x", "B ", "y"])).toEqual([
      { value: "B", count: 3 },
      { value: "", count: 2 },
      { value: "D", count: 1 }
    ]);
  });
});

describe("assignmentQuestionStats", () => {
  const units = [
    {
      id: "u1",
      title: "Passage 1",
      skill: "reading",
      questions: [
        { id: "q1", order: 1, prompt: "Câu 1?", correctAnswerJson: '["TRUE"]' },
        { id: "q2", order: 2, prompt: "Câu 2?", correctAnswerJson: '["cat"]' }
      ]
    },
    {
      id: "u2",
      title: "Task 1",
      skill: "writing",
      questions: [{ id: "w1", order: 1, prompt: "Viết", correctAnswerJson: null }]
    }
  ];

  it("đếm % sai theo câu; câu không ai trả lời vẫn có dòng 0/N", () => {
    const stats = assignmentQuestionStats(
      units,
      [
        { questionId: "q1", isCorrect: false, value: "FALSE", correctAnswerSnapshot: "TRUE" },
        { questionId: "q1", isCorrect: true, value: "TRUE", correctAnswerSnapshot: "TRUE" },
        { questionId: "q1", isCorrect: false, value: "false", correctAnswerSnapshot: "TRUE" }
      ],
      3
    );

    const [passage, writing] = stats.units;
    expect(writing.manual).toBe(true);
    expect(writing.questions).toHaveLength(0);

    const q1 = passage.questions[0];
    expect(q1).toMatchObject({
      wrongCount: 2,
      totalCount: 3,
      percentWrong: 67,
      correctAnswer: "TRUE"
    });
    expect(q1.wrongValues).toEqual([{ value: "FALSE", count: 2 }]);

    expect(passage.questions[1]).toMatchObject({
      wrongCount: 0,
      totalCount: 3,
      percentWrong: 0,
      correctAnswer: "cat"
    });
  });

  it("top chỉ gồm câu có người sai, đáp án đúng fallback từ correctAnswerJson", () => {
    const stats = assignmentQuestionStats(
      units,
      [{ questionId: "q1", isCorrect: false, value: "", correctAnswerSnapshot: null }],
      1
    );
    expect(stats.top.map((q) => q.questionId)).toEqual(["q1"]);
    expect(stats.top[0].correctAnswer).toBe("TRUE");
  });
});
