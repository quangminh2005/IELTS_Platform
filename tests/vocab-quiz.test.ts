import { describe, expect, it } from "vitest";
import {
  buildQuestion,
  checkVocabAnswer,
  maskWordInSentence,
  type QuizKind,
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

const ask = (word: QuizWord, kind: QuizKind, seed = 0, index = 0) =>
  buildQuestion({ word, kind, pool, seed, index });

describe("buildQuestion", () => {
  it("câu trắc nghiệm có 4 lựa chọn và không lựa chọn nào trùng nhau", () => {
    for (const word of pool) {
      for (const kind of ["meaning", "reverse"] as const) {
        const question = ask(word, kind);
        expect(question.options).toHaveLength(4);
        expect(new Set(question.options).size).toBe(4);
      }
    }
  });

  it("đáp án đúng luôn nằm ở correctIndex, theo đúng chiều hỏi", () => {
    for (const word of pool) {
      const meaning = ask(word, "meaning");
      expect(meaning.options[meaning.correctIndex]).toBe(word.meaningVi);
      expect(meaning.prompt).toBe(word.display);

      const reverse = ask(word, "reverse");
      expect(reverse.options[reverse.correctIndex]).toBe(word.display);
      expect(reverse.prompt).toBe(word.meaningVi);
    }
  });

  it("đổi seed/index thì vị trí đáp án đổi", () => {
    const positions = new Set(
      [0, 1, 2, 3].map((index) => ask(pool[0], "meaning", 0, index).correctIndex)
    );
    expect(positions.size).toBeGreaterThan(1);
  });

  it("câu điền từ che đúng từ trong câu ví dụ, kể cả dạng biến thể", () => {
    for (const word of pool) {
      const question = ask(word, "cloze");
      expect(question.kind).toBe("cloze");
      expect(question.options).toEqual([]);
      expect(question.prompt).toContain("____");
      expect(question.prompt.toLowerCase()).not.toContain(word.display.toLowerCase());
    }
  });

  it("từ không xuất hiện trong câu ví dụ thì dạng điền từ rơi về dạng chọn từ", () => {
    const odd = { ...pool[1], exampleEn: "This sentence mentions nothing relevant." };
    expect(ask(odd, "cloze").kind).toBe("reverse");
  });

  it("câu ngược dùng từ tiếng Anh khác làm nhiễu", () => {
    const displays = new Set(pool.map((item) => item.display));
    for (const option of ask(pool[0], "reverse").options) {
      expect(displays.has(option)).toBe(true);
    }
  });

  it("từ tự thêm không có trong rổ vẫn có đủ 3 đáp án nhiễu", () => {
    const custom = w("card-x", "mitigate", "giảm nhẹ", "Trees mitigate the heat.");
    const question = ask(custom, "meaning");
    expect(question.options).toHaveLength(4);
    expect(question.options[question.correctIndex]).toBe("giảm nhẹ");
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
