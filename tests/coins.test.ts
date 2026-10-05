import { describe, expect, it } from "vitest";
import {
  earnedUnitIds,
  planUnitEntries,
  planVocabEntries,
  purchaseKey,
  unitCoinKey,
  unitCoins,
  vocabCoins,
  vocabKey,
  type CoinUnitRow
} from "../lib/coins";

function row(extra: Partial<CoinUnitRow> = {}): CoinUnitRow {
  return {
    attemptId: "a1",
    assignmentId: "as1",
    isPractice: false,
    unitId: "u1",
    submittedAt: new Date("2026-10-01T03:00:00Z"),
    gradedCount: 10,
    correctCount: 5,
    manualAnswered: false,
    note: "Đề 1 – Passage 1",
    ...extra
  };
}

describe("unitCoins", () => {
  it("bằng XP của phần: 10 + round(10 × %đúng)", () => {
    expect(unitCoins(row())).toBe(15);
    expect(unitCoins(row({ correctCount: 10 }))).toBe(20);
  });

  it("Viết/Nói có bài làm +20, phần trống = 0", () => {
    expect(unitCoins(row({ gradedCount: 0, correctCount: 0, manualAnswered: true }))).toBe(20);
    expect(unitCoins(row({ gradedCount: 0, correctCount: 0 }))).toBe(0);
  });

  it("phần Nghe tự luyện ẩn thanh audio được thưởng thêm theo XP", () => {
    expect(unitCoins(row({ audioHidden: true }))).toBe(22);
    expect(unitCoins(row({ correctCount: 10, audioHidden: true }))).toBe(30);
  });
});

describe("khoá", () => {
  it("bài giao và tự luyện khác dạng khoá", () => {
    expect(unitCoinKey(row())).toBe("unit:as1:u1");
    expect(unitCoinKey(row({ isPractice: true }))).toBe("practice:u1");
    expect(vocabKey("2026-10-03")).toBe("vocab:2026-10-03");
    expect(purchaseKey("bg:aurora")).toBe("buy:bg:aurora");
  });

  it("earnedUnitIds đọc được unitId từ cả hai dạng khoá", () => {
    expect([...earnedUnitIds(["unit:as1:u1", "practice:u2", "vocab:2026-10-01", "buy:bg:x"])].sort()).toEqual([
      "u1",
      "u2"
    ]);
  });
});

describe("planUnitEntries", () => {
  it("tạo dòng theo giờ nộp, ghi attemptId + note", () => {
    const [entry] = planUnitEntries([row()], new Set());
    expect(entry).toMatchObject({
      kind: "earn_unit",
      key: "unit:as1:u1",
      amount: 15,
      attemptId: "a1",
      note: "Đề 1 – Passage 1"
    });
    expect(entry.createdAt.toISOString()).toBe("2026-10-01T03:00:00.000Z");
  });

  it("bỏ phần chưa nộp và phần 0 Xu", () => {
    expect(
      planUnitEntries(
        [row({ submittedAt: null }), row({ unitId: "u2", gradedCount: 0, correctCount: 0 })],
        new Set()
      )
    ).toEqual([]);
  });

  it("khoá đã có (reset lượt rồi làm lại) → không cộng lần 2", () => {
    expect(planUnitEntries([row({ attemptId: "a2" })], new Set(["unit:as1:u1"]))).toEqual([]);
  });

  it("tự luyện phần đã có Xu từ bài giao → bỏ qua", () => {
    expect(planUnitEntries([row({ isPractice: true, assignmentId: "p1" })], new Set(["unit:as1:u1"]))).toEqual([]);
  });

  it("tự luyện cả đề rồi luyện lẻ phần đó → chỉ 1 lần", () => {
    const plan = planUnitEntries(
      [
        row({ isPractice: true, assignmentId: "p-full", attemptId: "a1" }),
        row({
          isPractice: true,
          assignmentId: "p-part",
          attemptId: "a2",
          submittedAt: new Date("2026-10-02T03:00:00Z")
        })
      ],
      new Set()
    );
    expect(plan.map((entry) => entry.key)).toEqual(["practice:u1"]);
  });

  it("bài giao SAU khi đã tự luyện phần đó vẫn ra Xu", () => {
    const plan = planUnitEntries([row({ isPractice: false })], new Set(["practice:u1"]));
    expect(plan.map((entry) => entry.key)).toEqual(["unit:as1:u1"]);
  });

  it("xét theo thứ tự thời gian: tự luyện sau bài giao trong cùng lần quét bị bỏ", () => {
    const plan = planUnitEntries(
      [
        row({
          isPractice: true,
          assignmentId: "p1",
          attemptId: "a2",
          submittedAt: new Date("2026-10-05T00:00:00Z")
        }),
        row({ attemptId: "a1", submittedAt: new Date("2026-10-01T00:00:00Z") })
      ],
      new Set()
    );
    expect(plan.map((entry) => entry.key)).toEqual(["unit:as1:u1"]);
  });
});

describe("Sổ từ", () => {
  it("2 thẻ = 1 Xu, trần 15", () => {
    expect(vocabCoins(1)).toBe(0);
    expect(vocabCoins(9)).toBe(4);
    expect(vocabCoins(100)).toBe(15);
  });

  it("ngày mới → create; ngày đã có và tăng → raise; không bao giờ giảm", () => {
    const plan = planVocabEntries(
      [
        { date: "2026-10-01", total: 10 },
        { date: "2026-10-02", total: 20 },
        { date: "2026-10-03", total: 2 },
        { date: "2026-10-04", total: 1 }
      ],
      new Map([
        ["vocab:2026-10-02", 6],
        ["vocab:2026-10-03", 5]
      ])
    );
    expect(plan.create.map((entry) => [entry.key, entry.amount])).toEqual([["vocab:2026-10-01", 5]]);
    expect(plan.create[0]).toMatchObject({ kind: "earn_vocab", note: "Ôn 10 thẻ Sổ từ", attemptId: null });
    expect(plan.raise).toEqual([{ key: "vocab:2026-10-02", amount: 10 }]);
  });
});
