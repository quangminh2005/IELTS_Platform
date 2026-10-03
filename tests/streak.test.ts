import { describe, expect, it } from "vitest";
import {
  calculateWeekStreak,
  formatWeekRange,
  restoreKey,
  restoredWeekOf,
  streakRestoreOffer,
  streakRestorePrice,
  vnWeekStart,
  weekKeyToDateKey
} from "../lib/streak";

describe("vnWeekStart", () => {
  it("các ngày trong cùng tuần VN có cùng khóa", () => {
    // Thứ 2 06/07 và Chủ Nhật 12/07 (giờ VN) cùng một tuần
    const mon = new Date("2026-07-06T09:00:00+07:00");
    const sun = new Date("2026-07-12T23:00:00+07:00");
    expect(vnWeekStart(mon)).toBe(vnWeekStart(sun));
  });

  it("xử lý đúng biên timezone (đầu Thứ 2 giờ VN = Chủ Nhật giờ UTC)", () => {
    // 00:30 Thứ 2 06/07 giờ VN == 17:30 Chủ Nhật 05/07 giờ UTC — vẫn phải thuộc tuần bắt đầu 06/07
    const earlyMondayVN = new Date("2026-07-05T17:30:00Z");
    const wedVN = new Date("2026-07-08T10:00:00+07:00");
    expect(vnWeekStart(earlyMondayVN)).toBe(vnWeekStart(wedVN));
  });

  it("tuần khác nhau có khóa khác nhau", () => {
    const thisWeek = new Date("2026-07-08T10:00:00+07:00");
    const lastWeek = new Date("2026-07-01T10:00:00+07:00");
    expect(vnWeekStart(thisWeek)).not.toBe(vnWeekStart(lastWeek));
  });
});

describe("calculateWeekStreak", () => {
  const now = new Date("2026-07-08T10:00:00+07:00"); // Thứ 4, tuần bắt đầu 06/07

  it("tuần hiện tại đủ N + các tuần trước đủ N → đếm cả tuần hiện tại", () => {
    const r = calculateWeekStreak({
      weeklyGoal: 2,
      now,
      submittedAt: [
        new Date("2026-07-07T08:00:00+07:00"), // tuần này
        new Date("2026-07-08T08:00:00+07:00"), // tuần này
        new Date("2026-06-30T08:00:00+07:00"), // tuần trước
        new Date("2026-07-01T08:00:00+07:00"), // tuần trước
        new Date("2026-06-23T08:00:00+07:00"), // 2 tuần trước (chỉ 1 bài)
      ],
    });
    expect(r.currentWeekCount).toBe(2);
    expect(r.atRisk).toBe(false);
    expect(r.weeks).toBe(2); // tuần này + tuần trước; 2-tuần-trước chỉ 1 bài -> dừng
  });

  it("tuần hiện tại CHƯA đủ N → không tính đứt (grace), chuỗi giữ theo tuần trước", () => {
    const r = calculateWeekStreak({
      weeklyGoal: 2,
      now,
      submittedAt: [
        new Date("2026-07-07T08:00:00+07:00"), // tuần này: 1 bài (thiếu)
        new Date("2026-06-30T08:00:00+07:00"), // tuần trước: 2 bài
        new Date("2026-07-01T08:00:00+07:00"),
        new Date("2026-06-23T08:00:00+07:00"), // 2 tuần trước: 2 bài
        new Date("2026-06-24T08:00:00+07:00"),
      ],
    });
    expect(r.currentWeekCount).toBe(1);
    expect(r.atRisk).toBe(true);
    expect(r.weeks).toBe(2); // grace: bỏ qua tuần hiện tại còn dở, đếm 2 tuần trước
  });

  it("tuần đã qua thiếu N → chuỗi đứt (về 0)", () => {
    const r = calculateWeekStreak({
      weeklyGoal: 2,
      now,
      submittedAt: [
        new Date("2026-06-30T08:00:00+07:00"), // tuần trước: chỉ 1 bài
      ],
    });
    expect(r.weeks).toBe(0);
    expect(r.currentWeekCount).toBe(0);
    expect(r.atRisk).toBe(true);
  });

  it("không có bài nào → weeks 0", () => {
    const r = calculateWeekStreak({ weeklyGoal: 3, now, submittedAt: [] });
    expect(r.weeks).toBe(0);
    expect(r.currentWeekCount).toBe(0);
    expect(r.atRisk).toBe(true);
    expect(r.weeklyGoal).toBe(3);
  });
});

describe("khôi phục chuỗi tuần bằng Xu", () => {
  const now = new Date("2026-07-08T10:00:00+07:00"); // Thứ 4, tuần bắt đầu 06/07
  const twoIn = (...days: string[]) =>
    days.flatMap((day) => [new Date(`${day}T08:00:00+07:00`), new Date(`${day}T09:00:00+07:00`)]);

  it("khoá tuần đổi ra ngày Thứ 2 giờ VN", () => {
    expect(weekKeyToDateKey(vnWeekStart(now))).toBe("2026-07-06");
    expect(weekKeyToDateKey(vnWeekStart(new Date("2026-07-05T17:30:00Z")))).toBe("2026-07-06");
  });

  it("tuần đã cứu được tính là đạt → chuỗi nối qua tuần lỡ", () => {
    const r = calculateWeekStreak({
      weeklyGoal: 2,
      now,
      submittedAt: twoIn("2026-06-23", "2026-06-16"), // T−1 (29/6) trống
      restoredWeeks: ["2026-06-29"]
    });
    expect(r.weeks).toBe(3);
  });

  it("T−1 lỡ, T−2 + T−3 đạt → mời cứu, giữ 2 tuần", () => {
    const offer = streakRestoreOffer({
      weeklyGoal: 2,
      now,
      submittedAt: twoIn("2026-06-23", "2026-06-16"),
      restoredWeeks: []
    });
    expect(offer).toEqual({ weekKey: "2026-06-29", lostWeeks: 2 });
  });

  it("T−2 là tuần đã cứu vẫn cho cứu tiếp", () => {
    const offer = streakRestoreOffer({
      weeklyGoal: 2,
      now,
      submittedAt: twoIn("2026-06-16"),
      restoredWeeks: ["2026-06-22"]
    });
    expect(offer).toEqual({ weekKey: "2026-06-29", lostWeeks: 2 });
  });

  it("không mời cứu khi T−1 đạt, khi T−2 cũng lỡ, hoặc T−1 đã cứu", () => {
    const base = { weeklyGoal: 2, now };
    expect(streakRestoreOffer({ ...base, submittedAt: twoIn("2026-06-30", "2026-06-23"), restoredWeeks: [] })).toBeNull();
    expect(streakRestoreOffer({ ...base, submittedAt: twoIn("2026-06-16"), restoredWeeks: [] })).toBeNull();
    expect(
      streakRestoreOffer({ ...base, submittedAt: twoIn("2026-06-23"), restoredWeeks: ["2026-06-29"] })
    ).toBeNull();
    expect(streakRestoreOffer({ ...base, submittedAt: [], restoredWeeks: [] })).toBeNull();
  });

  it("tuần T−1 thiếu 1 bài vẫn tính là lỡ (đếm theo chỉ tiêu)", () => {
    const offer = streakRestoreOffer({
      weeklyGoal: 2,
      now,
      submittedAt: [new Date("2026-06-30T08:00:00+07:00"), ...twoIn("2026-06-23")],
      restoredWeeks: []
    });
    expect(offer).toEqual({ weekKey: "2026-06-29", lostWeeks: 1 });
  });

  it("giá gấp đôi theo số lần đã cứu trong tháng", () => {
    expect(streakRestorePrice(0)).toBe(100);
    expect(streakRestorePrice(1)).toBe(200);
    expect(streakRestorePrice(2)).toBe(400);
    expect(streakRestorePrice(3)).toBe(800);
  });

  it("khoá sổ + nhãn tuần", () => {
    expect(restoreKey("2026-09-22")).toBe("restore:2026-09-22");
    expect(restoredWeekOf("restore:2026-09-22")).toBe("2026-09-22");
    expect(restoredWeekOf("buy:bg:aurora")).toBeNull();
    expect(formatWeekRange("2026-09-22")).toBe("22/9–28/9");
    expect(formatWeekRange("2026-09-29")).toBe("29/9–5/10");
  });
});
