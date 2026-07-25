// Tự thêm các cột "cộng thêm" (additive, nullable) vào DB khi build/deploy —
// idempotent, KHÔNG làm mất dữ liệu. Vì dự án dùng kiểu `db push` (không có
// migrations), đây là cách nhẹ để cột mới xuất hiện trên DB production.
// Không làm fail build: nếu DB tạm không kết nối được thì chỉ cảnh báo.
import { PrismaClient } from "@prisma/client";

const statements = [
  'ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "transcript" TEXT;',
  // Giải thích/dẫn chứng đáp án cho Listening & Reading
  'ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "answerEvidence" TEXT;',
  'ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "evidenceSnapshot" TEXT;',
  'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "image" TEXT;',
  'ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "weeklyGoal" INTEGER;',
  'ALTER TABLE "Attempt" ADD COLUMN IF NOT EXISTS "partTimesJson" TEXT;',
  // Phiên làm bài theo kỹ năng: cột thời gian + bảng AttemptSkill
  'ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "skillTimeLimitsJson" TEXT;',
  `CREATE TABLE IF NOT EXISTS "AttemptSkill" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "elapsedSeconds" INTEGER NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION,
    "scorePercent" DOUBLE PRECISION,
    CONSTRAINT "AttemptSkill_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "AttemptSkill_attemptId_skill_key" ON "AttemptSkill"("attemptId", "skill");',
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AttemptSkill_attemptId_fkey') THEN
      ALTER TABLE "AttemptSkill" ADD CONSTRAINT "AttemptSkill_attemptId_fkey"
      FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$;`,
  // Chế độ thi thật Listening: khoá thanh audio, chỉ cho chỉnh âm lượng
  'ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "lockAudio" BOOLEAN NOT NULL DEFAULT false;',
  // Ghi nhận hành vi đáng ngờ khi làm bài (Ctrl+F, rời tab)
  'ALTER TABLE "Attempt" ADD COLUMN IF NOT EXISTS "findAttemptCount" INTEGER NOT NULL DEFAULT 0;',
  // tabSwitchCount đã có trong schema từ đầu nhưng chưa từng được ghi — thêm cho
  // chắc, câu lệnh idempotent nên chạy lại vô hại.
  'ALTER TABLE "Attempt" ADD COLUMN IF NOT EXISTS "tabSwitchCount" INTEGER NOT NULL DEFAULT 0;',
  // Mail nhắc bài sắp hết hạn: đánh dấu đã nhắc để không gửi trùng
  'ALTER TABLE "AssignmentRecipient" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);',
];

const prisma = new PrismaClient();

try {
  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
  }
  console.log("[ensure-db] OK: các cột bổ sung đã sẵn sàng.");
} catch (error) {
  console.warn(
    "[ensure-db] Bỏ qua (DB chưa kết nối được lúc build?):",
    String(error?.message ?? error).split("\n")[0]
  );
} finally {
  await prisma.$disconnect();
}

process.exit(0);
