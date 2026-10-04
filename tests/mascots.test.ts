import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  MASCOTS,
  MASCOT_IDS,
  MASCOT_POSES,
  POSE_IDS,
  mascotKey,
  ownsPose,
  poseKey,
  resolvePose
} from "../lib/mascots";

const read = (path: string) => readFileSync(path, "utf8");

describe("danh mục linh vật", () => {
  it("4 con × 6 tư thế, giá theo bảng thầy chốt", () => {
    expect(MASCOTS.map((m) => [m.id, m.price, m.rarity])).toEqual([
      ["owl", 600, "rare"],
      ["cat", 600, "rare"],
      ["fox", 1000, "epic"],
      ["dragon", 2000, "legendary"]
    ]);
    expect(MASCOT_POSES.map((p) => [p.id, p.price, p.streakDays])).toEqual([
      ["idle", 0, null],
      ["wave", 100, null],
      ["read", 150, null],
      ["cheer", 250, null],
      ["sleep", 400, 15],
      ["signature", 800, 30]
    ]);
  });

  it("mã khớp danh sách id", () => {
    expect(MASCOTS.map((m) => m.id)).toEqual([...MASCOT_IDS]);
    expect(MASCOT_POSES.map((p) => p.id)).toEqual([...POSE_IDS]);
  });
});

describe("resolvePose", () => {
  it("tư thế thường + tư thế đinh lấy tên riêng", () => {
    expect(resolvePose("pose:owl:wave")).toMatchObject({ name: "Vẫy tay", mascot: { id: "owl" } });
    expect(resolvePose("pose:dragon:signature")?.name).toBe("Phun lửa");
  });

  it("mã lạ → null", () => {
    for (const key of [null, "", "pose:owl", "pose:bat:wave", "pose:owl:fly", "mascot:owl", "x:owl:wave"]) {
      expect(resolvePose(key)).toBeNull();
    }
  });
});

describe("ownsPose", () => {
  it("Đứng yên đi kèm con, tư thế khác cần dòng riêng", () => {
    const owned = new Set([mascotKey("owl"), poseKey("owl", "wave")]);
    expect(ownsPose(owned, poseKey("owl", "idle"))).toBe(true);
    expect(ownsPose(owned, poseKey("owl", "wave"))).toBe(true);
    expect(ownsPose(owned, poseKey("owl", "read"))).toBe(false);
    expect(ownsPose(owned, poseKey("cat", "idle"))).toBe(false);
  });

  it("có dòng tư thế nhưng không có con → chưa có", () => {
    expect(ownsPose(new Set([poseKey("fox", "wave")]), poseKey("fox", "wave"))).toBe(false);
  });
});

describe("hình vẽ linh vật", () => {
  const art = read("components/shop/mascot-art.tsx");

  it("vẽ đủ mọi con + mọi tư thế", () => {
    for (const id of MASCOT_IDS) expect(art).toMatch(new RegExp(`\\b${id}:`));
    for (const pose of POSE_IDS) expect(art).toMatch(new RegExp(`\\b${pose}:`));
  });

  it("không dùng defs/id (nhiều bản trên một trang)", () => {
    expect(art).not.toContain("<defs");
    expect(art).not.toMatch(/\sid=/);
  });

  it("hoạt ảnh chỉ chạy trong motion-safe", () => {
    expect(art).not.toMatch(/(?<!motion-safe:)animate-mascot/);
  });
});

describe("linh vật — schema, ensure-db, action", () => {
  it("cột equippedMascot có ở schema + ensure-db; nguồn streak trong comment", () => {
    expect(read("prisma/schema.prisma")).toMatch(/equippedMascot\s+String\?/);
    expect(read("prisma/schema.prisma")).toMatch(/\/\/ enum ItemSource[^\n]*streak/);
    expect(read("scripts/ensure-db.mjs")).toContain('ADD COLUMN IF NOT EXISTS "equippedMascot" TEXT');
  });

  it("mọi action requireStudent đầu tiên, ghi Xu dưới khoá dòng", () => {
    const source = read("lib/actions/mascot.ts");
    const bodies = source.split("export async function").slice(1);
    expect(bodies.length).toBe(3);
    for (const body of bodies) {
      expect(body).toMatch(
        /^\s*\w+\(formData: FormData\): Promise<ActionResult> \{\s*try \{\s*const student = await requireStudent\(\);/
      );
    }
    expect(source).toContain("lockStudent(tx, student.id)");
    expect(source).toContain("recomputeCoins(tx, student.id)");
    expect(source).not.toMatch(/increment|decrement/);
  });

  it("mở bằng chuỗi kiểm chuỗi ngày ngay trong transaction", () => {
    expect(read("lib/actions/mascot.ts")).toContain("getDayStreak(student.id, new Date(), tx)");
  });
});
