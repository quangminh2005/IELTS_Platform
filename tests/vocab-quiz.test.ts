import { describe, expect, it } from "vitest";
import { buildQuiz, type ProgressRow, type QuizWord } from "../lib/vocab-quiz";

const pool: QuizWord[] = [
  { id: "w1", display: "policy", meaningVi: "chính sách" },
  { id: "w2", display: "research", meaningVi: "nghiên cứu" },
  { id: "w3", display: "impact", meaningVi: "tác động" },
  { id: "w4", display: "region", meaningVi: "khu vực" },
  { id: "w5", display: "resource", meaningVi: "tài nguyên" },
  { id: "w6", display: "strategy", meaningVi: "chiến lược" }
];

const build = (progress: ProgressRow[] = [], seed = 0, count = 3) =>
  buildQuiz({ pool, progress, count, seed });

describe("buildQuiz", () => {
  it("kho dưới 4 từ thì không dựng được quiz", () => {
    expect(
      buildQuiz({ pool: pool.slice(0, 3), progress: [], count: 3, seed: 0 })
    ).toEqual([]);
  });

  it("trả về đúng số câu yêu cầu", () => {
    expect(build()).toHaveLength(3);
  });

  it("mỗi câu có 4 lựa chọn và không lựa chọn nào trùng nhau", () => {
    for (const question of build()) {
      expect(question.options).toHaveLength(4);
      expect(new Set(question.options).size).toBe(4);
    }
  });

  it("đáp án đúng luôn nằm ở correctIndex", () => {
    for (const question of build()) {
      const word = pool.find((item) => item.id === question.wordId);
      expect(question.options[question.correctIndex]).toBe(word?.meaningVi);
    }
  });

  it("không lặp từ trong cùng một lượt", () => {
    const ids = build().map((question) => question.wordId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ưu tiên từ sai nhiều nhất", () => {
    const progress: ProgressRow[] = [
      { wordId: "w5", correctCount: 0, wrongCount: 9, lastAnswerAt: new Date() }
    ];
    const ids = buildQuiz({ pool, progress, count: 1, seed: 0 }).map(
      (question) => question.wordId
    );
    expect(ids).toContain("w5");
  });

  it("cùng sai bằng nhau thì ưu tiên từ lâu chưa ôn", () => {
    // Mọi từ trong rổ đều phải có tiến độ, nếu không từ "chưa ôn lần nào" sẽ
    // được xếp trước và test đo nhầm.
    const at = (iso: string) => new Date(iso);
    const progress: ProgressRow[] = [
      { wordId: "w1", correctCount: 1, wrongCount: 0, lastAnswerAt: at("2026-08-10T00:00:00Z") },
      { wordId: "w2", correctCount: 1, wrongCount: 0, lastAnswerAt: at("2026-01-01T00:00:00Z") },
      { wordId: "w3", correctCount: 1, wrongCount: 0, lastAnswerAt: at("2026-08-09T00:00:00Z") },
      { wordId: "w4", correctCount: 1, wrongCount: 0, lastAnswerAt: at("2026-08-08T00:00:00Z") }
    ];
    const first = buildQuiz({
      pool: pool.slice(0, 4),
      progress,
      count: 1,
      seed: 0
    })[0];
    expect(first.wordId).toBe("w2");
  });

  it("từ chưa ôn lần nào được ưu tiên trước từ vừa ôn hôm qua", () => {
    const progress: ProgressRow[] = [
      {
        wordId: "w1",
        correctCount: 1,
        wrongCount: 0,
        lastAnswerAt: new Date("2026-08-10T00:00:00Z")
      }
    ];
    const ids = buildQuiz({ pool: pool.slice(0, 4), progress, count: 3, seed: 0 }).map(
      (question) => question.wordId
    );
    expect(ids).not.toContain("w1");
  });

  it("cùng seed cho kết quả giống hệt nhau", () => {
    expect(build([], 3)).toEqual(build([], 3));
  });

  it("đổi seed thì bốc bộ từ khác", () => {
    const a = build([], 0).map((question) => question.wordId).join(",");
    const b = build([], 1).map((question) => question.wordId).join(",");
    expect(a).not.toBe(b);
  });
});
