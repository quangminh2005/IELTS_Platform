import { describe, expect, it } from "vitest";
import {
  buildQuestion,
  checkVocabAnswer,
  maskWordInSentence,
  meaningVariants,
  normalizeVietnamese,
  spellingHint,
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

describe("dạng nối / gõ từ / gõ nghĩa", () => {
  it("câu nối hỏi bằng từ và vẫn mang 4 lựa chọn nghĩa để hỏi lại", () => {
    const question = ask(pool[0], "match");
    expect(question.kind).toBe("match");
    expect(question.prompt).toBe("policy");
    expect(question.options).toHaveLength(4);
    expect(question.options[question.correctIndex]).toBe("chính sách");
  });

  it("gõ từ: đề là nghĩa Việt, không có lựa chọn", () => {
    const question = ask(pool[1], "spell");
    expect(question.kind).toBe("spell");
    expect(question.prompt).toBe("nghiên cứu");
    expect(question.options).toEqual([]);
    expect(question.correctIndex).toBe(-1);
  });

  it("gõ nghĩa: đề là từ Anh, không có lựa chọn", () => {
    const question = ask(pool[1], "translate");
    expect(question.kind).toBe("translate");
    expect(question.prompt).toBe("research");
    expect(question.options).toEqual([]);
  });

  it("chấm nối như chọn nghĩa, gõ từ chỉ nhận đúng từ gốc", () => {
    const word = pool[5];
    expect(checkVocabAnswer("match", word, "chiến lược")).toBe(true);
    expect(checkVocabAnswer("match", word, "chính sách")).toBe(false);
    expect(checkVocabAnswer("spell", word, " Strategy ")).toBe(true);
    expect(checkVocabAnswer("spell", word, "strategies")).toBe(false);
  });

  it("gõ nghĩa nhận từng nghĩa con, không dấu, có/không phần trong ngoặc", () => {
    const word = w("x", "regime", "chế độ, thể chế; (sự) cai trị", "The regime fell.");
    expect(checkVocabAnswer("translate", word, "chế độ")).toBe(true);
    expect(checkVocabAnswer("translate", word, "the che")).toBe(true);
    expect(checkVocabAnswer("translate", word, "Sự cai trị")).toBe(true);
    expect(checkVocabAnswer("translate", word, "cai tri")).toBe(true);
    expect(checkVocabAnswer("translate", word, "chế độ, thể chế; (sự) cai trị")).toBe(true);
    expect(checkVocabAnswer("translate", word, "công nghệ")).toBe(false);
    expect(checkVocabAnswer("translate", word, "  ")).toBe(false);
  });

  it("tách nghĩa theo dấu phẩy, chấm phẩy, gạch chéo và chữ \"hoặc\"", () => {
    expect(meaningVariants("đi cùng / kèm theo hoặc hộ tống")).toEqual(
      expect.arrayContaining(["đi cùng", "kèm theo", "hộ tống"])
    );
  });

  it("chuẩn hoá tiếng Việt bỏ dấu, đ → d, gộp khoảng trắng", () => {
    expect(normalizeVietnamese("  Đi   CÙNG. ")).toBe("di cung");
    expect(normalizeVietnamese("cơ quan có thẩm quyền")).toBe("co quan co tham quyen");
  });

  it("gợi ý gõ từ giữ chữ đầu mỗi từ", () => {
    expect(spellingHint("regime")).toBe("r _ _ _ _ _");
    expect(spellingHint("take part")).toBe("t _ _ _   p _ _ _");
    expect(spellingHint("well-being")).toBe("w _ _ _ - _ _ _ _ _");
  });
});
