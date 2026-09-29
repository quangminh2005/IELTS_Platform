import { describe, expect, it } from "vitest";
import {
  cleanSelection,
  isAddableSelection,
  parseDictionaryEntry,
  sentenceAround
} from "../lib/vocab-selection";

describe("cleanSelection / isAddableSelection", () => {
  it("bỏ dấu câu và khoảng trắng dính hai đầu vùng bôi đen", () => {
    expect(cleanSelection(" “mitigate,” ")).toBe("mitigate");
    expect(cleanSelection("take   part.")).toBe("take part");
  });

  it("nhận 1–3 từ tiếng Anh, có gạch nối và nháy", () => {
    expect(isAddableSelection("mitigate")).toBe(true);
    expect(isAddableSelection("well-being")).toBe(true);
    expect(isAddableSelection("children's")).toBe(true);
    expect(isAddableSelection("take part in")).toBe(true);
    expect(isAddableSelection("  Resilient. ")).toBe(true);
  });

  it("từ chối câu dài, số, chữ Việt và vùng trống", () => {
    expect(isAddableSelection("")).toBe(false);
    expect(isAddableSelection("one two three four")).toBe(false);
    expect(isAddableSelection("1990")).toBe(false);
    expect(isAddableSelection("giảm nhẹ")).toBe(false);
    expect(isAddableSelection("a".repeat(41))).toBe(false);
  });
});

describe("sentenceAround", () => {
  const text =
    "Coral reefs are in danger. Scientists hope new policies will mitigate the damage! Others disagree.";

  it("lấy đúng câu chứa vùng bôi đen", () => {
    const start = text.indexOf("mitigate");
    expect(sentenceAround(text, start, start + "mitigate".length)).toBe(
      "Scientists hope new policies will mitigate the damage!"
    );
  });

  it("câu đầu và câu cuối đoạn", () => {
    expect(sentenceAround(text, 0, 5)).toBe("Coral reefs are in danger.");
    const start = text.indexOf("disagree");
    expect(sentenceAround(text, start, start + 8)).toBe("Others disagree.");
  });

  it("xuống dòng cũng là ranh giới câu", () => {
    const lines = "Heading without stop\nThe budget was cut sharply\nNext line.";
    const start = lines.indexOf("budget");
    expect(sentenceAround(lines, start, start + 6)).toBe("The budget was cut sharply");
  });

  it("dấu chấm trong số thập phân không cắt câu", () => {
    const value = "Prices rose by 2.5 percent last year. Then fell.";
    const start = value.indexOf("percent");
    expect(sentenceAround(value, start, start + 7)).toBe("Prices rose by 2.5 percent last year.");
  });
});

describe("parseDictionaryEntry", () => {
  it("lấy phiên âm, từ loại và nghĩa đầu tiên", () => {
    const json = [
      {
        word: "mitigate",
        phonetics: [{ audio: "" }, { text: "/ˈmɪtɪɡeɪt/" }],
        meanings: [
          {
            partOfSpeech: "verb",
            definitions: [{ definition: "To reduce, lessen, or decrease." }]
          }
        ]
      }
    ];

    expect(parseDictionaryEntry(json)).toEqual({
      phonetic: "/ˈmɪtɪɡeɪt/",
      partOfSpeech: "verb",
      definitionEn: "To reduce, lessen, or decrease."
    });
  });

  it("không tìm thấy từ hoặc dữ liệu lạ thì trả null", () => {
    expect(parseDictionaryEntry({ title: "No Definitions Found" })).toBeNull();
    expect(parseDictionaryEntry(null)).toBeNull();
    expect(parseDictionaryEntry([{}])).toBeNull();
  });
});
