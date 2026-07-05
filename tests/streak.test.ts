import { describe, expect, it } from "vitest";
import { calculateWeekStreak, vnWeekStart } from "../lib/streak";

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
