import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

// Thân từng action trong lib/actions/rewards.ts, theo tên.
function actionBodies(): Map<string, string> {
  const bodies = new Map<string, string>();
  for (const chunk of read("lib/actions/rewards.ts").split("export async function ").slice(1)) {
    bodies.set(chunk.slice(0, chunk.indexOf("(")), chunk);
  }
  return bodies;
}

describe("Đổi quà — schema + hạ tầng", () => {
  it("schema có 2 model + comment enum", () => {
    const schema = read("prisma/schema.prisma");
    expect(schema).toContain("model Reward {");
    expect(schema).toContain("model RewardRedemption {");
    expect(schema).toMatch(/\/\/ enum CoinKind[^\n]*reward_redeem \| reward_refund/);
    expect(schema).toContain("// enum RewardLimitPeriod");
    expect(schema).toContain("// enum RedemptionStatus");
  });

  it("ensure-db tạo 2 bảng (thiếu là prod sập)", () => {
    const ensureDb = read("scripts/ensure-db.mjs");
    expect(ensureDb).toContain('CREATE TABLE IF NOT EXISTS "Reward"');
    expect(ensureDb).toContain('CREATE TABLE IF NOT EXISTS "RewardRedemption"');
    expect(ensureDb).toContain("RewardRedemption_rewardId_fkey");
  });

  it("blob-orphans biết ảnh quà (không thì lần dọn xoá mất)", () => {
    expect(read("scripts/blob-orphans.mjs")).toContain('SELECT "imageUrl" FROM "Reward"');
  });
});

describe("Đổi quà — actions", () => {
  const bodies = actionBodies();

  it.each(["redeemReward", "cancelRedemption"])("%s mở đầu bằng requireStudent", (name) => {
    expect(bodies.get(name)).toMatch(/^\w+\(formData: FormData\): Promise<ActionResult> \{\s*try \{\s*const student = await requireStudent\(\);/);
  });

  it.each(["saveReward", "toggleRewardActive", "deleteReward", "deliverRedemption", "rejectRedemption"])(
    "%s mở đầu bằng requireTeacher",
    (name) => {
      expect(bodies.get(name)).toMatch(/^\w+\(formData: FormData\): Promise<ActionResult> \{\s*try \{\s*const teacher = await requireTeacher\(\);/);
    }
  );

  it("đổi quà: khoá học viên + khoá món + đặt lại số dư", () => {
    const redeem = bodies.get("redeemReward") ?? "";
    expect(redeem).toContain("lockStudent(tx, student.id)");
    expect(redeem).toMatch(/FROM "Reward" WHERE "id" = \$\{rewardId\} FOR UPDATE/);
    expect(redeem).toContain('kind: "reward_redeem"');
    expect(redeem).toContain("recomputeCoins(tx, student.id)");
  });

  it("hoàn Xu chỉ khi phiếu còn pending (không hoàn hai lần)", () => {
    const source = read("lib/actions/rewards.ts");
    expect(source).toMatch(/updateMany\(\{\s*where: \{[^}]*status: "pending"/);
    expect(source).toContain('kind: "reward_refund"');
  });

  it("thầy chỉ thao tác trên món của mình", () => {
    for (const name of ["saveReward", "toggleRewardActive", "deleteReward", "deliverRedemption", "rejectRedemption"]) {
      expect(bodies.get(name)).toContain("teacher.id");
    }
  });
});
