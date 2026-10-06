import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PRIZE_START_MONTH,
  monthlyPrizeEntries,
  monthlyPrizeFor,
  prizeMonthKeys
} from "@/lib/leaderboard";
import type { MonthlyRecap, RecapEntry } from "@/lib/monthly-recap";
import { XP_EARN_KINDS } from "@/lib/xp-rank";

function read(relative: string): string {
  return readFileSync(join(process.cwd(), ...relative.split("/")), "utf8").replace(/\r\n/g, "\n");
}

function recapWith(monthKey: string, ranks: number[]): MonthlyRecap {
  const entries: RecapEntry[] = ranks.map((xpRank, index) => ({
    studentId: `s${index}`,
    displayName: `S${index}`,
    avatarUrl: null,
    avatarPreset: null,
    userImage: null,
    xp: 100 - index,
    activeDays: 1,
    activeDayKeys: [],
    unitsBySkill: {},
    vocabCards: 0,
    xpRank,
    daysRank: null
  }));
  return {
    monthKey,
    daysInMonth: 31,
    totalXp: 0,
    participantCount: entries.length,
    entries,
    xpBoard: entries,
    daysBoard: []
  };
}

describe("thưởng Xu Học Bá tháng", () => {
  it.each([
    [1, 300],
    [2, 200],
    [3, 150],
    [4, 50],
    [10, 50],
    [11, 0],
    [0, 0]
  ])("hạng %i → %i Xu", (rank, amount) => {
    expect(monthlyPrizeFor(rank)).toBe(amount);
  });

  it("chưa có hạng (0 XP) → 0 Xu", () => {
    expect(monthlyPrizeFor(null)).toBe(0);
  });

  it("chỉ các tháng ĐÃ KHÉP từ tháng 10/2026", () => {
    expect(PRIZE_START_MONTH).toBe("2026-10");
    expect(prizeMonthKeys(new Date("2026-10-15T12:00:00+07:00"))).toEqual([]);
    expect(prizeMonthKeys(new Date("2026-11-01T12:00:00+07:00"))).toEqual(["2026-10"]);
    expect(prizeMonthKeys(new Date("2027-01-05T12:00:00+07:00"))).toEqual(["2026-10", "2026-11", "2026-12"]);
  });

  it("đồng hạng nhận cùng mức thưởng, có thể quá 10 em", () => {
    const now = new Date("2026-11-01T12:00:00+07:00");
    const entries = monthlyPrizeEntries(recapWith("2026-10", [1, 2, 2, 4, 5, 6, 7, 8, 9, 10, 10, 12]), now);
    expect(entries.map((entry) => entry.draft.amount)).toEqual([300, 200, 200, 50, 50, 50, 50, 50, 50, 50, 50]);
    expect(entries[1]).toEqual({
      studentId: "s1",
      draft: {
        kind: "monthly_prize",
        key: "prize:xp:2026-10",
        amount: 200,
        note: "Hạng #2 Học Bá tháng 10/2026",
        attemptId: null,
        createdAt: now
      }
    });
  });

  it("tháng trước mốc bắt đầu không có thưởng (không hồi tố)", () => {
    expect(monthlyPrizeEntries(recapWith("2026-09", [1, 2, 3]), new Date())).toEqual([]);
  });

  it("Xu thưởng KHÔNG tính vào XP hạng đấu", () => {
    expect(XP_EARN_KINDS as readonly string[]).not.toContain("monthly_prize");
  });

  it("kind monthly_prize có trong schema comment + CoinKind", () => {
    expect(read("prisma/schema.prisma")).toMatch(/\/\/ enum CoinKind[^\n]*monthly_prize/);
    expect(read("lib/coins.ts")).toContain('"monthly_prize"');
  });

  it("cron cộng thưởng, syncWallet dự phòng, script hồi tố truyền sẵn danh sách", () => {
    const cron = read("app/api/cron/reminders/route.ts");
    expect(cron).toContain("grantMonthlyPrizes(getMonthlyRecap)");
    // Chỗ kiểm cấu hình mail return sớm — cộng thưởng phải chạy trước nó.
    expect(cron.indexOf("grantMonthlyPrizes(getMonthlyRecap)")).toBeLessThan(cron.indexOf("isEmailConfigured()"));
    expect(read("lib/wallet.ts")).toContain("loadMonthlyPrizeEntries(getMonthlyRecap, now)");
    expect(read("scripts/coins-backfill.ts")).toContain("loadMonthlyPrizeEntries(loadMonthlyRecap)");
  });
});
