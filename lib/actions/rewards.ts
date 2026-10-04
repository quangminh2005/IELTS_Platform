"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudent } from "@/lib/actions/attempts";
import { requireTeacher } from "@/lib/actions/classes";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import {
  ACTIVE_REDEMPTION_STATUSES,
  LIMIT_PERIOD_LABELS,
  redeemKey,
  refundKey,
  remainingStock,
  rewardCardState,
  studentLimitReached
} from "@/lib/rewards";
import { lockStudent, recomputeCoins } from "@/lib/wallet";

// Quà ngoài đời (Xu Đợt 3). Học viên đổi → trừ Xu ngay, phiếu "pending"; thầy trao
// (delivered) hoặc từ chối (rejected, hoàn Xu); em tự huỷ phiếu chờ (cancelled, hoàn Xu).

const numberFormat = new Intl.NumberFormat("vi-VN");

function revalidateRewardPages() {
  revalidatePath("/student/shop");
  revalidatePath("/teacher/rewards");
  // Chip Xu (layout học viên) + số đỏ phiếu chờ (layout thầy).
  revalidatePath("/student", "layout");
  revalidatePath("/teacher", "layout");
}

const idSchema = z.string().min(1).max(40);

// Đặt phiếu về trạng thái cuối + ghi dòng hoàn Xu. Chỉ phiếu còn "pending" mới đổi
// được (updateMany có điều kiện) → bấm hai lần cũng không hoàn hai lần.
async function refundPendingRedemption(
  tx: Prisma.TransactionClient,
  redemption: { id: string; studentId: string; price: number; rewardName: string },
  status: "rejected" | "cancelled",
  teacherNote: string | null
): Promise<void> {
  await lockStudent(tx, redemption.studentId);

  const updated = await tx.rewardRedemption.updateMany({
    where: { id: redemption.id, status: "pending" },
    data: { status, teacherNote, resolvedAt: new Date() }
  });
  if (updated.count === 0) throw new Error("Phiếu này đã được xử lý rồi.");

  await tx.coinTransaction.create({
    data: {
      studentId: redemption.studentId,
      kind: "reward_refund",
      key: refundKey(redemption.id),
      amount: redemption.price,
      note: `Hoàn Xu — ${redemption.rewardName} (${status === "rejected" ? "thầy từ chối" : "em huỷ"})`
    }
  });
  await recomputeCoins(tx, redemption.studentId);
}

// ---------- Học viên ----------

export async function redeemReward(formData: FormData): Promise<ActionResult> {
  try {
    const student = await requireStudent();
    const rewardId = idSchema.parse(formData.get("rewardId"));
    const now = new Date();

    const rewardName = await prisma.$transaction(async (tx) => {
      // Khoá học viên (số dư) và khoá món (tranh suất cuối cùng) tới hết transaction.
      await lockStudent(tx, student.id);
      await tx.$queryRaw`SELECT "id" FROM "Reward" WHERE "id" = ${rewardId} FOR UPDATE`;

      const reward = await tx.reward.findUnique({ where: { id: rewardId } });
      if (!reward || !reward.active) throw new Error("Món quà này không còn nhận đổi.");

      const [activeCount, mine, profile] = await Promise.all([
        tx.rewardRedemption.count({
          where: { rewardId, status: { in: [...ACTIVE_REDEMPTION_STATUSES] } }
        }),
        tx.rewardRedemption.findMany({
          where: { rewardId, studentId: student.id, status: { in: [...ACTIVE_REDEMPTION_STATUSES] } },
          select: { createdAt: true }
        }),
        tx.studentProfile.findUniqueOrThrow({ where: { id: student.id }, select: { coins: true } })
      ]);

      const state = rewardCardState({
        active: reward.active,
        price: reward.price,
        coins: profile.coins,
        remaining: remainingStock(reward.stock, activeCount),
        limitReached: studentLimitReached({
          limitPerStudent: reward.limitPerStudent,
          limitPeriod: reward.limitPeriod,
          redemptionDates: mine.map((row) => row.createdAt),
          now
        })
      });

      if (state === "sold_out") throw new Error("Món này đã hết.");
      if (state === "limit") {
        const period = reward.limitPeriod === "ever" ? LIMIT_PERIOD_LABELS.ever : LIMIT_PERIOD_LABELS.month;
        throw new Error(`Em đã đổi món này đủ ${reward.limitPerStudent} lần ${period}.`);
      }
      if (state === "short") {
        throw new Error(`Không đủ Xu — còn thiếu ${numberFormat.format(reward.price - profile.coins)} Xu.`);
      }

      const redemption = await tx.rewardRedemption.create({
        data: {
          rewardId,
          studentId: student.id,
          rewardName: reward.name,
          rewardEmoji: reward.emoji,
          price: reward.price
        }
      });
      await tx.coinTransaction.create({
        data: {
          studentId: student.id,
          kind: "reward_redeem",
          key: redeemKey(redemption.id),
          amount: -reward.price,
          note: `Đổi quà ${reward.name}`
        }
      });
      await recomputeCoins(tx, student.id);
      return reward.name;
    });

    revalidateRewardPages();
    return actionOk(`Đã đổi ${rewardName}! Thầy sẽ trao quà cho em sớm.`);
  } catch (error) {
    return actionFail(error, "Đổi quà");
  }
}

export async function cancelRedemption(formData: FormData): Promise<ActionResult> {
  try {
    const student = await requireStudent();
    const redemptionId = idSchema.parse(formData.get("redemptionId"));

    const redemption = await prisma.rewardRedemption.findFirst({
      where: { id: redemptionId, studentId: student.id },
      select: { id: true, studentId: true, price: true, rewardName: true }
    });
    if (!redemption) throw new Error("Không tìm thấy phiếu này.");

    await prisma.$transaction((tx) => refundPendingRedemption(tx, redemption, "cancelled", null));

    revalidateRewardPages();
    return actionOk(`Đã huỷ phiếu và hoàn ${numberFormat.format(redemption.price)} Xu.`);
  } catch (error) {
    return actionFail(error, "Huỷ phiếu");
  }
}

// ---------- Thầy ----------

// Ô số để trống = không giới hạn (null).
const optionalCount = (max: number) =>
  z.preprocess(
    (value) => (value === null || value === undefined || String(value).trim() === "" ? null : value),
    z.coerce.number().int().min(1).max(max).nullable()
  );

const rewardSchema = z.object({
  id: z.string().max(40).optional(),
  emoji: z.string().trim().min(1, "Chọn một emoji.").max(16),
  imageUrl: z
    .string()
    .trim()
    .max(500)
    .refine((value) => value === "" || value.startsWith("https://"), "Link ảnh không hợp lệ."),
  name: z.string().trim().min(1, "Nhập tên món quà.").max(80),
  description: z.string().trim().max(300),
  price: z.coerce.number().int().min(1, "Giá phải từ 1 Xu.").max(100000),
  stock: optionalCount(10000),
  limitPerStudent: optionalCount(100),
  limitPeriod: z.enum(["month", "ever"])
});

export async function saveReward(formData: FormData): Promise<ActionResult> {
  try {
    const teacher = await requireTeacher();
    const parsed = rewardSchema.parse({
      id: formData.get("id") || undefined,
      emoji: formData.get("emoji") ?? "",
      imageUrl: formData.get("imageUrl") ?? "",
      name: formData.get("name") ?? "",
      description: formData.get("description") ?? "",
      price: formData.get("price"),
      stock: formData.get("stock"),
      limitPerStudent: formData.get("limitPerStudent"),
      limitPeriod: formData.get("limitPeriod") ?? "month"
    });

    const data = {
      emoji: parsed.emoji,
      imageUrl: parsed.imageUrl || null,
      name: parsed.name,
      description: parsed.description || null,
      price: parsed.price,
      stock: parsed.stock,
      limitPerStudent: parsed.limitPerStudent,
      limitPeriod: parsed.limitPeriod
    };

    if (parsed.id) {
      const updated = await prisma.reward.updateMany({ where: { id: parsed.id, teacherId: teacher.id }, data });
      if (updated.count === 0) throw new Error("Không tìm thấy món quà này.");
    } else {
      await prisma.reward.create({ data: { ...data, teacherId: teacher.id } });
    }

    revalidateRewardPages();
    return actionOk(parsed.id ? `Đã lưu ${parsed.name}.` : `Đã thêm ${parsed.name}.`);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return actionFail(new Error(error.issues[0]?.message ?? "Dữ liệu không hợp lệ."), "Lưu món quà");
    }
    return actionFail(error, "Lưu món quà");
  }
}

export async function toggleRewardActive(formData: FormData): Promise<ActionResult> {
  try {
    const teacher = await requireTeacher();
    const rewardId = idSchema.parse(formData.get("rewardId"));

    const reward = await prisma.reward.findFirst({
      where: { id: rewardId, teacherId: teacher.id },
      select: { name: true, active: true }
    });
    if (!reward) throw new Error("Không tìm thấy món quà này.");

    await prisma.reward.update({ where: { id: rewardId }, data: { active: !reward.active } });

    revalidateRewardPages();
    return actionOk(reward.active ? `Đã ẩn ${reward.name}.` : `Đã hiện lại ${reward.name}.`);
  } catch (error) {
    return actionFail(error, "Ẩn/hiện món quà");
  }
}

export async function deleteReward(formData: FormData): Promise<ActionResult> {
  try {
    const teacher = await requireTeacher();
    const rewardId = idSchema.parse(formData.get("rewardId"));

    const reward = await prisma.reward.findFirst({
      where: { id: rewardId, teacherId: teacher.id },
      select: { name: true, _count: { select: { redemptions: true } } }
    });
    if (!reward) throw new Error("Không tìm thấy món quà này.");
    // Phiếu cũ cần món gốc để tra cứu — món đã có người đổi thì chỉ ẩn được.
    if (reward._count.redemptions > 0) throw new Error("Món đã có người đổi — chỉ ẩn được, không xoá.");

    await prisma.reward.delete({ where: { id: rewardId } });

    revalidateRewardPages();
    return actionOk(`Đã xoá ${reward.name}.`);
  } catch (error) {
    return actionFail(error, "Xoá món quà");
  }
}

export async function deliverRedemption(formData: FormData): Promise<ActionResult> {
  try {
    const teacher = await requireTeacher();
    const redemptionId = idSchema.parse(formData.get("redemptionId"));

    const updated = await prisma.rewardRedemption.updateMany({
      where: { id: redemptionId, status: "pending", reward: { teacherId: teacher.id } },
      data: { status: "delivered", resolvedAt: new Date() }
    });
    if (updated.count === 0) throw new Error("Phiếu này đã được xử lý rồi.");

    revalidateRewardPages();
    return actionOk("Đã đánh dấu trao quà.");
  } catch (error) {
    return actionFail(error, "Trao quà");
  }
}

export async function rejectRedemption(formData: FormData): Promise<ActionResult> {
  try {
    const teacher = await requireTeacher();
    const redemptionId = idSchema.parse(formData.get("redemptionId"));
    const note = z.string().trim().max(200).parse(formData.get("teacherNote") ?? "");

    const redemption = await prisma.rewardRedemption.findFirst({
      where: { id: redemptionId, reward: { teacherId: teacher.id } },
      select: { id: true, studentId: true, price: true, rewardName: true }
    });
    if (!redemption) throw new Error("Không tìm thấy phiếu này.");

    await prisma.$transaction((tx) => refundPendingRedemption(tx, redemption, "rejected", note || null));

    revalidateRewardPages();
    return actionOk(`Đã từ chối và hoàn ${numberFormat.format(redemption.price)} Xu cho học viên.`);
  } catch (error) {
    return actionFail(error, "Từ chối phiếu");
  }
}
