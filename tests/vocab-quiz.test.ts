import { describe, expect, it } from "vitest";
import {
  buildQuiz,
  checkVocabAnswer,
  maskWordInSentence,
  QUIZ_SIZE,
  type ProgressRow,
  type QuizWord
} from "../lib/vocab-quiz";

const w = (id: string, display: string, meaningVi: string, exampleEn: string): QuizWord => ({
  id,
  display,
  meaningVi,
  phonetic: null,
  exampleEn
});

const pool: QuizWord[] = [
  w("w1", "policy", "chính sách", "The new policy was announced by the government last week."),
  w("w2", "research", "nghiên cứu", "Her research into coral reefs took almost a decade to complete."),
  w("w3", "impact", "tác động", "The impacts of climate change are already visible in the region."),
  w("w4", "region", "khu vực", "Farmers in the region rely heavily on seasonal rainfall."),
  w("w5", "resource", "tài nguyên", "Water is the most precious resource in the desert."),
  w("w6", "strategy", "chiến lược", "Their marketing strategies changed completely after the merger.")
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

  it("câu trắc nghiệm có 4 lựa chọn và không lựa chọn nào trùng nhau", () => {
    for (const question of build([], 0, QUIZ_SIZE)) {
      if (question.kind === "cloze") {
        expect(question.options).toEqual([]);
        continue;
      }
      expect(question.options).toHaveLength(4);
      expect(new Set(question.options).size).toBe(4);
    }
  });

  it("đáp án đúng luôn nằm ở correctIndex, theo đúng chiều hỏi", () => {
    for (const question of build([], 0, QUIZ_SIZE)) {
      const word = pool.find((item) => item.id === question.wordId);
      if (question.kind === "meaning") {
        expect(question.options[question.correctIndex]).toBe(word?.meaningVi);
      } else if (question.kind === "reverse") {
        expect(question.options[question.correctIndex]).toBe(word?.display);
      }
    }
  });

  it("5 câu chia đúng 2 nghĩa / 1 ngược / 2 điền từ", () => {
    const kinds = build([], 0, QUIZ_SIZE).map((question) => question.kind);
    expect(kinds.filter((kind) => kind === "meaning")).toHaveLength(2);
    expect(kinds.filter((kind) => kind === "reverse")).toHaveLength(1);
    expect(kinds.filter((kind) => kind === "cloze")).toHaveLength(2);
  });

  it("đổi seed thì thứ tự dạng câu cũng xoay", () => {
    const a = build([], 0, QUIZ_SIZE).map((question) => question.kind).join(",");
    const b = build([], 1, QUIZ_SIZE).map((question) => question.kind).join(",");
    expect(a).not.toBe(b);
  });

  it("câu điền từ che đúng từ trong câu ví dụ, kể cả dạng biến thể", () => {
    for (const question of build([], 0, QUIZ_SIZE)) {
      if (question.kind !== "cloze") {
        continue;
      }
      const word = pool.find((item) => item.id === question.wordId)!;
      expect(question.prompt).toContain("____");
      expect(question.prompt.toLowerCase()).not.toContain(word.display.toLowerCase());
    }
  });

  it("từ không xuất hiện trong câu ví dụ thì rơi về dạng nghĩa", () => {
    const odd = pool.map((item) =>
      item.id === "w2" ? { ...item, exampleEn: "This sentence mentions nothing relevant." } : item
    );
    const questions = buildQuiz({ pool: odd, progress: [], count: QUIZ_SIZE, seed: 0 });
    const q = questions.find((question) => question.wordId === "w2");
    expect(q?.kind).not.toBe("cloze");
  });

  it("câu ngược dùng từ tiếng Anh khác làm nhiễu", () => {
    const reverse = build([], 0, QUIZ_SIZE).find((question) => question.kind === "reverse")!;
    const displays = new Set(pool.map((item) => item.display));
    for (const option of reverse.options) {
      expect(displays.has(option)).toBe(true);
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

describe("maskWordInSentence", () => {
  it("che nguyên từ khi khớp chính xác", () => {
    const masked = maskWordInSentence("policy", "The new policy was announced.");
    expect(masked).toEqual({ before: "The new ", match: "policy", after: " was announced." });
  });

  it("che được dạng số nhiều / biến thể theo tiền tố", () => {
    expect(maskWordInSentence("strategy", "Their strategies changed.")?.match).toBe("strategies");
    expect(maskWordInSentence("impact", "The impacts are visible.")?.match).toBe("impacts");
    expect(maskWordInSentence("analyse", "The analysis was thorough.")?.match).toBe("analysis");
  });

  it("không phân biệt hoa thường", () => {
    expect(maskWordInSentence("policy", "Policy matters.")?.match).toBe("Policy");
  });

  it("không có từ thì trả null", () => {
    expect(maskWordInSentence("policy", "Nothing here.")).toBeNull();
  });

  it("không ăn nhầm tiền tố quá ngắn", () => {
    // "region" không được che "regular".
    expect(maskWordInSentence("region", "A regular visitor came.")).toBeNull();
  });
});

describe("checkVocabAnswer", () => {
  const word = pool[5]; // strategy / strategies

  it("dạng nghĩa so với nghĩa Việt", () => {
    expect(checkVocabAnswer("meaning", word, "chiến lược")).toBe(true);
    expect(checkVocabAnswer("meaning", word, "chính sách")).toBe(false);
  });

  it("dạng ngược so với từ tiếng Anh", () => {
    expect(checkVocabAnswer("reverse", word, "strategy")).toBe(true);
    expect(checkVocabAnswer("reverse", word, "policy")).toBe(false);
  });

  it("dạng điền chấp nhận dạng trong câu hoặc dạng gốc, bỏ qua hoa thường", () => {
    expect(checkVocabAnswer("cloze", word, "strategies")).toBe(true);
    expect(checkVocabAnswer("cloze", word, " Strategy ")).toBe(true);
    expect(checkVocabAnswer("cloze", word, "stratagy")).toBe(false);
    expect(checkVocabAnswer("cloze", word, "")).toBe(false);
  });
});
