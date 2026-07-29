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
  // Mốc thời gian transcript<->audio (bấm transcript để tua audio ở trang kết quả)
  'ALTER TABLE "AssignableUnit" ADD COLUMN IF NOT EXISTS "transcriptTimingJson" TEXT;',
  // Câu nhận xét mẫu gắn theo tiêu chí chấm (null = nhận xét chung)
  'ALTER TABLE "CommentSnippet" ADD COLUMN IF NOT EXISTS "criterion" TEXT;',
  // Gắn lớp cho các bài giao cũ (Assignment.classId trước đây không bao giờ được
  // ghi). Chỉ gắn khi mọi học viên nhận bài cùng chung đúng MỘT lớp; bài giao
  // trải nhiều lớp thì để null = "bài chung", lớp nào cũng tính.
  `UPDATE "Assignment" a
     SET "classId" = sub.class_id
    FROM (
      SELECT r."assignmentId", min(cs."classId") AS class_id
        FROM "AssignmentRecipient" r
        JOIN "ClassStudent" cs ON cs."studentId" = r."studentId"
       GROUP BY r."assignmentId"
      HAVING count(DISTINCT cs."classId") = 1
    ) sub
   WHERE a."id" = sub."assignmentId" AND a."classId" IS NULL;`,
  // Sửa dữ liệu cũ: bài CHỈ có Viết/Nói từng bị lưu score/scorePercent = 0 (điểm
  // giả) thay vì null, làm điểm trung bình ở bảng xếp hạng bị kéo tụt. Chỉ đụng
  // tới bài không có câu tự chấm nào — bài Nghe/Đọc sai hết vẫn giữ nguyên 0%.
  `UPDATE "Attempt" a
     SET "score" = NULL, "scorePercent" = NULL
   WHERE a."scorePercent" = 0
     AND NOT EXISTS (
       SELECT 1 FROM "Answer" ans
       WHERE ans."attemptId" = a."id" AND ans."isCorrect" IS NOT NULL
     );`,
  // Index cho cột khoá ngoại. Postgres KHÔNG tự tạo (khác MySQL) nên trước đây
  // mọi truy vấn "lấy con theo cha" đều quét toàn bảng — đo trên prod: bảng
  // Question đã quét toàn bảng 18k lần (23 triệu dòng), Answer 16k lần (15,7
  // triệu dòng) mà chỉ dùng index đúng 2 lần. Tên index đặt theo đúng quy ước
  // của Prisma (`Bảng_cột_idx`) để `prisma db push` không tạo trùng.
  // Bỏ qua các cột đã là cột ĐẦU của một @@unique — index unique đã phục vụ được.
  'CREATE INDEX IF NOT EXISTS "Answer_attemptId_idx" ON "Answer"("attemptId");',
  'CREATE INDEX IF NOT EXISTS "Answer_studentId_idx" ON "Answer"("studentId");',
  'CREATE INDEX IF NOT EXISTS "Answer_questionId_idx" ON "Answer"("questionId");',
  'CREATE INDEX IF NOT EXISTS "Answer_assignableUnitId_idx" ON "Answer"("assignableUnitId");',
  'CREATE INDEX IF NOT EXISTS "Question_assignableUnitId_order_idx" ON "Question"("assignableUnitId", "order");',
  'CREATE INDEX IF NOT EXISTS "Attempt_assignmentRecipientId_idx" ON "Attempt"("assignmentRecipientId");',
  'CREATE INDEX IF NOT EXISTS "Attempt_studentId_idx" ON "Attempt"("studentId");',
  'CREATE INDEX IF NOT EXISTS "AssignmentRecipient_studentId_idx" ON "AssignmentRecipient"("studentId");',
  'CREATE INDEX IF NOT EXISTS "AssignmentUnit_assignableUnitId_idx" ON "AssignmentUnit"("assignableUnitId");',
  'CREATE INDEX IF NOT EXISTS "AssignableUnit_materialId_idx" ON "AssignableUnit"("materialId");',
  'CREATE INDEX IF NOT EXISTS "Assignment_teacherId_idx" ON "Assignment"("teacherId");',
  'CREATE INDEX IF NOT EXISTS "Assignment_classId_idx" ON "Assignment"("classId");',
  'CREATE INDEX IF NOT EXISTS "Material_teacherId_idx" ON "Material"("teacherId");',
  'CREATE INDEX IF NOT EXISTS "Class_teacherId_idx" ON "Class"("teacherId");',
  'CREATE INDEX IF NOT EXISTS "ClassStudent_studentId_idx" ON "ClassStudent"("studentId");',
  'CREATE INDEX IF NOT EXISTS "Highlight_attemptId_idx" ON "Highlight"("attemptId");',
  'CREATE INDEX IF NOT EXISTS "Highlight_studentId_idx" ON "Highlight"("studentId");',
  'CREATE INDEX IF NOT EXISTS "Highlight_assignableUnitId_idx" ON "Highlight"("assignableUnitId");',
  'CREATE INDEX IF NOT EXISTS "AnswerAnnotation_teacherId_idx" ON "AnswerAnnotation"("teacherId");',
  'CREATE INDEX IF NOT EXISTS "TeacherReview_teacherId_idx" ON "TeacherReview"("teacherId");',
  'CREATE INDEX IF NOT EXISTS "TeacherReview_studentId_idx" ON "TeacherReview"("studentId");',
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
