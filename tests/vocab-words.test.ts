import { describe, expect, it } from "vitest";
import {
  buildVocabWordEntries,
  countByStatus,
  filterVocabWords,
  groupVocabWordsByDate,
  parseFlashcardGroup,
  wordsForFlashcards,
  type DeckCardInput,
  type ReleasedWordInput,
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
  cardId: null,
  dateKey: releasedOn,
  status: "unstudied",
  dueDate: null,
  selfAdded: false,
  editable: false
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

const content = (display: string, meaningVi: string) => ({
  display,
  phonetic: null,
  partOfSpeech: null,
  meaningVi,
  definitionEn: null,
  exampleEn: `Example with ${display}.`
});

const card = (over: Partial<DeckCardInput> & { id: string }): DeckCardInput => ({
  wordId: null,
  source: "bank",
  box: 1,
  dueDate: "2026-09-30",
  createdKey: "2026-09-29",
  content: content("policy", "chính sách"),
  sourceLabel: null,
  ...over
});

const released = (id: string, display: string, releasedOn: string): ReleasedWordInput => ({
  id,
  ...content(display, "nghĩa"),
  sourceLabel: null,
  releasedOn
});

describe("buildVocabWordEntries", () => {
  it("từ đã phát nhưng chưa có thẻ hiện là 'chưa học', từ có thẻ thì theo thẻ", () => {
    const entries = buildVocabWordEntries(
      [card({ id: "c1", wordId: "w1", box: 5 })],
      [released("w1", "policy", "2026-09-01"), released("w2", "research", "2026-09-02")]
    );

    expect(entries.map((e) => [e.id, e.status])).toEqual([
      ["c1", "mastered"],
      ["w2", "unstudied"]
    ]);
    expect(entries[1].dateKey).toBe("2026-09-02");
  });

  it("từ phát lại nhiều lần chỉ giữ lần phát đầu", () => {
    const entries = buildVocabWordEntries(
      [],
      [released("w2", "research", "2026-09-20"), released("w2", "research", "2026-09-02")]
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].dateKey).toBe("2026-09-02");
  });

  it("chỉ từ học viên tự gõ nghĩa mới sửa được; từ tự thêm có sẵn trong kho thì không", () => {
    const entries = buildVocabWordEntries(
      [
        card({ id: "own", source: "student", content: content("mitigate", "giảm nhẹ") }),
        card({ id: "bank", source: "student", wordId: "w9" })
      ],
      []
    );

    expect(entries.map((e) => [e.id, e.selfAdded, e.editable])).toEqual([
      ["own", true, true],
      ["bank", true, false]
    ]);
  });

  it("đếm theo trạng thái", () => {
    const entries = buildVocabWordEntries(
      [card({ id: "a", box: 0 }), card({ id: "b", box: 2 }), card({ id: "c", box: 6 })],
      [released("w5", "impact", "2026-09-05")]
    );

    expect(countByStatus(entries)).toEqual({ unstudied: 1, new: 1, learning: 1, mastered: 1 });
  });
});

describe("wordsForFlashcards / parseFlashcardGroup", () => {
  const entries = buildVocabWordEntries(
    [
      card({ id: "new", box: 0 }),
      card({ id: "learning", box: 3 }),
      card({ id: "mastered", box: 5 }),
      card({ id: "self", box: 1, source: "student", content: content("mitigate", "giảm nhẹ") })
    ],
    [released("w9", "impact", "2026-09-05")]
  );
  const ids = (group: Parameters<typeof wordsForFlashcards>[1]) =>
    wordsForFlashcards(entries, group).map((e) => e.id);

  it("lọc đúng từng nhóm", () => {
    expect(ids("learning")).toEqual(["new", "learning", "self"]);
    expect(ids("self")).toEqual(["self"]);
    expect(ids("mastered")).toEqual(["mastered"]);
    expect(ids("all")).toHaveLength(5);
  });

  it("nhóm lạ trên URL rơi về 'đang học'", () => {
    expect(parseFlashcardGroup("mastered")).toBe("mastered");
    expect(parseFlashcardGroup("xyz")).toBe("learning");
    expect(parseFlashcardGroup(undefined)).toBe("learning");
  });
});
