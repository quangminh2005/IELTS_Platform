import { describe, expect, it } from "vitest";
import {
  buildMonthlyRecap,
  buildXpBars,
  daysInMonth,
  monthKeyOf,
  monthName,
  monthNumberLabel,
  monthRange,
  recapMonthToShow,
  recentMonthKeys,
  resolveMonthKey,
  shiftMonthKey,
  studentRecapView,
  type RecapStudentInfo,
  type RecapUnitRow
} from "../lib/monthly-recap";

function student(id: string, displayName = id): RecapStudentInfo {
  return { id, displayName, avatarUrl: null, avatarPreset: null, userImage: null };
}

function unit(studentId: string, iso: string, extra: Partial<RecapUnitRow> = {}): RecapUnitRow {
  return {
    studentId,
    skill: "reading",
    submittedAt: new Date(iso),
    attemptRound: 1,
    gradedCount: 10,
    correctCount: 10,
    manualAnswered: false,
    ...extra
  };
}

describe("khoá tháng giờ VN", () => {
  it("23:30 ngày 30/9 VN thuộc tháng 9, 00:10 ngày 1/10 VN thuộc tháng 10", () => {
    expect(monthKeyOf(new Date("2026-09-30T16:30:00Z"))).toBe("2026-09");
    expect(monthKeyOf(new Date("2026-09-30T17:10:00Z"))).toBe("2026-10");
  });

  it("ranh giới tháng là nửa đêm giờ VN", () => {
    const { start, end } = monthRange("2026-09");
    expect(start.toISOString()).toBe("2026-08-31T17:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(monthRange("2026-12").end.toISOString()).toBe("2026-12-31T17:00:00.000Z");
  });

  it("dịch tháng qua năm, số ngày, tên tháng", () => {
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
    expect(daysInMonth("2026-09")).toBe(30);
    expect(daysInMonth("2028-02")).toBe(29);
    expect(monthName("2026-09")).toBe("Chín");
    expect(monthName("2026-11")).toBe("Mười Một");
    expect(monthNumberLabel("2026-09")).toBe("09/2026");
  });

  it("chọn tháng: chỉ nhận tháng trong danh sách, còn lại rơi về tháng mới nhất", () => {
    expect(recentMonthKeys("2026-09", 3)).toEqual(["2026-09", "2026-08", "2026-07"]);
    expect(resolveMonthKey("2026-08", "2026-09", 6)).toBe("2026-08");
    expect(resolveMonthKey("2026-10", "2026-09", 6)).toBe("2026-09");
    expect(resolveMonthKey("abc", "2026-09", 6)).toBe("2026-09");
    expect(resolveMonthKey(undefined, "2026-09", 6)).toBe("2026-09");
  });

  it("popup chỉ bật trong 7 ngày đầu tháng, cho tháng trước", () => {
    expect(recapMonthToShow(new Date("2026-10-03T05:00:00Z"))).toBe("2026-09");
    expect(recapMonthToShow(new Date("2026-10-07T16:00:00Z"))).toBe("2026-09"); // 23:00 ngày 7 VN
    expect(recapMonthToShow(new Date("2026-10-07T17:30:00Z"))).toBeNull(); // 00:30 ngày 8 VN
  });
});

describe("buildMonthlyRecap", () => {
  it("cộng XP theo phần + ôn từ, đếm ngày học và số phần theo kỹ năng", () => {
    const recap = buildMonthlyRecap({
      monthKey: "2026-09",
      units: [
        unit("a", "2026-09-02T03:00:00Z"), // 20 XP
        unit("a", "2026-09-02T04:00:00Z", { skill: "writing", gradedCount: 0, correctCount: 0, manualAnswered: true }) // 20 XP
      ],
      submits: [
        { studentId: "a", submittedAt: new Date("2026-09-02T03:00:00Z") },
        { studentId: "a", submittedAt: new Date("2026-09-05T03:00:00Z") }
      ],
      vocab: [{ studentId: "a", date: "2026-09-10", total: 10 }], // 5 XP
      students: [student("a")]
    });

    const entry = recap.entries[0];
    expect(entry.xp).toBe(45);
    expect(entry.activeDayKeys).toEqual(["2026-09-02", "2026-09-05", "2026-09-10"]);
    expect(entry.activeDays).toBe(3);
    expect(entry.unitsBySkill).toEqual({ reading: 1, writing: 1 });
    expect(entry.vocabCards).toBe(10);
    expect(recap.totalXp).toBe(45);
    expect(recap.participantCount).toBe(1);
    expect(recap.daysInMonth).toBe(30);
  });

  it("bỏ dữ liệu ngoài tháng (theo giờ VN)", () => {
    const recap = buildMonthlyRecap({
      monthKey: "2026-09",
      units: [unit("a", "2026-09-30T17:10:00Z")], // 00:10 ngày 1/10 VN
      submits: [{ studentId: "a", submittedAt: new Date("2026-09-30T17:10:00Z") }],
      vocab: [{ studentId: "a", date: "2026-10-01", total: 30 }],
      students: [student("a")]
    });

    expect(recap.entries).toEqual([]);
    expect(recap.totalXp).toBe(0);
  });

  it("đồng điểm thì đồng hạng (1, 2, 2, 4); chỉ học viên có XP vào bảng XP", () => {
    const recap = buildMonthlyRecap({
      monthKey: "2026-09",
      units: [
        unit("a", "2026-09-02T03:00:00Z"),
        unit("a", "2026-09-03T03:00:00Z"),
        unit("b", "2026-09-02T03:00:00Z"),
        unit("c", "2026-09-02T03:00:00Z"),
        unit("d", "2026-09-02T03:00:00Z", { correctCount: 0 })
      ],
      submits: [],
      vocab: [{ studentId: "e", date: "2026-09-04", total: 1 }], // có ngày học, 0 XP
      students: ["a", "b", "c", "d", "e"].map((id) => student(id))
    });

    expect(recap.xpBoard.map((e) => [e.studentId, e.xpRank])).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 2],
      ["d", 4]
    ]);
    expect(recap.participantCount).toBe(4);
    expect(recap.daysBoard.map((e) => e.studentId)).toContain("e");
    expect(recap.entries.find((e) => e.studentId === "e")?.xpRank).toBeNull();
  });

  it("bảng ngày học: nhiều ngày đứng trước, đồng ngày thì XP cao đứng trước nhưng vẫn đồng hạng", () => {
    const recap = buildMonthlyRecap({
      monthKey: "2026-09",
      units: [unit("b", "2026-09-02T03:00:00Z")],
      submits: [
        { studentId: "a", submittedAt: new Date("2026-09-02T03:00:00Z") },
        { studentId: "b", submittedAt: new Date("2026-09-02T03:00:00Z") },
        { studentId: "c", submittedAt: new Date("2026-09-02T03:00:00Z") },
        { studentId: "c", submittedAt: new Date("2026-09-03T03:00:00Z") }
      ],
      vocab: [],
      students: ["a", "b", "c"].map((id) => student(id))
    });

    expect(recap.daysBoard.map((e) => [e.studentId, e.daysRank])).toEqual([
      ["c", 1],
      ["b", 2],
      ["a", 2]
    ]);
  });

  it("bỏ học viên không còn hồ sơ", () => {
    const recap = buildMonthlyRecap({
      monthKey: "2026-09",
      units: [unit("ghost", "2026-09-02T03:00:00Z")],
      submits: [],
      vocab: [],
      students: []
    });

    expect(recap.entries).toEqual([]);
  });

  it("kết quả là JSON thuần (đi qua unstable_cache)", () => {
    const recap = buildMonthlyRecap({
      monthKey: "2026-09",
      units: [unit("a", "2026-09-02T03:00:00Z")],
      submits: [],
      vocab: [],
      students: [student("a")]
    });

    expect(JSON.parse(JSON.stringify(recap))).toEqual(recap);
  });
});

describe("studentRecapView", () => {
  const recapOf = (xpByStudent: Record<string, number>, monthKey = "2026-09") =>
    buildMonthlyRecap({
      monthKey,
      units: Object.entries(xpByStudent).flatMap(([id, count]) =>
        Array.from({ length: count }, () => unit(id, `${monthKey}-02T03:00:00Z`))
      ),
      submits: [],
      vocab: [],
      students: Object.keys(xpByStudent).map((id) => student(id))
    });

  it("% so tháng trước và Top P%", () => {
    const current = recapOf({ a: 3, b: 2, c: 1, d: 1 });
    const previous = recapOf({ a: 1 }, "2026-08");
    const view = studentRecapView(current, "b", previous);

    expect(view.entry?.xp).toBe(40);
    expect(view.previousXp).toBeNull();
    expect(view.topPercent).toBe(50); // hạng 2/4

    const viewA = studentRecapView(current, "a", previous);
    expect(viewA.previousXp).toBe(20);
    expect(viewA.changePercent).toBe(200);
    expect(viewA.topPercent).toBe(25);
  });

  it("học viên không có dữ liệu tháng → entry null", () => {
    const view = studentRecapView(recapOf({ a: 1 }), "zzz", null);
    expect(view.entry).toBeNull();
    expect(view.topPercent).toBeNull();
    expect(view.changePercent).toBeNull();
  });
});

describe("buildXpBars", () => {
  it("ít người: mỗi người một cột, cột cao nhất = 1", () => {
    const bars = buildXpBars([100, 50, 25], 1);
    expect(bars.heights).toEqual([1, 0.5, 0.25]);
    expect(bars.highlight).toBe(1);
  });

  it("đông người: gộp còn tối đa maxBars cột, vạch rơi đúng nhóm", () => {
    const values = Array.from({ length: 100 }, (_, i) => 100 - i);
    const bars = buildXpBars(values, 99, 10);
    expect(bars.heights).toHaveLength(10);
    expect(bars.highlight).toBe(9);
  });

  it("không có ai → rỗng", () => {
    expect(buildXpBars([], null)).toEqual({ heights: [], highlight: null });
  });
});
