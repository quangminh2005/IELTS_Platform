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
  // Thư viện tự luyện: cờ mở đề, khoá bộ luyện, số thứ tự lượt làm. Đặt TRƯỚC hai
  // câu UPDATE khối lớn bên dưới — nếu một câu UPDATE nặng phía dưới bị timeout
  // (Neon cold-start) thì các cột này vẫn kịp lên prod trước khi vòng lặp dừng
  // lại (xem catch trong vòng lặp: một câu lỗi không còn chặn các câu sau, nhưng
  // đặt cột nền tảng lên trước vẫn an toàn hơn là để cuối mảng).
  'ALTER TABLE "Material" ADD COLUMN IF NOT EXISTS "practiceOpen" BOOLEAN NOT NULL DEFAULT false;',
  'ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "practiceScopeKey" TEXT;',
  'ALTER TABLE "Attempt" ADD COLUMN IF NOT EXISTS "attemptRound" INTEGER NOT NULL DEFAULT 1;',
  'CREATE UNIQUE INDEX IF NOT EXISTS "Assignment_practiceScopeKey_key" ON "Assignment"("practiceScopeKey");',
  // Chặn dò mật khẩu giáo viên: bảng đếm số lần đăng nhập SAI. Bảng mới, không
  // đụng bảng nào đang có. Đặt trước các câu UPDATE nặng bên dưới để chắc chắn
  // lên được prod kể cả khi một câu UPDATE bị timeout vì Neon cold-start.
  `CREATE TABLE IF NOT EXISTS "LoginAttempt" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE INDEX IF NOT EXISTS "LoginAttempt_email_createdAt_idx" ON "LoginAttempt"("email", "createdAt");',
  'CREATE INDEX IF NOT EXISTS "LoginAttempt_ip_createdAt_idx" ON "LoginAttempt"("ip", "createdAt");',
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
   WHERE a."id" = sub."assignmentId" AND a."classId" IS NULL
     -- Bài giao ẢO của thư viện tự luyện (Assignment.mode = "practice", xem
     -- lib/practice.ts) luôn có đúng 1 recipient thuộc đúng 1 lớp -> nếu không
     -- loại, câu UPDATE này sẽ đóng dấu classId cho MỌI bài tự luyện, phá bất
     -- biến "bài tự luyện luôn classId = null" mà lib/actions/practice.ts cố
     -- tình đặt và lib/class-ranking.ts đang dựa vào.
     AND a."mode" <> 'practice';`,
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
  // Từ vựng mỗi ngày: 4 bảng mới, không sửa bảng nào đang có.
  `CREATE TABLE IF NOT EXISTS "VocabWord" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "display" TEXT NOT NULL,
    "phonetic" TEXT,
    "partOfSpeech" TEXT,
    "meaningVi" TEXT NOT NULL,
    "definitionEn" TEXT,
    "exampleEn" TEXT NOT NULL,
    "sourceUnitId" TEXT,
    "sourceSkill" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VocabWord_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "VocabWord_word_key" ON "VocabWord"("word");',
  'CREATE INDEX IF NOT EXISTS "VocabWord_hidden_idx" ON "VocabWord"("hidden");',
  'CREATE INDEX IF NOT EXISTS "VocabWord_sourceUnitId_idx" ON "VocabWord"("sourceUnitId");',
  `CREATE TABLE IF NOT EXISTS "VocabDaily" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "wordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VocabDaily_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "VocabDaily_date_key" ON "VocabDaily"("date");',
  'CREATE INDEX IF NOT EXISTS "VocabDaily_wordId_idx" ON "VocabDaily"("wordId");',
  `CREATE TABLE IF NOT EXISTS "VocabProgress" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "lastAnswerAt" TIMESTAMP(3),
    CONSTRAINT "VocabProgress_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "VocabProgress_studentId_wordId_key" ON "VocabProgress"("studentId", "wordId");',
  'CREATE INDEX IF NOT EXISTS "VocabProgress_wordId_idx" ON "VocabProgress"("wordId");',
  `CREATE TABLE IF NOT EXISTS "VocabQuizDay" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "correct" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VocabQuizDay_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "VocabQuizDay_studentId_date_key" ON "VocabQuizDay"("studentId", "date");',
  // Chuông thông báo cho học viên: mốc "đã xem lần cuối".
  // DEFAULT NOW() là có chủ ý — học viên đang có bắt đầu ở trạng thái đã đọc hết,
  // tránh việc vừa deploy là chuông đỏ với hàng chục thông báo cũ.
  'ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "notificationsReadAt" TIMESTAMP(3) DEFAULT NOW();',
  // Link báo cáo cho phụ huynh. ALTER TABLE không tự tạo ràng buộc unique nên
  // phải có thêm câu CREATE UNIQUE INDEX riêng cho parentToken.
  //
  // GHI CHÚ: production còn sót 3 cột parentEmail/parentName/parentReportSentAt
  // từ thời báo cáo gửi qua mail. Kênh mail đã bỏ, schema không còn khai báo
  // chúng nữa; Prisma bỏ qua cột lạ nên để đó vô hại. Script này chỉ THÊM cột,
  // không bao giờ xoá, nên không tự dọn được — muốn dọn phải chạy tay.
  'ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "parentToken" TEXT;',
  'CREATE UNIQUE INDEX IF NOT EXISTS "StudentProfile_parentToken_key" ON "StudentProfile"("parentToken");',
];

const prisma = new PrismaClient();

// try/catch nằm TRONG vòng lặp (thay vì bọc cả mảng bằng một try/catch DUY
// NHẤT như trước) — trước đây câu thứ k lỗi (Neon cold-start timeout, khoá
// bảng, thiếu quyền…) là mọi câu k+1..n bị BỎ QUA HOÀN TOÀN, build vẫn xanh,
// deploy vẫn thành công nhưng cột mới ở cuối mảng chưa từng được tạo trên
// prod — Prisma Client không kiểm schema lúc chạy nên lỗi chỉ lộ ra khi có
// request đụng đúng cột thiếu (500 rải rác nhiều trang). Giờ một câu hỏng chỉ
// mất đúng câu đó, các câu còn lại vẫn chạy.
let failCount = 0;

for (const sql of statements) {
  try {
    await prisma.$executeRawUnsafe(sql);
  } catch (error) {
    failCount += 1;
    console.warn(
      "[ensure-db] Bỏ qua 1 câu lệnh (lỗi hoặc DB chưa kết nối được lúc build?):",
      sql.slice(0, 80).replace(/\s+/g, " "),
      "-",
      String(error?.message ?? error).split("\n")[0]
    );
  }
}

if (failCount === 0) {
  console.log("[ensure-db] OK: các cột bổ sung đã sẵn sàng.");
} else {
  console.warn(`[ensure-db] Hoàn tất, nhưng ${failCount}/${statements.length} câu lệnh bị bỏ qua — xem log phía trên.`);
}

try {
  await prisma.$disconnect();
} catch {
  // Không để lỗi ngắt kết nối làm fail build.
}

process.exit(0);
