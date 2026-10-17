import { describe, expect, it } from "vitest";
import {
  BOX_INTERVAL_DAYS,
  buildReviewSession,
  cardState,
  legacyBox,
  newCardAllowance,
  nextSchedule,
  normalizeWordKey,
  MAX_MATCH_GROUP,
  MIN_MATCH_GROUP,
  pickNewWords,
  questionKindForBox,
  questionKindsForBox,
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
  it("mỗi mức hộp có bộ dạng câu riêng, khó dần", () => {
    expect(questionKindsForBox(0)).toEqual(["meaning"]);
    expect(questionKindsForBox(1)).toEqual(["meaning", "match"]);
    expect(questionKindsForBox(2)).toEqual(["reverse", "spell", "translate", "match"]);
    expect(questionKindsForBox(3)).toEqual(questionKindsForBox(2));
    expect(questionKindsForBox(4)).toEqual(["cloze", "spell", "translate"]);
    expect(questionKindsForBox(6)).toEqual(questionKindsForBox(4));
    expect(questionKindForBox(2, 1)).toBe("spell");
    expect(questionKindForBox(4, 5)).toBe("translate");
  });

  it("dạng mặc định khó dần theo hộp", () => {
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

    // Một thẻ lẻ không nối được → một trong các dạng còn lại của hộp 2.
    expect(["reverse", "spell", "translate"]).toContain(item.question.kind);
    expect(item.matchGroup).toBeNull();
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

describe("buildReviewSession — xáo dạng câu và gom màn nối", () => {
  const meanings = [
    "chính sách", "nghiên cứu", "tác động", "khu vực", "tài nguyên", "chiến lược",
    "chế độ", "công nghệ", "đi cùng", "thẩm quyền", "kinh tế", "môi trường"
  ];
  const big: QuizWord[] = meanings.map((meaningVi, index) =>
    word(`b${index}`, `word${index}`, meaningVi, `We used word${index} today.`)
  );
  const dueBig = big.map((base, index) => due(`k${index}`, 2, "2026-10-17", base));

  it("qua nhiều seed, hộp 2 gặp đủ các dạng chọn từ / gõ từ / gõ nghĩa / nối", () => {
    const kinds = new Set<string>();

    for (let seed = 0; seed < 30; seed += 1) {
      for (const item of buildReviewSession({ due: dueBig, fresh: [], pool: big, seed, size: 20 })) {
        kinds.add(item.question.kind);
      }
    }

    expect([...kinds].sort()).toEqual(["match", "reverse", "spell", "translate"]);
  });

  it("thẻ nối đứng liền nhau theo nhóm 3–5 thẻ, không trùng nghĩa, không lẻ loi", () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const items = buildReviewSession({ due: dueBig, fresh: [], pool: big, seed, size: 20 });
      const groups = new Map<string, number[]>();

      items.forEach((item, index) => {
        if (item.question.kind === "match") {
          expect(item.matchGroup).not.toBeNull();
          groups.set(item.matchGroup!, [...(groups.get(item.matchGroup!) ?? []), index]);
        } else {
          expect(item.matchGroup).toBeNull();
        }
      });

      for (const [groupId, positions] of groups) {
        expect(positions.length).toBeGreaterThanOrEqual(MIN_MATCH_GROUP);
        expect(positions.length).toBeLessThanOrEqual(MAX_MATCH_GROUP);
        expect(positions[positions.length - 1] - positions[0]).toBe(positions.length - 1);
        expect(items[positions[0]].key).toBe(groupId);
        const groupMeanings = positions.map((index) => items[index].question.meaningVi);
        expect(new Set(groupMeanings).size).toBe(groupMeanings.length);
      }

      // Không mất / nhân đôi thẻ khi dồn nhóm.
      expect(items.map((item) => item.key).sort()).toEqual(dueBig.map((card) => card.cardId).sort());
    }
  });

  it("thẻ mới (hộp 0) không bao giờ bị đưa vào màn nối", () => {
    const freshBig = big.map((base) => fresh(base));

    for (let seed = 0; seed < 20; seed += 1) {
      for (const item of buildReviewSession({ due: [], fresh: freshBig, pool: big, seed, size: 20 })) {
        expect(item.question.kind).toBe("meaning");
        expect(item.matchGroup).toBeNull();
      }
    }
  });
});
