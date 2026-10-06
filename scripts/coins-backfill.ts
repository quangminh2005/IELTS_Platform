// Hồi tố Xu cho MỌI học viên (một lần khi ra mắt Cửa hàng). Idempotent — chạy lại
// vô hại. Mặc định chỉ XEM TRƯỚC (không ghi gì); thêm --apply mới ghi.
//   npx tsx scripts/coins-backfill.ts            (xem trước, DB trong .env)
//   npx tsx scripts/coins-backfill.ts --apply
// Chạy trên prod: đặt DATABASE_URL = chuỗi kết nối prod cho riêng lệnh này.
import { prisma } from "@/lib/prisma";
import { loadMonthlyRecap } from "@/lib/monthly-recap-data";
import { loadAchievementItems, loadMonthlyPrizeEntries, syncWallet } from "@/lib/wallet";

async function main() {
  const apply = process.argv.includes("--apply");

  // Ngoài Next không có unstable_cache → gọi thẳng loader, tính MỘT lần cho cả trường.
  const achievements = await loadAchievementItems(loadMonthlyRecap);
  const prizes = await loadMonthlyPrizeEntries(loadMonthlyRecap);
  console.log(`Thưởng Học Bá tháng: ${prizes.length} dòng`);
  const students = await prisma.studentProfile.findMany({
    select: { id: true, displayName: true, coins: true },
    orderBy: { displayName: "asc" }
  });
  const nameById = new Map(students.map((student) => [student.id, student.displayName]));

  console.log(`Học viên: ${students.length}`);
  console.log("Đồ thành tích tháng:");
  for (const item of achievements) {
    console.log(`  ${item.itemKey.padEnd(26)} → ${nameById.get(item.studentId) ?? item.studentId}`);
  }

  if (!apply) {
    console.log("\nXEM TRƯỚC — chưa ghi gì. Thêm --apply để ghi.");
    return;
  }

  let total = 0;
  for (const student of students) {
    const result = await syncWallet(student.id, { achievements, prizes });
    const profile = await prisma.studentProfile.findUniqueOrThrow({
      where: { id: student.id },
      select: { coins: true }
    });
    total += profile.coins;
    console.log(
      `${student.displayName.padEnd(28)} +${result.created} dòng, ${result.items} đồ → ${profile.coins} Xu`
    );
  }
  console.log(`\nTổng Xu toàn trường: ${total}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
