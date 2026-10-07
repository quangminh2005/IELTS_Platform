"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireStudent } from "@/lib/actions/attempts";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { dayRestoreKey, formatDayShort } from "@/lib/day-streak";
import { getDayStreak } from "@/lib/day-streak-data";
import { LEADERBOARD_CACHE_TAG } from "@/lib/leaderboard";
import { prisma } from "@/lib/prisma";
import { lockStudent, recomputeCoins } from "@/lib/wallet";

const numberFormat = new Intl.NumberFormat("vi-VN");

// Khôi phục chuỗi ngày bằng Xu. Không nhận gì từ form: server tự tính ngày cứu được
// và giá, sau khi đã khoá dòng học viên — bấm hai lần thì lần sau thấy ngày đã cứu.
export async function restoreStreak(): Promise<ActionResult> {
  try {
    const student = await requireStudent();
    const now = new Date();

    const day = await prisma.$transaction(async (tx) => {
      await lockStudent(tx, student.id);

      const data = await getDayStreak(student.id, now, tx);
      if (!data.offer) throw new Error("Không có ngày nào cần khôi phục.");
      if (data.coins < data.price) {
        throw new Error(`Không đủ Xu — còn thiếu ${numberFormat.format(data.price - data.coins)} Xu.`);
      }

      const label = formatDayShort(data.offer.dayKey);
      await tx.coinTransaction.create({
        data: {
          studentId: student.id,
          kind: "streak_restore",
          key: dayRestoreKey(data.offer.dayKey),
          amount: -data.price,
          note: `Khôi phục chuỗi ngày ${label}`
        }
      });
      await recomputeCoins(tx, student.id);
      return label;
    });

    // Ngày cứu được tính vào chuỗi → bảng Chuỗi (cache 5 phút) làm mới ngay.
    try {
      revalidateTag(LEADERBOARD_CACHE_TAG);
    } catch (error) {
      console.error("[bang-xep-hang] không xoá được cache", error);
    }

    revalidatePath("/student");
    revalidatePath("/student/profile");
    revalidatePath("/student/stats");
    // Chip Xu nằm ở layout học viên.
    revalidatePath("/student", "layout");
    return actionOk(`Đã khôi phục ngày ${day} — chuỗi tiếp tục 🔥`);
  } catch (error) {
    return actionFail(error, "Khôi phục chuỗi");
  }
}
