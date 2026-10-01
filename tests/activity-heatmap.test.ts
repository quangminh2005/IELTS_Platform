import { describe, expect, it } from "vitest";
import {
  activityLevel,
  buildActivityDays,
  buildHeatmapGrid,
  describeActivityDay,
  heatmapStartKey,
  pickActivityMessage,
  summarizeActivity,
  type ActivityDay,
  type ActivitySummary
} from "../lib/activity-heatmap";

// 1/10/2026 là Thứ Năm.
const today = "2026-10-01";

function daysOf(entries: Record<string, number>): Map<string, ActivityDay> {
  return new Map(
    Object.entries(entries).map(([date, count]) => [
      date,
      { submits: count, vocabCards: 0, count }
    ])
  );
}

const baseSummary: ActivitySummary = {
  activeDays: 10,
  currentStreak: 0,
  activeToday: false,
  longestStreak: 4,
  daysSinceLast: 1,
  recentActiveDays: 8,
  recentMaxCount: 2
};

describe("buildActivityDays", () => {
  it("gom lượt nộp theo ngày giờ VN (17:00 UTC đã sang ngày mới)", () => {
    const days = buildActivityDays({
      submits: [
        new Date("2026-09-30T16:59:00Z"), // 23:59 ngày 30/9 giờ VN
        new Date("2026-09-30T17:00:00Z"), // 00:00 ngày 1/10 giờ VN
        new Date("2026-09-30T20:00:00Z")
      ],
      vocabDays: []
    });

    expect(days.get("2026-09-30")).toEqual({ submits: 1, vocabCards: 0, count: 1 });
    expect(days.get("2026-10-01")).toEqual({ submits: 2, vocabCards: 0, count: 2 });
  });

  it("ôn Sổ từ: có ôn = 1 việc, từ 20 thẻ = 2 việc, 0 thẻ không tính", () => {
    const days = buildActivityDays({
      submits: [new Date("2026-09-29T03:00:00Z")],
      vocabDays: [
        { date: "2026-09-29", total: 5 },
        { date: "2026-09-28", total: 20 },
        { date: "2026-09-27", total: 0 }
      ]
    });

    expect(days.get("2026-09-29")).toEqual({ submits: 1, vocabCards: 5, count: 2 });
    expect(days.get("2026-09-28")).toEqual({ submits: 0, vocabCards: 20, count: 2 });
    expect(days.has("2026-09-27")).toBe(false);
  });
});

describe("activityLevel", () => {
  it("chia 5 mức: 0 / 1 / 2 / 3–4 / từ 5", () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(activityLevel)).toEqual([0, 1, 2, 3, 3, 4, 4]);
  });
});

describe("buildHeatmapGrid", () => {
  it("53 cột, cột đầu bắt đầu Thứ 2 cách đây 52 tuần", () => {
    expect(heatmapStartKey(today)).toBe("2025-09-29");

    const weeks = buildHeatmapGrid({ days: new Map(), today });
    expect(weeks).toHaveLength(53);
    expect(weeks[0].cells[0]?.date).toBe("2025-09-29");
    expect(weeks.every((week) => week.cells.length === 7)).toBe(true);
  });

  it("cột cuối là tuần hiện tại, ô sau hôm nay để trống", () => {
    const weeks = buildHeatmapGrid({ days: new Map(), today });
    const last = weeks[weeks.length - 1];

    expect(last.cells.map((cell) => cell?.date ?? null)).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      null,
      null,
      null
    ]);
  });

  it("nhãn tháng nằm ở cột chứa ngày 1", () => {
    const weeks = buildHeatmapGrid({ days: new Map(), today });

    expect(weeks[0].monthLabel).toBe("Th10");
    expect(weeks[1].monthLabel).toBeNull();
    expect(weeks[48].monthLabel).toBe("Th9");
    expect(weeks[52].monthLabel).toBe("Th10");
  });

  it("ô mang số việc và mức màu của ngày", () => {
    const weeks = buildHeatmapGrid({ days: daysOf({ "2026-09-30": 3 }), today });
    const cell = weeks[52].cells[2];

    expect(cell).toMatchObject({ date: "2026-09-30", count: 3, level: 3 });
    expect(weeks[52].cells[1]).toMatchObject({ count: 0, level: 0 });
  });
});

describe("summarizeActivity", () => {
  it("chưa học ngày nào", () => {
    expect(summarizeActivity({ days: new Map(), today })).toEqual({
      activeDays: 0,
      currentStreak: 0,
      activeToday: false,
      longestStreak: 0,
      daysSinceLast: null,
      recentActiveDays: 0,
      recentMaxCount: 0
    });
  });

  it("hôm nay chưa học thì chuỗi hiện tại vẫn giữ từ hôm qua", () => {
    const summary = summarizeActivity({
      days: daysOf({ "2026-09-30": 1, "2026-09-29": 1, "2026-09-27": 2 }),
      today
    });

    expect(summary.currentStreak).toBe(2);
    expect(summary.activeToday).toBe(false);
    expect(summary.daysSinceLast).toBe(1);
    expect(summary.activeDays).toBe(3);
  });

  it("chuỗi dài nhất tính trong cửa sổ, bỏ ngày ngoài cửa sổ", () => {
    const summary = summarizeActivity({
      days: daysOf({
        "2025-09-27": 1, // trước cửa sổ
        "2025-09-28": 1, // trước cửa sổ
        "2025-09-29": 1,
        "2026-03-01": 1,
        "2026-03-02": 1,
        "2026-03-03": 1,
        "2026-10-01": 1
      }),
      today
    });

    expect(summary.activeDays).toBe(5);
    expect(summary.longestStreak).toBe(3);
    expect(summary.currentStreak).toBe(1);
    expect(summary.activeToday).toBe(true);
    expect(summary.daysSinceLast).toBe(0);
  });

  it("28 ngày gần nhất: số ngày học và ngày nhiều việc nhất", () => {
    const summary = summarizeActivity({
      days: daysOf({ "2026-09-04": 9, "2026-09-05": 5, "2026-09-20": 4 }),
      today
    });

    // 28 ngày gần nhất bắt đầu từ 4/9 (1/10 lùi 27 ngày) — 4/9 vẫn được tính.
    expect(summary.recentActiveDays).toBe(3);
    expect(summary.recentMaxCount).toBe(9);
  });
});

describe("pickActivityMessage", () => {
  it("bảng trắng", () => {
    expect(pickActivityMessage({ ...baseSummary, activeDays: 0, daysSinceLast: null })).toContain(
      "trắng tinh"
    );
  });

  it("chuỗi từ 7 ngày", () => {
    expect(
      pickActivityMessage({ ...baseSummary, currentStreak: 8, activeToday: true, daysSinceLast: 0 })
    ).toBe("8 ngày liền không nghỉ — phong độ quá! 🔥");
  });

  it("nghỉ từ 3 ngày", () => {
    expect(pickActivityMessage({ ...baseSummary, daysSinceLast: 4 })).toBe(
      "Đã 4 ngày chưa mở sách — ôn 10 thẻ cho ấm tay nhé 🙂"
    );
  });

  it("học dồn", () => {
    expect(
      pickActivityMessage({ ...baseSummary, recentActiveDays: 3, recentMaxCount: 5 })
    ).toContain("học dồn");
  });

  it("chuỗi từ 3 ngày", () => {
    expect(
      pickActivityMessage({ ...baseSummary, currentStreak: 3, activeToday: true, daysSinceLast: 0 })
    ).toBe("Chuỗi 3 ngày — giữ lửa nhé!");
  });

  it("hôm nay đã học", () => {
    expect(
      pickActivityMessage({ ...baseSummary, currentStreak: 1, activeToday: true, daysSinceLast: 0 })
    ).toContain("Hôm nay đã có ô xanh");
  });

  it("hôm nay chưa học", () => {
    expect(pickActivityMessage(baseSummary)).toContain("Hôm nay chưa có ô xanh");
  });
});

describe("describeActivityDay", () => {
  it("ghi thứ, ngày, số bài và số thẻ", () => {
    expect(
      describeActivityDay({ date: "2026-09-29", submits: 2, vocabCards: 14, count: 3, level: 3 })
    ).toBe("Thứ Ba 29/9 · 2 bài · ôn 14 thẻ");
  });

  it("ngày trống", () => {
    expect(
      describeActivityDay({ date: "2026-09-27", submits: 0, vocabCards: 0, count: 0, level: 0 })
    ).toBe("Chủ nhật 27/9 · chưa học");
  });
});
