import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_LEVELS, TOTAL_LEVELS, XP_EARN_KINDS, XP_RANKS, getXpProgress, levelName, rankMax } from "@/lib/xp-rank";

function read(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), "utf8").replace(/\r\n/g, "\n");
}

describe("bảng hạng đấu XP", () => {
  it("7 hạng, đúng 27 cấp, ngưỡng tăng nghiêm ngặt, bắt đầu từ 0", () => {
    expect(XP_RANKS).toHaveLength(7);
    expect(TOTAL_LEVELS).toBe(27);
    expect(ALL_LEVELS[0].min).toBe(0);
    for (let i = 1; i < ALL_LEVELS.length; i += 1) {
      expect(ALL_LEVELS[i].min).toBeGreaterThan(ALL_LEVELS[i - 1].min);
    }
  });

  it("mỗi hạng tối đa 6 cấp (đủ số La Mã), trần = ngưỡng hạng sau − 1", () => {
    for (const rank of XP_RANKS) expect(rank.levels.length).toBeLessThanOrEqual(6);
    expect(rankMax(0)).toBe(XP_RANKS[1].levels[0] - 1);
    expect(rankMax(XP_RANKS.length - 1)).toBeNull();
  });
});

describe("getXpProgress", () => {
  it("0 XP = Đồng I, còn 60 XP lên Đồng II", () => {
    const p = getXpProgress(0);
    expect(levelName(p.current)).toBe("Đồng I");
    expect(levelName(p.next!)).toBe("Đồng II");
    expect(p.xpToNext).toBe(60);
    expect(p.percent).toBe(0);
  });

  it("đúng ngưỡng là lên cấp ngay; giữa hai ngưỡng tính % trong cấp", () => {
    expect(levelName(getXpProgress(500).current)).toBe("Bạc I");
    expect(levelName(getXpProgress(499).current)).toBe("Đồng V");
    const mid = getXpProgress(625); // giữa 500 và 750
    expect(levelName(mid.current)).toBe("Bạc I");
    expect(mid.percent).toBe(50);
  });

  it("ví dụ prod 5/10/2026: 405 → Đồng V, 646 → Bạc I, 2.625 → Vàng III", () => {
    expect(levelName(getXpProgress(405).current)).toBe("Đồng V");
    expect(levelName(getXpProgress(646).current)).toBe("Bạc I");
    expect(levelName(getXpProgress(2625).current)).toBe("Vàng III");
  });

  it("cấp cuối: không còn cấp kế, 100%", () => {
    const top = getXpProgress(1_000_000);
    expect(levelName(top.current)).toBe("Thách Đấu III");
    expect(top.next).toBeNull();
    expect(top.xpToNext).toBeNull();
    expect(top.percent).toBe(100);
  });

  it("XP âm / lẻ không làm vỡ", () => {
    expect(getXpProgress(-50).xp).toBe(0);
    expect(getXpProgress(59.9).current.levelIndex).toBe(0);
  });
});

describe("nguồn XP", () => {
  it("chỉ tính dòng KIẾM ĐƯỢC của sổ Xu — mua đồ / cứu chuỗi / đổi quà không trừ hạng", () => {
    expect([...XP_EARN_KINDS].sort()).toEqual(["earn_unit", "earn_vocab"]);
    const data = read("lib", "xp-rank-data.ts");
    expect(data).toContain("XP_EARN_KINDS");
    expect(data).toMatch(/coinTransaction\.(aggregate|groupBy)/);
  });

  it("module hạng 10 bậc cũ theo điểm xếp hạng đã gỡ", () => {
    for (const path of [
      ["app", "student", "page.tsx"],
      ["app", "student", "profile", "page.tsx"],
      ["components", "class-ranking-board.tsx"]
    ]) {
      expect(read(...path)).not.toContain("rank-tier\"");
      expect(read(...path)).not.toContain("getTierProgress");
    }
  });

  it("trang chi tiết đọc hệ số kiếm XP từ monthly-xp, không gõ cứng", () => {
    const page = read("app", "student", "ranks", "page.tsx");
    for (const name of ["XP_UNIT_BASE", "XP_UNIT_ACCURACY_MAX", "XP_MANUAL_UNIT", "XP_VOCAB_DAILY_CAP"]) {
      expect(page).toContain(name);
    }
  });
});
