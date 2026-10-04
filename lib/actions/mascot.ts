"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudent } from "@/lib/actions/attempts";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { purchaseKey } from "@/lib/coins";
import { getDayStreak } from "@/lib/day-streak-data";
import { findMascot, mascotKey, ownsPose, resolvePose } from "@/lib/mascots";
import { prisma } from "@/lib/prisma";
import { lockStudent, recomputeCoins } from "@/lib/wallet";

const numberFormat = new Intl.NumberFormat("vi-VN");

function revalidateMascotPages() {
  revalidatePath("/student/shop");
  revalidatePath("/student/profile");
  // Linh vật đứng trong thẻ 🔥 trang chủ + chip Xu ở layout học viên.
  revalidatePath("/student", "layout");
}

function shortOfCoins(price: number, coins: number): Error {
  return new Error(`Không đủ Xu — còn thiếu ${numberFormat.format(price - coins)} Xu.`);
}

// Mua con: kèm sẵn tư thế "Đứng yên" và tự trang bị luôn nếu đang chưa có linh vật.
export async function buyMascot(formData: FormData): Promise<ActionResult> {
  try {
    const student = await requireStudent();
    const mascot = findMascot(z.string().max(20).parse(formData.get("mascotId")));
    if (!mascot) throw new Error("Không tìm thấy linh vật này.");

    const itemKey = mascotKey(mascot.id);

    await prisma.$transaction(async (tx) => {
      await lockStudent(tx, student.id);

      const [owned, profile] = await Promise.all([
        tx.studentItem.findUnique({ where: { studentId_itemKey: { studentId: student.id, itemKey } } }),
        tx.studentProfile.findUniqueOrThrow({
          where: { id: student.id },
          select: { coins: true, equippedMascot: true }
        })
      ]);

      if (owned) throw new Error("Bạn đã có linh vật này rồi.");
      if (profile.coins < mascot.price) throw shortOfCoins(mascot.price, profile.coins);

      await tx.coinTransaction.create({
        data: {
          studentId: student.id,
          kind: "purchase",
          key: purchaseKey(itemKey),
          amount: -mascot.price,
          note: `Mua linh vật ${mascot.name}`
        }
      });
      await tx.studentItem.create({ data: { studentId: student.id, itemKey, source: "purchase" } });
      if (!profile.equippedMascot) {
        await tx.studentProfile.update({
          where: { id: student.id },
          data: { equippedMascot: `pose:${mascot.id}:idle` }
        });
      }
      await recomputeCoins(tx, student.id);
    });

    revalidateMascotPages();
    return actionOk(`Đã mua ${mascot.name}!`);
  } catch (error) {
    return actionFail(error, "Mua linh vật");
  }
}

const unlockSchema = z.object({
  poseKey: z.string().max(60),
  via: z.enum(["coins", "streak"])
});

// Mở một tư thế: bằng Xu, hoặc bằng chuỗi ngày HIỆN TẠI đủ N ngày (tính dưới khoá dòng).
// Phải có con trước. Mở rồi thì giữ mãi, kể cả khi chuỗi đứt sau đó.
export async function unlockPose(formData: FormData): Promise<ActionResult> {
  try {
    const student = await requireStudent();
    const parsed = unlockSchema.parse({ poseKey: formData.get("poseKey"), via: formData.get("via") });
    const resolved = resolvePose(parsed.poseKey);
    if (!resolved || resolved.pose.id === "idle") throw new Error("Tư thế này không hợp lệ.");

    const { mascot, pose, name } = resolved;
    const label = `${name} (${mascot.name})`;

    await prisma.$transaction(async (tx) => {
      await lockStudent(tx, student.id);

      const ownedRows = await tx.studentItem.findMany({
        where: { studentId: student.id, itemKey: { in: [mascotKey(mascot.id), resolved.key] } },
        select: { itemKey: true }
      });
      const owned = new Set(ownedRows.map((row) => row.itemKey));

      if (!owned.has(mascotKey(mascot.id))) throw new Error(`Mua ${mascot.name} trước đã nhé.`);
      if (ownsPose(owned, resolved.key)) throw new Error("Bạn đã mở tư thế này rồi.");

      if (parsed.via === "streak") {
        if (pose.streakDays === null) throw new Error("Tư thế này chỉ mở bằng Xu.");
        const { streak } = await getDayStreak(student.id, new Date(), tx);
        if (streak.days < pose.streakDays) {
          throw new Error(`Cần chuỗi ${pose.streakDays} ngày — bạn đang có ${streak.days} ngày.`);
        }
        await tx.studentItem.create({ data: { studentId: student.id, itemKey: resolved.key, source: "streak" } });
        return;
      }

      const profile = await tx.studentProfile.findUniqueOrThrow({
        where: { id: student.id },
        select: { coins: true }
      });
      if (profile.coins < pose.price) throw shortOfCoins(pose.price, profile.coins);

      await tx.coinTransaction.create({
        data: {
          studentId: student.id,
          kind: "purchase",
          key: purchaseKey(resolved.key),
          amount: -pose.price,
          note: `Mở tư thế ${label}`
        }
      });
      await tx.studentItem.create({ data: { studentId: student.id, itemKey: resolved.key, source: "purchase" } });
      await recomputeCoins(tx, student.id);
    });

    revalidateMascotPages();
    return actionOk(`Đã mở tư thế ${name}!`);
  } catch (error) {
    return actionFail(error, "Mở tư thế");
  }
}

// Trang bị một tư thế đã có; chuỗi rỗng = cất linh vật.
export async function equipMascot(formData: FormData): Promise<ActionResult> {
  try {
    const student = await requireStudent();
    const key = z.string().max(60).parse(formData.get("poseKey") ?? "");

    if (key === "") {
      await prisma.studentProfile.update({ where: { id: student.id }, data: { equippedMascot: null } });
      revalidateMascotPages();
      return actionOk("Đã cất linh vật.");
    }

    const resolved = resolvePose(key);
    if (!resolved) throw new Error("Tư thế này không hợp lệ.");

    const ownedRows = await prisma.studentItem.findMany({
      where: { studentId: student.id, itemKey: { in: [mascotKey(resolved.mascot.id), key] } },
      select: { itemKey: true }
    });
    if (!ownsPose(new Set(ownedRows.map((row) => row.itemKey)), key)) {
      throw new Error("Bạn chưa mở tư thế này.");
    }

    await prisma.studentProfile.update({ where: { id: student.id }, data: { equippedMascot: key } });
    revalidateMascotPages();
    return actionOk(`Đã trang bị ${resolved.mascot.name} · ${resolved.name}.`);
  } catch (error) {
    return actionFail(error, "Trang bị linh vật");
  }
}
