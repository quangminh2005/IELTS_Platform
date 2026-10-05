import { describe, expect, it } from "vitest";
import { unitXp, vocabDayXp } from "../lib/monthly-xp";

const base = { gradedCount: 0, correctCount: 0, manualAnswered: false, attemptRound: 1 };

describe("unitXp", () => {
  it("phần tự chấm: 10 XP nền + tối đa 10 XP theo % đúng", () => {
    expect(unitXp({ ...base, gradedCount: 10, correctCount: 0 })).toBe(10);
    expect(unitXp({ ...base, gradedCount: 10, correctCount: 7 })).toBe(17);
    expect(unitXp({ ...base, gradedCount: 13, correctCount: 13 })).toBe(20);
  });

  it("bài chép chính tả 200 ô không được nhiều XP hơn passage 13 câu", () => {
    expect(unitXp({ ...base, gradedCount: 200, correctCount: 200 })).toBe(
      unitXp({ ...base, gradedCount: 13, correctCount: 13 })
    );
  });

  it("phần chấm tay có bài làm: 20 XP, không cần đợi chấm", () => {
    expect(unitXp({ ...base, manualAnswered: true })).toBe(20);
  });

  it("phần vừa tự chấm vừa chấm tay được cả hai khoản", () => {
    expect(unitXp({ ...base, gradedCount: 4, correctCount: 2, manualAnswered: true })).toBe(35);
  });

  it("không có câu chấm được và không có bài chấm tay → 0", () => {
    expect(unitXp(base)).toBe(0);
  });

  it("lượt tự luyện thứ 2 trở đi được nửa XP, làm tròn xuống", () => {
    expect(unitXp({ ...base, gradedCount: 10, correctCount: 7, attemptRound: 2 })).toBe(8);
    expect(unitXp({ ...base, manualAnswered: true, attemptRound: 3 })).toBe(10);
  });

  it("phần Nghe ẩn thanh audio được ×1.5, làm tròn xuống, trước khi giảm lượt sau", () => {
    expect(unitXp({ ...base, gradedCount: 10, correctCount: 7, audioHidden: true })).toBe(25);
    expect(unitXp({ ...base, gradedCount: 10, correctCount: 10, audioHidden: true })).toBe(30);
    expect(unitXp({ ...base, gradedCount: 10, correctCount: 7, audioHidden: true, attemptRound: 2 })).toBe(12);
    expect(unitXp({ ...base, audioHidden: true })).toBe(0);
  });
});

describe("vocabDayXp", () => {
  it("1 XP mỗi 2 thẻ, tối đa 15 XP/ngày", () => {
    expect(vocabDayXp(0)).toBe(0);
    expect(vocabDayXp(1)).toBe(0);
    expect(vocabDayXp(7)).toBe(3);
    expect(vocabDayXp(30)).toBe(15);
    expect(vocabDayXp(200)).toBe(15);
  });
});
