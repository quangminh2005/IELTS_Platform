// Tự thêm các cột "cộng thêm" (additive, nullable) vào DB khi build/deploy —
// idempotent, KHÔNG làm mất dữ liệu. Vì dự án dùng kiểu `db push` (không có
// migrations), đây là cách nhẹ để cột mới xuất hiện trên DB production.
// Không làm fail build: nếu DB tạm không kết nối được thì chỉ cảnh báo.
import { PrismaClient } from "@prisma/client";

const statements = [
  'ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "transcript" TEXT;',
  'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "image" TEXT;',
  'ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "weeklyGoal" INTEGER;'
];

const prisma = new PrismaClient();

try {
  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
  }
  console.log("[ensure-db] OK: cột transcript đã sẵn sàng.");
} catch (error) {
  console.warn(
    "[ensure-db] Bỏ qua (DB chưa kết nối được lúc build?):",
    String(error?.message ?? error).split("\n")[0]
  );
} finally {
  await prisma.$disconnect();
}

process.exit(0);
