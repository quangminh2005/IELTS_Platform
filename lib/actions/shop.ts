"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudent } from "@/lib/actions/attempts";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { purchaseKey } from "@/lib/coins";
import { prisma } from "@/lib/prisma";
import { resolveItem } from "@/lib/shop-catalog";
import { lockStudent, recomputeCoins } from "@/lib/wallet";

const numberFormat = new Intl.NumberFormat("vi-VN");

function revalidateShopPages() {
  revalidatePath("/student/shop");
  revalidatePath("/student/profile");
  revalidatePath("/student/ranking");
  // Chip Xu + khung avatar nằm ở layout học viên.
  revalidatePath("/student", "layout");
}

export async function buyItem(formData: FormData): Promise<ActionResult> {
  try {
    const student = await requireStudent();
    const itemKey = z.string().min(1).max(80).parse(formData.get("itemKey"));
    const item = resolveItem(itemKey);

    if (!item) throw new Error("Không tìm thấy món này.");
    // Đồ thành tích không bán — chỉ mở bằng Tổng kết tháng.
    if (item.price === null) throw new Error("Món này chỉ mở được bằng thành tích.");

    const price = item.price;

    await prisma.$transaction(async (tx) => {
      await lockStudent(tx, student.id);

      const [owned, profile] = await Promise.all([
        tx.studentItem.findUnique({ where: { studentId_itemKey: { studentId: student.id, itemKey } } }),
        tx.studentProfile.findUniqueOrThrow({ where: { id: student.id }, select: { coins: true } })
      ]);

      if (owned) throw new Error("Bạn đã có món này rồi.");
      if (profile.coins < price) {
        throw new Error(`Không đủ Xu — còn thiếu ${numberFormat.format(price - profile.coins)} Xu.`);
      }

      await tx.coinTransaction.create({
        data: {
          studentId: student.id,
          kind: "purchase",
          key: purchaseKey(itemKey),
          amount: -price,
          note: `Mua ${item.name}`
        }
      });
      await tx.studentItem.create({ data: { studentId: student.id, itemKey, source: "purchase" } });
      await recomputeCoins(tx, student.id);
    });

    revalidateShopPages();
    return actionOk(`Đã mua ${item.name}!`);
  } catch (error) {
    return actionFail(error, "Mua đồ");
  }
}

const equipSchema = z.object({
  category: z.enum(["background", "frame"]),
  itemKey: z.string().max(80)
});

export async function equipItem(formData: FormData): Promise<ActionResult> {
  try {
    const student = await requireStudent();
    const parsed = equipSchema.parse({
      category: formData.get("category"),
      itemKey: formData.get("itemKey") ?? ""
    });
    const field = parsed.category === "background" ? "equippedBackground" : "equippedFrame";

    // Chuỗi rỗng = tháo đồ đang trang bị của loại này.
    if (parsed.itemKey === "") {
      await prisma.studentProfile.update({ where: { id: student.id }, data: { [field]: null } });
      revalidateShopPages();
      return actionOk(parsed.category === "background" ? "Đã tháo nền." : "Đã tháo khung.");
    }

    const item = resolveItem(parsed.itemKey);
    if (!item || item.category !== parsed.category) throw new Error("Món này không hợp lệ.");

    const owned = await prisma.studentItem.findUnique({
      where: { studentId_itemKey: { studentId: student.id, itemKey: parsed.itemKey } }
    });
    if (!owned) throw new Error("Bạn chưa có món này.");

    await prisma.studentProfile.update({ where: { id: student.id }, data: { [field]: parsed.itemKey } });
    revalidateShopPages();
    return actionOk(`Đã trang bị ${item.name}.`);
  } catch (error) {
    return actionFail(error, "Trang bị");
  }
}
