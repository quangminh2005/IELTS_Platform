"use server";

import { revalidatePath } from "next/cache";
import { requireStudent } from "@/lib/actions/attempts";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import { formatWeekRange, restoreKey } from "@/lib/streak";
import { getWeekStreak } from "@/lib/streak-data";
import { lockStudent, recomputeCoins } from "@/lib/wallet";

const numberFormat = new Intl.NumberFormat("vi-VN");

// Khôi phục chuỗi tuần bằng Xu. Không nhận gì từ form: server tự tính tuần cứu được
// và giá, sau khi đã khoá dòng học viên — bấm hai lần thì lần sau thấy tuần đã cứu.
export async function restoreStreak(): Promise<ActionResult> {
  try {
    const student = await requireStudent();
    const now = new Date();

    const week = await prisma.$transaction(async (tx) => {
      await lockStudent(tx, student.id);

      const data = await getWeekStreak(student.id, now, tx);
      if (!data.offer) throw new Error("Không có tuần nào cần khôi phục.");
      if (data.coins < data.price) {
        throw new Error(`Không đủ Xu — còn thiếu ${numberFormat.format(data.price - data.coins)} Xu.`);
      }

      const range = formatWeekRange(data.offer.weekKey);
      await tx.coinTransaction.create({
        data: {
          studentId: student.id,
          kind: "streak_restore",
          key: restoreKey(data.offer.weekKey),
          amount: -data.price,
          note: `Khôi phục chuỗi tuần ${range}`
        }
      });
      await recomputeCoins(tx, student.id);
      return range;
    });

    revalidatePath("/student");
    revalidatePath("/student/profile");
    // Chip Xu nằm ở layout học viên.
    revalidatePath("/student", "layout");
    return actionOk(`Đã khôi phục tuần ${week} — chuỗi tiếp tục 🔥`);
  } catch (error) {
    return actionFail(error, "Khôi phục chuỗi");
  }
}
