import { describe, expect, it } from "vitest";
import {
  BOX_INTERVAL_DAYS,
  buildReviewSession,
  cardState,
  legacyBox,
  newCardAllowance,
  nextSchedule,
  normalizeWordKey,
  pickNewWords,
  questionKindForBox,
  SESSION_SIZE,
  type DueCard,
  type FreshWord
} from "../lib/vocab-srs";
import type { QuizWord } from "../lib/vocab-quiz";

const word = (id: string, display: string, meaningVi: string, exampleEn: string): QuizWord => ({
  id,
  display,
  meaningVi,
  phonetic: null,
  exampleEn
});

const pool: QuizWord[] = [
  word("w1", "policy", "chính sách", "The new policy was announced last week."),
  word("w2", "research", "nghiên cứu", "Her research took a decade."),
  word("w3", "impact", "tác động", "The impact was huge."),
  word("w4", "region", "khu vực", "Farmers in the region rely on rain."),
  word("w5", "resource", "tài nguyên", "Water is a precious resource.")
];

const due = (cardId: string, box: number, dueDate: string, base = pool[0]): DueCard => ({
  cardId,
  wordId: base.id,
  box,
  dueDate,
  word: base
});

const fresh = (base: QuizWord): FreshWord => ({ wordId: base.id, word: base });

describe("nextSchedule", () => {
  it("đúng thì lên một hộp và giãn lịch theo hộp mới", () => {
    expect(nextSchedule({ box: 2, correct: true, today: "2026-09-29" })).toEqual({
      box: 3,
      dueDate: "2026-10-06"
    });
  });

  it("thẻ mới trả lời đúng hay sai đều vào hộp 1, ôn lại ngày mai", () => {
    expect(nextSchedule({ box: 0, correct: true, today: "2026-09-29" })).toEqual({
      box: 1,
      dueDate: "2026-09-30"
    });
    expect(nextSchedule({ box: 0, correct: false, today: "2026-09-29" })).toEqual({
      box: 1,
      dueDate: "2026-09-30"
    });
  });

  it("sai thì rơi về hộp 1 dù đang ở hộp cao", () => {
    expect(nextSchedule({ box: 5, correct: false, today: "2026-12-31" })).toEqual({
      box: 1,
      dueDate: "2027-01-01"
    });
  });

  it("hộp cao nhất là 6, đúng tiếp vẫn giữ 60 ngày", () => {
    expect(nextSchedule({ box: 6, correct: true, today: "2026-09-29" })).toEqual({
      box: 6,
      dueDate: "2026-11-28"
    });
    expect(BOX_INTERVAL_DAYS[6]).toBe(60);
  });
});

describe("questionKindForBox / cardState / legacyBox", () => {
  it("dạng câu khó dần theo hộp", () => {
    expect(questionKindForBox(0)).toBe("meaning");
    expect(questionKindForBox(1)).toBe("meaning");
    expect(questionKindForBox(2)).toBe("reverse");
    expect(questionKindForBox(3)).toBe("reverse");
    expect(questionKindForBox(4)).toBe("cloze");
    expect(questionKindForBox(6)).toBe("cloze");
  });

  it("trạng thái thẻ", () => {
    expect(cardState(0)).toBe("new");
    expect(cardState(1)).toBe("learning");
    expect(cardState(4)).toBe("learning");
    expect(cardState(5)).toBe("mastered");
  });

  it("chuyển kết quả quiz cũ thành hộp", () => {
    expect(legacyBox(3, 1)).toBe(2);
    expect(legacyBox(1, 1)).toBe(1);
    expect(legacyBox(0, 2)).toBe(1);
  });
});

describe("normalizeWordKey", () => {
  it("chữ thường, bỏ khoảng trắng thừa, thống nhất dấu nháy", () => {
    expect(normalizeWordKey("  Take   Part ")).toBe("take part");
    expect(normalizeWordKey("Children’s")).toBe("children's");
  });
});

describe("newCardAllowance", () => {
  it("mỗi ngày 5 thẻ mới, mỗi lần 'học thêm' cộng 5", () => {
    expect(newCardAllowance({ introducedToday: 0, extraBatches: 0 })).toBe(5);
    expect(newCardAllowance({ introducedToday: 3, extraBatches: 0 })).toBe(2);
    expect(newCardAllowance({ introducedToday: 5, extraBatches: 0 })).toBe(0);
    expect(newCardAllowance({ introducedToday: 5, extraBatches: 1 })).toBe(5);
    expect(newCardAllowance({ introducedToday: 9, extraBatches: 0 })).toBe(0);
  });
});

describe("pickNewWords", () => {
  const candidates = [
    { id: "a", releasedOn: null },
    { id: "b", releasedOn: "2026-09-10" },
    { id: "c", releasedOn: "2026-08-20" },
    { id: "d", releasedOn: null },
    { id: "t", releasedOn: "2026-09-29" }
  ];

  it("từ của ngày trước, rồi từ đã phát (cũ trước), rồi phần còn lại của kho", () => {
    expect(
      pickNewWords({ candidates, exclude: new Set(), todayWordId: "t", limit: 10 })
    ).toEqual(["t", "c", "b", "a", "d"]);
  });

  it("bỏ từ đã có thẻ và cắt theo hạn mức", () => {
    expect(
      pickNewWords({ candidates, exclude: new Set(["t", "c"]), todayWordId: "t", limit: 2 })
    ).toEqual(["b", "a"]);
  });

  it("hạn mức 0 thì không có từ mới", () => {
    expect(pickNewWords({ candidates, exclude: new Set(), todayWordId: null, limit: 0 })).toEqual(
      []
    );
  });
});

describe("buildReviewSession", () => {
  it("thẻ đến hạn trước (hạn sớm, hộp thấp trước), rồi mới tới thẻ mới", () => {
    const items = buildReviewSession({
      due: [
        due("c1", 3, "2026-09-29", pool[0]),
        due("c2", 1, "2026-09-20", pool[1]),
        due("c3", 1, "2026-09-29", pool[2])
      ],
      fresh: [fresh(pool[3])],
      pool,
      seed: 0,
      size: SESSION_SIZE
    });

    expect(items.map((item) => item.key)).toEqual(["c2", "c3", "c1", "new:w4"]);
    expect(items[3]).toMatchObject({ cardId: null, wordId: "w4", isNew: true, box: 0 });
  });

  it("dạng câu theo hộp, mã câu hỏi trùng key của thẻ", () => {
    const [item] = buildReviewSession({
      due: [due("c9", 2, "2026-09-29", pool[1])],
      fresh: [],
      pool,
      seed: 0,
      size: SESSION_SIZE
    });

    expect(item.question.kind).toBe("reverse");
    expect(item.question.wordId).toBe("c9");
    expect(item.isNew).toBe(false);
  });

  it("thẻ tự thêm chưa ôn lần nào (hộp 0) cũng hiện thẻ giới thiệu", () => {
    const [item] = buildReviewSession({
      due: [{ ...due("c5", 0, "2026-09-29", pool[2]), wordId: null }],
      fresh: [],
      pool,
      seed: 0,
      size: SESSION_SIZE
    });

    expect(item.isNew).toBe(true);
    expect(item.wordId).toBeNull();
  });

  it("một buổi không quá size thẻ, thẻ đến hạn được ưu tiên giữ chỗ", () => {
    const items = buildReviewSession({
      due: [due("c1", 1, "2026-09-29", pool[0]), due("c2", 1, "2026-09-29", pool[1])],
      fresh: [fresh(pool[3]), fresh(pool[4])],
      pool,
      seed: 0,
      size: 3
    });

    expect(items.map((item) => item.key)).toEqual(["c1", "c2", "new:w4"]);
  });
});
