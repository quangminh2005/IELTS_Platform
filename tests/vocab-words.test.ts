import { describe, expect, it } from "vitest";
import {
  filterVocabWords,
  groupVocabWordsByDate,
  type VocabWordEntry
} from "../lib/vocab-words";

const entry = (
  id: string,
  display: string,
  meaningVi: string,
  releasedOn: string
): VocabWordEntry => ({
  id,
  display,
  phonetic: null,
  partOfSpeech: null,
  meaningVi,
  definitionEn: null,
  exampleEn: `Example with ${display}.`,
  sourceLabel: null,
  releasedOn,
  correctCount: 0,
  wrongCount: 0
});

const words: VocabWordEntry[] = [
  entry("w1", "research", "nghiên cứu", "2026-09-01"),
  entry("w2", "policy", "chính sách", "2026-09-02"),
  entry("w3", "strategy", "chiến lược", "2026-09-02"),
  entry("w4", "labour", "lao động, sức lao động", "2026-09-03")
];

describe("filterVocabWords", () => {
  it("để trống thì trả về tất cả", () => {
    expect(filterVocabWords(words, "")).toHaveLength(4);
    expect(filterVocabWords(words, "   ")).toHaveLength(4);
  });

  it("tìm theo từ tiếng Anh, không phân biệt hoa thường", () => {
    expect(filterVocabWords(words, "POL").map((w) => w.id)).toEqual(["w2"]);
  });

  it("tìm theo nghĩa Việt, gõ không dấu vẫn ra", () => {
    expect(filterVocabWords(words, "nghien cuu").map((w) => w.id)).toEqual(["w1"]);
    expect(filterVocabWords(words, "lao động").map((w) => w.id)).toEqual(["w4"]);
  });
});

describe("groupVocabWordsByDate", () => {
  it("gom theo ngày phát, ngày mới nhất lên trước", () => {
    const groups = groupVocabWordsByDate(words);
    expect(groups.map((g) => g.date)).toEqual(["2026-09-03", "2026-09-02", "2026-09-01"]);
    expect(groups[1].words.map((w) => w.id)).toEqual(["w2", "w3"]);
  });

  it("nhãn ngày kiểu Việt Nam", () => {
    const groups = groupVocabWordsByDate(words);
    expect(groups[0].label).toBe("3/9/2026");
  });

  it("danh sách rỗng thì không có nhóm", () => {
    expect(groupVocabWordsByDate([])).toEqual([]);
  });
});
