import { describe, expect, it } from "vitest";
import {
  countWords,
  judgePart,
  missAmount,
  planPracticeGoalLedger,
  practiceGoalFirstWeek,
  practiceGoalPercent,
  practiceWeeks,
  recentWeeks,
  vnWeekKey,
  weekEndsAt,
  weekLabel,
  type PracticePart
} from "@/lib/practice-goal";

const vn = (iso: string) => new Date(`${iso}+07:00`);

function part(over: Partial<PracticePart> = {}): PracticePart {
  return {
    skill: "reading",
    submittedAt: vn("2026-10-13T20:00:00"),
    seconds: 600,
    questionCount: 13,
    answeredCount: 13,
    isEssay: false,
    writingWords: 0,
    ...over
  };
}

describe("tuần giờ VN", () => {
  it("CN 23:59 VN thuộc tuần trước, T2 00:00 VN thuộc tuần mới", () => {
    expect(vnWeekKey(vn("2026-10-18T23:59:00"))).toBe("2026-10-12");
    expect(vnWeekKey(vn("2026-10-19T00:00:00"))).toBe("2026-10-19");
  });
  it("tuần kết thúc lúc T2 00:00 VN tuần sau", () => {
    expect(weekEndsAt("2026-10-12").toISOString()).toBe("2026-10-18T17:00:00.000Z");
  });
  it("nhãn tuần", () => {
    expect(weekLabel("2026-10-12")).toBe("12/10–18/10");
  });
});

describe("judgePart — làm thật", () => {
  it("dưới 3 phút → too_short", () => {
    expect(judgePart(part({ seconds: 179 }))).toBe("too_short");
  });
  it("trả lời dưới 50% → too_few_answers", () => {
    expect(judgePart(part({ questionCount: 13, answeredCount: 6 }))).toBe("too_few_answers");
  });
  it("đúng 50% → ok", () => {
    expect(judgePart(part({ questionCount: 10, answeredCount: 5 }))).toBe("ok");
  });
  it("Viết luận dưới 50 từ → too_few_answers, đủ 50 → ok", () => {
    const essay = { skill: "writing", isEssay: true, questionCount: 1, answeredCount: 1 };
    expect(judgePart(part({ ...essay, writingWords: 49 }))).toBe("too_few_answers");
    expect(judgePart(part({ ...essay, writingWords: 50 }))).toBe("ok");
  });
  it("phần không có câu nào → too_few_answers", () => {
    expect(judgePart(part({ questionCount: 0, answeredCount: 0 }))).toBe("too_few_answers");
  });
});

describe("countWords", () => {
  it("đếm theo khoảng trắng, bỏ rỗng", () => {
    expect(countWords("  Hello   world\nthis is\tme ")).toBe(5);
    expect(countWords("")).toBe(0);
  });
});

describe("practiceWeeks", () => {
  const now = vn("2026-10-21T10:00:00"); // thứ Tư tuần 19/10

  it("chỉ từ tuần 12/10, mới nhất trước, tuần hiện tại chưa kết thúc", () => {
    const weeks = practiceWeeks([], 1, now);
    expect(weeks.map((w) => w.weekKey)).toEqual(["2026-10-19", "2026-10-12"]);
    expect(weeks[0].ended).toBe(false);
    expect(weeks[1].ended).toBe(true);
  });
  it("trước mốc áp dụng thì không có tuần nào", () => {
    expect(practiceWeeks([], 1, vn("2026-10-11T10:00:00"))).toEqual([]);
  });
  it("luyện lại cùng phần 2 lần → 2 phần; phần không đạt đếm theo lý do", () => {
    const weeks = practiceWeeks(
      [part(), part(), part({ seconds: 30 }), part({ answeredCount: 0 })],
      2,
      now
    );
    const w = weeks.find((x) => x.weekKey === "2026-10-12")!;
    expect(w.done).toBe(2);
    expect(w.met).toBe(true);
    expect(w.rejected).toEqual({ too_short: 1, too_few_answers: 1 });
  });
  it("bỏ phần nộp sau `now` và trước mốc áp dụng", () => {
    const weeks = practiceWeeks(
      [part({ submittedAt: vn("2026-10-22T10:00:00") }), part({ submittedAt: vn("2026-10-05T10:00:00") })],
      1,
      now
    );
    expect(weeks.every((w) => w.done === 0)).toBe(true);
  });
  it("chỉ tiêu 0 → mọi tuần met", () => {
    expect(practiceWeeks([], 0, now).every((w) => w.met)).toBe(true);
  });
  it("recentWeeks lấy tối đa 4 tuần mới nhất", () => {
    const weeks = practiceWeeks([], 1, vn("2026-11-20T10:00:00"));
    expect(recentWeeks(weeks).map((w) => w.weekKey)).toEqual([
      "2026-11-16",
      "2026-11-09",
      "2026-11-02",
      "2026-10-26"
    ]);
  });
});

describe("practiceGoalPercent", () => {
  const now = vn("2026-10-28T10:00:00"); // tuần 26/10 đang chạy
  it("chưa có tuần nào được xét → 100", () => {
    expect(practiceGoalPercent(practiceWeeks([], 1, vn("2026-10-14T10:00:00")), 1)).toBe(100);
  });
  it("tuần hiện tại chưa đạt không bị xét; tuần đã qua trượt bị xét", () => {
    // 12/10 đạt, 19/10 trượt, 26/10 (đang chạy) chưa đạt → 1/2 = 50
    const weeks = practiceWeeks([part()], 1, now);
    expect(practiceGoalPercent(weeks, 1)).toBe(50);
  });
  it("tuần hiện tại đã đạt thì được xét", () => {
    const weeks = practiceWeeks([part(), part({ submittedAt: vn("2026-10-27T09:00:00") })], 1, now);
    expect(practiceGoalPercent(weeks, 1)).toBe(67);
  });
  it("chỉ tiêu 0 → 100", () => {
    expect(practiceGoalPercent(practiceWeeks([], 0, now), 0)).toBe(100);
  });
});

describe("planPracticeGoalLedger", () => {
  const now = vn("2026-10-21T10:00:00");
  it("tuần đạt chưa thưởng → goal; tuần đã qua trượt → miss; tuần đang chạy chưa đạt → không gì", () => {
    const weeks = practiceWeeks([], 1, now);
    expect(planPracticeGoalLedger(weeks, 1, new Set())).toEqual([
      { kind: "practice_miss", key: "practice-miss:2026-10-12", weekKey: "2026-10-12" }
    ]);
  });
  it("đã có thưởng tuần đó → không trừ dù giờ không còn đạt (thầy nâng chỉ tiêu)", () => {
    const weeks = practiceWeeks([part()], 3, now);
    expect(planPracticeGoalLedger(weeks, 3, new Set(["practice-goal:2026-10-12"]))).toEqual([]);
  });
  it("không ghi trùng", () => {
    const weeks = practiceWeeks([part()], 1, now);
    expect(planPracticeGoalLedger(weeks, 1, new Set(["practice-goal:2026-10-12"]))).toEqual([]);
  });
  it("thứ tự cũ → mới để trừ tính theo số dư lần lượt", () => {
    const weeks = practiceWeeks([part({ submittedAt: vn("2026-10-20T10:00:00") })], 1, vn("2026-11-04T10:00:00"));
    expect(planPracticeGoalLedger(weeks, 1, new Set()).map((s) => s.key)).toEqual([
      "practice-miss:2026-10-12",
      "practice-goal:2026-10-19",
      "practice-miss:2026-10-26"
    ]);
  });
  it("chỉ tiêu 0 → không gì", () => {
    expect(planPracticeGoalLedger(practiceWeeks([], 0, now), 0, new Set())).toEqual([]);
  });
});

describe("missAmount", () => {
  it("không để âm", () => {
    expect(missAmount(100)).toBe(-30);
    expect(missAmount(12)).toBe(-12);
    expect(missAmount(0)).toBe(0);
    expect(missAmount(-5)).toBe(0);
  });
});

describe("tuần bắt đầu tính riêng từng em (miễn rồi bật lại / em mới)", () => {
  it("practiceGoalFirstWeek: tuần SAU mốc bắt đầu, không sớm hơn mốc áp dụng", () => {
    expect(practiceGoalFirstWeek(null)).toBe("2026-10-12");
    expect(practiceGoalFirstWeek(vn("2026-09-01T10:00:00"))).toBe("2026-10-12");
    expect(practiceGoalFirstWeek(vn("2026-10-28T10:00:00"))).toBe("2026-11-02");
  });

  it("tuần trước tuần bắt đầu không tồn tại → không bị trừ, không tính vào xếp hạng", () => {
    const now = vn("2026-11-04T10:00:00");
    const weeks = practiceWeeks([], 1, now, "2026-11-02");
    expect(weeks.map((w) => w.weekKey)).toEqual(["2026-11-02"]);
    expect(planPracticeGoalLedger(weeks, 1, new Set())).toEqual([]);
    expect(practiceGoalPercent(weeks, 1)).toBe(100);
  });
});
