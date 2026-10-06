import { describe, expect, it } from "vitest";
import {
  STREAK_TIERS,
  boardWindow,
  formatCountdown,
  monthEndsIn,
  rankBoard,
  rankingHref,
  rankingMonthNav,
  resolveRankingParams,
  scopeBoard,
  streakBoardEntries,
  streakTier,
  streakTierProgress,
  xpBoardEntries,
  type StreakBoardSource,
  type XpBoardSource
} from "@/lib/leaderboard";

const person = (studentId: string, displayName = studentId) => ({
  studentId,
  displayName,
  avatarUrl: null,
  avatarPreset: null,
  userImage: null,
  equippedFrame: null
});

describe("cấp lửa của bảng Chuỗi", () => {
  it("7 cấp, ngưỡng đúng như chin", () => {
    expect(STREAK_TIERS.map((tier) => tier.minDays)).toEqual([1, 3, 7, 14, 30, 60, 100]);
    expect(STREAK_TIERS.map((tier) => tier.name)).toEqual([
      "Nhen",
      "Bén",
      "Cháy",
      "Đuốc",
      "Lửa Trại",
      "Hải Đăng",
      "Bất Diệt"
    ]);
  });

  it.each([
    [0, null],
    [1, "Nhen"],
    [2, "Nhen"],
    [3, "Bén"],
    [99, "Hải Đăng"],
    [100, "Bất Diệt"],
    [500, "Bất Diệt"]
  ])("%i ngày → %s", (days, name) => {
    expect(streakTier(days)?.name ?? null).toBe(name);
  });

  it("tiến trình lên cấp kế", () => {
    expect(streakTierProgress(0)).toMatchObject({ current: null, daysToNext: 1 });
    expect(streakTierProgress(0).next?.name).toBe("Nhen");
    expect(streakTierProgress(10).current?.name).toBe("Cháy");
    expect(streakTierProgress(10).next?.name).toBe("Đuốc");
    expect(streakTierProgress(10).daysToNext).toBe(4);
    expect(streakTierProgress(100)).toMatchObject({ next: null, daysToNext: null });
  });
});

describe("rankBoard / scopeBoard", () => {
  const rows = [
    { ...person("a", "An"), v: 50 },
    { ...person("b", "Bình"), v: 80 },
    { ...person("c", "Chi"), v: 50 },
    { ...person("d", "Dũng"), v: 0 },
    { ...person("e", "Én"), v: 20 }
  ];

  it("giảm dần, đồng giá trị đồng hạng, hạng sau nhảy cóc, bỏ giá trị 0", () => {
    const ranked = rankBoard(rows, (row) => row.v);
    expect(ranked.map((row) => [row.studentId, row.rank])).toEqual([
      ["b", 1],
      ["a", 2],
      ["c", 2],
      ["e", 4]
    ]);
  });

  it("lọc theo lớp rồi xếp hạng lại trong lớp", () => {
    const ranked = scopeBoard(rows, new Set(["a", "c", "e"]), (row) => row.v);
    expect(ranked.map((row) => [row.studentId, row.rank])).toEqual([
      ["a", 1],
      ["c", 1],
      ["e", 3]
    ]);
  });

  it("memberIds null = toàn trường", () => {
    expect(scopeBoard(rows, null, (row) => row.v)).toHaveLength(4);
  });
});

describe("dòng bảng", () => {
  it("Học Bá: XP định dạng vi-VN, chip hạng đấu theo XP trọn đời", () => {
    const rows: XpBoardSource[] = [{ ...person("a"), xp: 1234, activeDays: 12 }];
    const [entry] = xpBoardEntries(rows, null, new Map([["a", 600]]));
    expect(entry).toMatchObject({
      rank: 1,
      valueText: "1.234 XP",
      subText: "12 ngày học",
      chip: { kind: "rank", xp: 600 }
    });
  });

  it("Học Bá: không mang field thừa (activeDayKeys…) ra giao diện", () => {
    const rows = [{ ...person("a"), xp: 10, activeDays: 1, activeDayKeys: ["2026-10-01"] }];
    expect(Object.keys(xpBoardEntries(rows, null, new Map())[0])).not.toContain("activeDayKeys");
  });

  it("Chuỗi: nhắc 'Chưa học hôm nay' khi hôm nay chưa học", () => {
    const rows: StreakBoardSource[] = [
      { ...person("a"), days: 5, activeToday: false },
      { ...person("b"), days: 9, activeToday: true }
    ];
    const entries = streakBoardEntries(rows, null);
    expect(entries.map((entry) => [entry.studentId, entry.valueText, entry.subText])).toEqual([
      ["b", "9 ngày", null],
      ["a", "5 ngày", "Chưa học hôm nay"]
    ]);
    expect(entries[0].chip).toEqual({ kind: "fire", days: 9 });
  });
});

describe("boardWindow (khối trang chủ)", () => {
  const entries = streakBoardEntries(
    ["a", "b", "c", "d", "e", "f", "g"].map((id, index) => ({
      ...person(id),
      days: 10 - index,
      activeToday: true
    })),
    null
  );

  it("mình trong top → không ghim thêm", () => {
    const window = boardWindow(entries, "b", 5);
    expect(window.top).toHaveLength(5);
    expect(window.me).toBeNull();
  });

  it("mình ngoài top → ghim dòng của mình", () => {
    expect(boardWindow(entries, "g", 5).me?.studentId).toBe("g");
  });

  it("mình không có trong bảng → me null", () => {
    expect(boardWindow(entries, "zz", 5).me).toBeNull();
  });
});

describe("đếm ngược hết tháng (giờ VN)", () => {
  it("10h sáng 5/10 → còn 26 ngày 14 giờ", () => {
    const left = monthEndsIn(new Date("2026-10-05T10:00:00+07:00"));
    expect(left).toEqual({ days: 26, hours: 14, minutes: 0 });
    expect(formatCountdown(left)).toBe("26 ngày 14 giờ");
  });

  it("23h30 ngày 31/10 giờ VN → còn 30 phút", () => {
    expect(formatCountdown(monthEndsIn(new Date("2026-10-31T23:30:00+07:00")))).toBe("00 giờ 30 phút");
  });
});

describe("tham số trang Xếp hạng", () => {
  const context = { classIds: ["c1", "c2"], latestMonth: "2026-10" };

  it("mặc định: Học Bá, toàn trường, lớp gần nhất, tháng hiện tại", () => {
    expect(resolveRankingParams(undefined, context)).toEqual({
      board: "xp",
      scope: "school",
      classId: "c1",
      monthKey: "2026-10"
    });
  });

  it("giá trị lạ về mặc định; lớp không phải của mình về lớp mặc định", () => {
    expect(
      resolveRankingParams({ board: "hack", scope: "x", classId: "c-khac", month: "2020-01" }, context)
    ).toEqual({ board: "xp", scope: "school", classId: "c1", monthKey: "2026-10" });
  });

  it("nhận đúng giá trị hợp lệ", () => {
    expect(
      resolveRankingParams({ board: "streak", scope: "class", classId: "c2", month: "2026-08" }, context)
    ).toEqual({ board: "streak", scope: "class", classId: "c2", monthKey: "2026-08" });
  });

  it("chưa có lớp → classId null", () => {
    expect(resolveRankingParams(undefined, { classIds: [], latestMonth: "2026-10" }).classId).toBeNull();
  });

  it("link bỏ tham số mặc định, chỉ giữ tháng ở bảng Học Bá", () => {
    const linkContext = { latestMonth: "2026-10", defaultClassId: "c1" };
    expect(
      rankingHref({ board: "xp", scope: "school", classId: "c1", monthKey: "2026-10" }, linkContext)
    ).toBe("/student/ranking");
    expect(
      rankingHref({ board: "streak", scope: "class", classId: "c2", monthKey: "2026-08" }, linkContext)
    ).toBe("/student/ranking?board=streak&scope=class&classId=c2");
    expect(
      rankingHref({ board: "xp", scope: "school", classId: "c1", monthKey: "2026-09" }, linkContext)
    ).toBe("/student/ranking?month=2026-09");
  });

  it("chuyển tháng: lùi tối đa 6 tháng, không tới tương lai", () => {
    expect(rankingMonthNav("2026-10", "2026-10")).toEqual({ prev: "2026-09", next: null });
    expect(rankingMonthNav("2026-05", "2026-10")).toEqual({ prev: null, next: "2026-06" });
  });
});
