import { describe, expect, it } from "vitest";
import { activeDayKeys, buildActivityDays } from "@/lib/activity-heatmap";
import { calculateDayStreak, dayRestoreKey, restoredDayOf } from "@/lib/day-streak";
import { schoolDayStreaks } from "@/lib/leaderboard";

const today = "2026-10-05";
const at = (iso: string) => new Date(iso);

const input = {
  submits: [
    { studentId: "a", submittedAt: at("2026-10-05T08:00:00+07:00") },
    { studentId: "a", submittedAt: at("2026-10-04T23:30:00+07:00") },
    { studentId: "a", submittedAt: at("2026-10-03T07:00:00+07:00") },
    { studentId: "b", submittedAt: at("2026-10-04T09:00:00+07:00") },
    { studentId: "b", submittedAt: at("2026-10-02T09:00:00+07:00") }
  ],
  vocabDays: [
    { studentId: "b", date: "2026-10-03", total: 4 },
    { studentId: "c", date: "2026-10-01", total: 2 },
    { studentId: "c", date: "2026-10-04", total: 0 }
  ],
  restoreKeys: [
    { studentId: "c", key: dayRestoreKey("2026-10-04") },
    // Khoá tuần cũ (Đợt 2) không phải ngày cứu — phải bị bỏ qua.
    { studentId: "c", key: "restore:2026-09-28" }
  ]
};

describe("schoolDayStreaks — chuỗi ngày của cả trường tính một lượt", () => {
  it("mỗi em ra đúng chuỗi", () => {
    const result = schoolDayStreaks(input, today);
    expect(result.get("a")).toEqual({ days: 3, activeToday: true });
    expect(result.get("b")).toEqual({ days: 3, activeToday: false });
    // c: ngày 4 đã cứu bằng Xu, ngày 3 không học → chuỗi 1 ngày.
    expect(result.get("c")).toEqual({ days: 1, activeToday: false });
  });

  it("trùng với cách tính riêng từng em (bất biến với getDayStreak)", () => {
    const result = schoolDayStreaks(input, today);

    for (const id of ["a", "b", "c"]) {
      const days = buildActivityDays({
        submits: input.submits.filter((row) => row.studentId === id).map((row) => row.submittedAt),
        vocabDays: input.vocabDays.filter((row) => row.studentId === id)
      });
      const restoredDays = input.restoreKeys
        .filter((row) => row.studentId === id)
        .map((row) => restoredDayOf(row.key))
        .filter((day): day is string => day !== null);

      expect(result.get(id)).toEqual(
        calculateDayStreak({ activeDays: activeDayKeys(days), restoredDays, today })
      );
    }
  });

  it("em không có dữ liệu thì không có trong kết quả", () => {
    expect(schoolDayStreaks(input, today).has("zz")).toBe(false);
  });
});
