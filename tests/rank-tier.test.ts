import { describe, expect, it } from "vitest";
import { getTier, getTierProgress, TIERS } from "../lib/rank-tier";

describe("getTier", () => {
  it("map điểm về đúng bậc theo ngưỡng", () => {
    expect(getTier(0).key).toBe("plastic");
    expect(getTier(17).key).toBe("plastic");
    expect(getTier(18).key).toBe("aluminum");
    expect(getTier(29).key).toBe("aluminum");
    expect(getTier(30).key).toBe("bronze");
    expect(getTier(39).key).toBe("bronze");
    expect(getTier(40).key).toBe("silver");
    expect(getTier(54).key).toBe("silver");
    expect(getTier(55).key).toBe("gold");
    expect(getTier(69).key).toBe("gold");
    expect(getTier(70).key).toBe("platinum");
    expect(getTier(84).key).toBe("platinum");
    expect(getTier(85).key).toBe("diamond");
    expect(getTier(89).key).toBe("diamond");
    expect(getTier(90).key).toBe("master");
    expect(getTier(93).key).toBe("master");
    expect(getTier(94).key).toBe("grandmaster");
    expect(getTier(96).key).toBe("grandmaster");
    expect(getTier(97).key).toBe("challenger");
    expect(getTier(100).key).toBe("challenger");
  });

  it("TIERS có đủ 10 bậc, sắp tăng dần", () => {
    expect(TIERS.map((t) => t.key)).toEqual([
      "plastic",
      "aluminum",
      "bronze",
      "silver",
      "gold",
      "platinum",
      "diamond",
      "master",
      "grandmaster",
      "challenger",
    ]);
    for (let i = 1; i < TIERS.length; i += 1) {
      expect(TIERS[i].min).toBeGreaterThan(TIERS[i - 1].min);
    }
  });

  it("mỗi bậc có đủ nhãn, biểu tượng và lớp màu riêng", () => {
    for (const tier of TIERS) {
      expect(tier.label.length).toBeGreaterThan(0);
      expect(tier.icon.length).toBeGreaterThan(0);
      expect(tier.badgeClass).toContain("dark:");
    }
    // Không bậc nào trùng lớp màu, để hai bậc cạnh nhau không nhìn y hệt.
    expect(new Set(TIERS.map((t) => t.badgeClass)).size).toBe(TIERS.length);
    expect(new Set(TIERS.map((t) => t.icon)).size).toBe(TIERS.length);
  });

  it("năm bậc cũ giữ nguyên ngưỡng để không ai bị tụt oan", () => {
    const byKey = Object.fromEntries(TIERS.map((tier) => [tier.key, tier.min]));
    expect(byKey.silver).toBe(40);
    expect(byKey.gold).toBe(55);
    expect(byKey.platinum).toBe(70);
    expect(byKey.diamond).toBe(85);
  });
});

describe("getTierProgress", () => {
  it("bậc giữa: có cả điểm lên bậc kế và điểm kẻo tụt", () => {
    const p = getTierProgress(60); // gold (55..69)
    expect(p.tier.key).toBe("gold");
    expect(p.next?.key).toBe("platinum");
    expect(p.pointsToNext).toBe(10); // 70 - 60
    expect(p.pointsToDrop).toBe(5); // 60 - 55
  });

  it("Nhựa: không có bậc dưới để tụt", () => {
    const p = getTierProgress(10);
    expect(p.tier.key).toBe("plastic");
    expect(p.pointsToDrop).toBeNull();
    expect(p.next?.key).toBe("aluminum");
    expect(p.pointsToNext).toBe(8); // 18 - 10
  });

  it("Kim Cương nay đã có bậc trên để leo tiếp", () => {
    const p = getTierProgress(87);
    expect(p.tier.key).toBe("diamond");
    expect(p.next?.key).toBe("master");
    expect(p.pointsToNext).toBe(3); // 90 - 87
    expect(p.pointsToDrop).toBe(2); // 87 - 85
  });

  it("Thách Đấu: không có bậc trên", () => {
    const p = getTierProgress(98);
    expect(p.tier.key).toBe("challenger");
    expect(p.next).toBeNull();
    expect(p.pointsToNext).toBeNull();
    expect(p.pointsToDrop).toBe(1); // 98 - 97
  });
});
