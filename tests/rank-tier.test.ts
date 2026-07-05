import { describe, expect, it } from "vitest";
import { getTier, getTierProgress, TIERS } from "../lib/rank-tier";

describe("getTier", () => {
  it("map điểm về đúng bậc theo ngưỡng", () => {
    expect(getTier(0).key).toBe("bronze");
    expect(getTier(39).key).toBe("bronze");
    expect(getTier(40).key).toBe("silver");
    expect(getTier(54).key).toBe("silver");
    expect(getTier(55).key).toBe("gold");
    expect(getTier(69).key).toBe("gold");
    expect(getTier(70).key).toBe("platinum");
    expect(getTier(84).key).toBe("platinum");
    expect(getTier(85).key).toBe("diamond");
    expect(getTier(100).key).toBe("diamond");
  });

  it("TIERS có đủ 5 bậc, sắp tăng dần", () => {
    expect(TIERS.map((t) => t.key)).toEqual([
      "bronze",
      "silver",
      "gold",
      "platinum",
      "diamond",
    ]);
    for (let i = 1; i < TIERS.length; i += 1) {
      expect(TIERS[i].min).toBeGreaterThan(TIERS[i - 1].min);
    }
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

  it("Đồng: không có bậc dưới để tụt", () => {
    const p = getTierProgress(20);
    expect(p.tier.key).toBe("bronze");
    expect(p.pointsToDrop).toBeNull();
    expect(p.next?.key).toBe("silver");
    expect(p.pointsToNext).toBe(20); // 40 - 20
  });

  it("Kim Cương: không có bậc trên", () => {
    const p = getTierProgress(90);
    expect(p.tier.key).toBe("diamond");
    expect(p.next).toBeNull();
    expect(p.pointsToNext).toBeNull();
    expect(p.pointsToDrop).toBe(5); // 90 - 85
  });
});
