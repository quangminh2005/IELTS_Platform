import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  ACHIEVEMENT_TEMPLATES,
  ART_KEYS,
  SHOP_ITEMS,
  achievementItemsFor,
  closedMonthKeys,
  resolveItem
} from "../lib/shop-catalog";
import type { MonthlyRecap, RecapEntry } from "../lib/monthly-recap";

describe("danh mục đồ", () => {
  it("không trùng mã, mã có tiền tố đúng loại", () => {
    const keys = SHOP_ITEMS.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);

    for (const item of SHOP_ITEMS) {
      expect(item.key.startsWith(item.category === "frame" ? "frame:" : "bg:")).toBe(true);
      expect(item.key).not.toContain("@");
    }
  });

  it("đồ bán có giá > 0; không có đồ thành tích trong danh sách bán", () => {
    for (const item of SHOP_ITEMS) {
      expect(item.rarity).not.toBe("achievement");
      expect(item.price).toBeGreaterThan(0);
    }
  });

  it("đủ 11 nền + 7 khung", () => {
    expect(SHOP_ITEMS.filter((item) => item.category === "background")).toHaveLength(11);
    expect(SHOP_ITEMS.filter((item) => item.category === "frame")).toHaveLength(7);
  });
});

describe("resolveItem", () => {
  it("đồ thường", () => {
    expect(resolveItem("bg:aurora")).toMatchObject({
      name: "Cực quang",
      artKey: "bg:aurora",
      monthKey: null,
      price: 1200
    });
  });

  it("đồ thành tích kèm tháng: không giá, tên có tháng", () => {
    expect(resolveItem("frame:champion@2026-09")).toMatchObject({
      name: "Quán quân tháng 9/2026",
      category: "frame",
      rarity: "achievement",
      price: null,
      artKey: "frame:champion",
      monthKey: "2026-09"
    });
  });

  it("mã lạ / sai định dạng → null", () => {
    expect(resolveItem("bg:khong-co")).toBeNull();
    expect(resolveItem("frame:champion@2026-9")).toBeNull();
    expect(resolveItem("frame:wood@2026-09")).toBeNull();
    expect(resolveItem("frame:champion")).toBeNull();
    expect(resolveItem(null)).toBeNull();
  });
});

describe("đồ thành tích tháng", () => {
  it("closedMonthKeys: từ 2026-07 tới tháng trước", () => {
    expect(closedMonthKeys(new Date("2026-10-03T05:00:00Z"))).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(closedMonthKeys(new Date("2026-07-15T05:00:00Z"))).toEqual([]);
  });

  function entry(studentId: string, xpRank: number | null, daysRank: number | null): RecapEntry {
    return {
      studentId,
      displayName: studentId,
      avatarUrl: null,
      avatarPreset: null,
      userImage: null,
      xp: 1,
      activeDays: 1,
      activeDayKeys: [],
      unitsBySkill: {},
      vocabCards: 0,
      xpRank,
      daysRank
    };
  }

  function recap(entries: RecapEntry[]): MonthlyRecap {
    return {
      monthKey: "2026-09",
      daysInMonth: 30,
      totalXp: 0,
      participantCount: 0,
      entries,
      xpBoard: [],
      daysBoard: []
    };
  }

  it("hạng 1 mỗi bảng nhận đồ; đồng hạng nhất đều nhận", () => {
    const items = achievementItemsFor(recap([entry("a", 1, 2), entry("b", 2, 1), entry("c", 3, 1)]));
    expect(items).toEqual([
      { studentId: "a", itemKey: "frame:champion@2026-09" },
      { studentId: "b", itemKey: "bg:diligent@2026-09" },
      { studentId: "c", itemKey: "bg:diligent@2026-09" }
    ]);
  });

  it("bảng rỗng → không ai", () => {
    expect(achievementItemsFor(recap([]))).toEqual([]);
  });
});

describe("mọi đồ đều có hình, hình không dùng id", () => {
  // Đọc lúc chạy test (không phải lúc nạp file) để lỗi thiếu file chỉ làm hỏng
  // đúng khối này.
  const sources = () => [
    readFileSync("components/shop/frame-art.tsx", "utf8"),
    readFileSync("components/shop/background-art.tsx", "utf8")
  ];

  it.each(ART_KEYS)("có hình cho %s", (key) => {
    expect(sources().join(" ")).toContain(`"${key}":`);
  });

  it("không <defs>, không id= (avatar vẽ 2 lần trong AppShell)", () => {
    for (const source of sources()) {
      expect(source).not.toContain("<defs");
      expect(source).not.toMatch(/\sid=/);
    }
  });

  it("hiệu ứng động chỉ trong motion-safe", () => {
    for (const source of sources()) {
      expect(source).not.toMatch(/(^|[\s"'`])animate-/);
    }
  });

  it("ART_KEYS gồm cả mẫu đồ thành tích", () => {
    for (const template of ACHIEVEMENT_TEMPLATES) {
      expect(ART_KEYS).toContain(template.baseKey);
    }
  });
});
