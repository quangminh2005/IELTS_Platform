import { prisma } from "@/lib/prisma";
import { XP_EARN_KINDS } from "@/lib/xp-rank";

// XP trọn đời của học viên = tổng các dòng KIẾM ĐƯỢC trong sổ Xu (lib/wallet.ts
// ghi, đã hồi tố đủ). Hạng đấu (lib/xp-rank.ts) đọc từ đây — MỘT nguồn cho trang
// chủ, hồ sơ, bảng xếp hạng và trang /student/ranks.
//
// Lưu ý: sổ Xu chỉ đồng bộ khi học viên nộp bài / ôn thẻ / mở Cửa hàng (syncWallet),
// nên XP ở đây là XP đã vào sổ — cùng con số với Xu học viên thấy.
export async function getLifetimeXp(studentId: string): Promise<number> {
  const result = await prisma.coinTransaction.aggregate({
    where: { studentId, kind: { in: [...XP_EARN_KINDS] } },
    _sum: { amount: true }
  });
  return Math.max(0, result._sum.amount ?? 0);
}

export async function getLifetimeXpMap(studentIds: string[]): Promise<Map<string, number>> {
  if (studentIds.length === 0) return new Map();

  const rows = await prisma.coinTransaction.groupBy({
    by: ["studentId"],
    where: { studentId: { in: studentIds }, kind: { in: [...XP_EARN_KINDS] } },
    _sum: { amount: true }
  });

  return new Map(rows.map((row) => [row.studentId, Math.max(0, row._sum.amount ?? 0)]));
}
