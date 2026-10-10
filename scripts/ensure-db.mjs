// Tự thêm các cột "cộng thêm" (additive, nullable) vào DB khi build/deploy —
// idempotent, KHÔNG làm mất dữ liệu. Vì dự án dùng kiểu `db push` (không có
// migrations), đây là cách nhẹ để cột mới xuất hiện trên DB production.
// Không làm fail build: nếu DB tạm không kết nối được thì chỉ cảnh báo.
import { PrismaClient } from "@prisma/client";

const statements = [
  'ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "transcript" TEXT;',
  // Mốc thời gian từng từ của bản phiên âm Speaking (đo độ trôi chảy, 6/10/2026)
  'ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "speechTimingJson" TEXT;',
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
  // Báo lỗi học viên gửi giáo viên: bảng mới, không đụng dữ liệu cũ.
  `CREATE TABLE IF NOT EXISTS "BugReport" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "pageUrl" TEXT NOT NULL,
    "userAgent" TEXT,
    "viewport" TEXT,
    "attemptId" TEXT,
    "contextJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "teacherNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BugReport_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE INDEX IF NOT EXISTS "BugReport_studentId_createdAt_idx" ON "BugReport"("studentId", "createdAt");',
  'CREATE INDEX IF NOT EXISTS "BugReport_status_createdAt_idx" ON "BugReport"("status", "createdAt");',
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BugReport_studentId_fkey') THEN
      ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$;`,
  // Thư viện tự luyện: cờ mở đề, khoá bộ luyện, số thứ tự lượt làm. Đặt TRƯỚC hai
  // câu UPDATE khối lớn bên dưới — nếu một câu UPDATE nặng phía dưới bị timeout
  // (Neon cold-start) thì các cột này vẫn kịp lên prod trước khi vòng lặp dừng
  // lại (xem catch trong vòng lặp: một câu lỗi không còn chặn các câu sau, nhưng
  // đặt cột nền tảng lên trước vẫn an toàn hơn là để cuối mảng).
  'ALTER TABLE "Material" ADD COLUMN IF NOT EXISTS "practiceOpen" BOOLEAN NOT NULL DEFAULT false;',
  // Ẩn thanh audio khi học viên TỰ LUYỆN đề này (chế độ thi thật, đặt theo từng đề).
  'ALTER TABLE "Material" ADD COLUMN IF NOT EXISTS "practiceLockAudio" BOOLEAN NOT NULL DEFAULT false;',
  // Kho tài liệu chia 2 mục: sách/bộ đề (gom theo tên sách) và bài tập hàng tuần.
  `ALTER TABLE "Material" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'homework';`,
  'ALTER TABLE "Material" ADD COLUMN IF NOT EXISTS "bookName" TEXT;',
  'ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "practiceScopeKey" TEXT;',
  // Tổng thời gian cả bài (một đồng hồ chung cho bài nhiều kỹ năng), 5/10/2026
  'ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "totalTimeLimitMinutes" INTEGER;',
  'ALTER TABLE "Attempt" ADD COLUMN IF NOT EXISTS "attemptRound" INTEGER NOT NULL DEFAULT 1;',
  // Tự luyện ẩn thanh audio → thưởng thêm XP & Xu phần Nghe, 5/10/2026
  'ALTER TABLE "Attempt" ADD COLUMN IF NOT EXISTS "audioHidden" BOOLEAN NOT NULL DEFAULT false;',
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
  // Hồ sơ học viên: bio, avatar, màu bìa.
  'ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "bio" TEXT;',
  'ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;',
  'ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "avatarPreset" TEXT;',
  'ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "coverColor" TEXT;',
  // Lịch học của lớp: 6 cột tuỳ chọn trên Class + bảng lịch cố định + bảng từng buổi.
  'ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "scheduleStartDate" TIMESTAMP(3);',
  'ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "totalSessions" INTEGER;',
  'ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "scheduleEndDate" TIMESTAMP(3);',
  'ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "location" TEXT;',
  'ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "scheduleAppliesFrom" TIMESTAMP(3);',
  'ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "scheduleChangedAt" TIMESTAMP(3);',
  `CREATE TABLE IF NOT EXISTS "ClassScheduleSlot" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    CONSTRAINT "ClassScheduleSlot_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE INDEX IF NOT EXISTS "ClassScheduleSlot_classId_idx" ON "ClassScheduleSlot"("classId");',
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassScheduleSlot_classId_fkey') THEN
      ALTER TABLE "ClassScheduleSlot" ADD CONSTRAINT "ClassScheduleSlot_classId_fkey"
      FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$;`,
  `CREATE TABLE IF NOT EXISTS "ClassSession" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "mode" TEXT NOT NULL DEFAULT 'offline',
    "kind" TEXT NOT NULL DEFAULT 'regular',
    "meetingUrl" TEXT,
    "note" TEXT,
    "originalStartsAt" TIMESTAMP(3),
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "changeKind" TEXT,
    "changedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClassSession_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE INDEX IF NOT EXISTS "ClassSession_classId_startsAt_idx" ON "ClassSession"("classId", "startsAt");',
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassSession_classId_fkey') THEN
      ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_classId_fkey"
      FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$;`,
  // Lập dàn ý trước khi nói: số phút chuẩn bị theo bài giao + bảng dàn ý mới.
  'ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "speakingPrepMinutes" INTEGER;',
  // Thời gian chuẩn bị tính bằng giây (giao được 30 giây/câu cho Part 1).
  'ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "speakingPrepSeconds" INTEGER;',
  // Chuẩn bị theo từng câu hay một khoảng chung cả bài.
  'ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "speakingPrepScope" TEXT;',
  `CREATE TABLE IF NOT EXISTS "SpeakingPlan" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SpeakingPlan_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "SpeakingPlan_attemptId_questionId_key" ON "SpeakingPlan"("attemptId", "questionId");',
  'CREATE INDEX IF NOT EXISTS "SpeakingPlan_questionId_idx" ON "SpeakingPlan"("questionId");',
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SpeakingPlan_attemptId_fkey') THEN
      ALTER TABLE "SpeakingPlan" ADD CONSTRAINT "SpeakingPlan_attemptId_fkey"
      FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$;`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SpeakingPlan_questionId_fkey') THEN
      ALTER TABLE "SpeakingPlan" ADD CONSTRAINT "SpeakingPlan_questionId_fkey"
      FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$;`,
  // Thẻ ôn Sổ từ theo lịch (29/9/2026): bảng mới, không đụng dữ liệu cũ.
  `CREATE TABLE IF NOT EXISTS "VocabDeckCard" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "wordKey" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "wordId" TEXT,
    "display" TEXT,
    "phonetic" TEXT,
    "partOfSpeech" TEXT,
    "meaningVi" TEXT,
    "definitionEn" TEXT,
    "exampleEn" TEXT,
    "sourceAttemptId" TEXT,
    "box" INTEGER NOT NULL DEFAULT 0,
    "dueDate" DATE NOT NULL,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "lapseCount" INTEGER NOT NULL DEFAULT 0,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VocabDeckCard_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "VocabDeckCard_studentId_wordKey_key" ON "VocabDeckCard"("studentId", "wordKey");',
  'CREATE INDEX IF NOT EXISTS "VocabDeckCard_studentId_dueDate_idx" ON "VocabDeckCard"("studentId", "dueDate");',
  'CREATE INDEX IF NOT EXISTS "VocabDeckCard_wordId_idx" ON "VocabDeckCard"("wordId");',
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VocabDeckCard_studentId_fkey') THEN
      ALTER TABLE "VocabDeckCard" ADD CONSTRAINT "VocabDeckCard_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$;`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VocabDeckCard_wordId_fkey') THEN
      ALTER TABLE "VocabDeckCard" ADD CONSTRAINT "VocabDeckCard_wordId_fkey"
      FOREIGN KEY ("wordId") REFERENCES "VocabWord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$;`,
  // Xu & Cửa hàng (Đợt 1): sổ Xu, đồ sở hữu, số dư + đồ đang trang bị.
  'ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "coins" INTEGER NOT NULL DEFAULT 0;',
  'ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "equippedBackground" TEXT;',
  'ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "equippedFrame" TEXT;',
  // Linh vật (Đợt 4): tư thế đang trang bị.
  'ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "equippedMascot" TEXT;',
  // Ảnh nền bìa tự tải (hồ sơ kiểu chin, 5/10/2026).
  'ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "coverImageUrl" TEXT;',
  // Ẩn tài khoản thử khỏi mọi bảng xếp hạng (Mạng xã hội Đợt 1, 6/10/2026).
  'ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "hiddenFromBoards" BOOLEAN NOT NULL DEFAULT false;',
  `CREATE TABLE IF NOT EXISTS "CoinTransaction" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "attemptId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoinTransaction_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "CoinTransaction_studentId_key_key" ON "CoinTransaction"("studentId", "key");',
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CoinTransaction_studentId_fkey') THEN
      ALTER TABLE "CoinTransaction" ADD CONSTRAINT "CoinTransaction_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$;`,
  `CREATE TABLE IF NOT EXISTS "StudentItem" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentItem_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "StudentItem_studentId_itemKey_key" ON "StudentItem"("studentId", "itemKey");',
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentItem_studentId_fkey') THEN
      ALTER TABLE "StudentItem" ADD CONSTRAINT "StudentItem_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$;`,
  // Xu Đợt 3: quà ngoài đời + phiếu đổi quà.
  `CREATE TABLE IF NOT EXISTS "Reward" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "imageUrl" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "stock" INTEGER,
    "limitPerStudent" INTEGER,
    "limitPeriod" TEXT NOT NULL DEFAULT 'month',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE INDEX IF NOT EXISTS "Reward_teacherId_active_idx" ON "Reward"("teacherId", "active");',
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Reward_teacherId_fkey') THEN
      ALTER TABLE "Reward" ADD CONSTRAINT "Reward_teacherId_fkey"
      FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$;`,
  `CREATE TABLE IF NOT EXISTS "RewardRedemption" (
    "id" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "rewardName" TEXT NOT NULL,
    "rewardEmoji" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "teacherNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RewardRedemption_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE INDEX IF NOT EXISTS "RewardRedemption_status_createdAt_idx" ON "RewardRedemption"("status", "createdAt");',
  'CREATE INDEX IF NOT EXISTS "RewardRedemption_studentId_createdAt_idx" ON "RewardRedemption"("studentId", "createdAt");',
  'CREATE INDEX IF NOT EXISTS "RewardRedemption_rewardId_status_idx" ON "RewardRedemption"("rewardId", "status");',
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RewardRedemption_rewardId_fkey') THEN
      ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_rewardId_fkey"
      FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END $$;`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RewardRedemption_studentId_fkey') THEN
      ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$;`,
  // AI chấm Writing/Speaking (5/10/2026): bảng mới + giới hạn lượt/ngày của thầy.
  'ALTER TABLE "TeacherProfile" ADD COLUMN IF NOT EXISTS "aiDailyLimit" INTEGER;',
  `CREATE TABLE IF NOT EXISTS "AiReview" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "resultJson" TEXT,
    "errorMessage" TEXT,
    "inputTokens" INTEGER,
    "cachedInputTokens" INTEGER,
    "outputTokens" INTEGER,
    "costUsd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiReview_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE INDEX IF NOT EXISTS "AiReview_attemptId_idx" ON "AiReview"("attemptId");',
  'CREATE INDEX IF NOT EXISTS "AiReview_studentId_createdAt_idx" ON "AiReview"("studentId", "createdAt");',
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AiReview_attemptId_fkey') THEN
      ALTER TABLE "AiReview" ADD CONSTRAINT "AiReview_attemptId_fkey"
      FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$;`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AiReview_studentId_fkey') THEN
      ALTER TABLE "AiReview" ADD CONSTRAINT "AiReview_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$;`,
  // Mạng xã hội Đợt 2: theo dõi + cảm xúc.
  `CREATE TABLE IF NOT EXISTS "Follow" (
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Follow_pkey" PRIMARY KEY ("followerId", "followingId")
  );`,
  'CREATE INDEX IF NOT EXISTS "Follow_followingId_createdAt_idx" ON "Follow"("followingId", "createdAt");',
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Follow_followerId_fkey') THEN
      ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey"
      FOREIGN KEY ("followerId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$;`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Follow_followingId_fkey') THEN
      ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey"
      FOREIGN KEY ("followingId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$;`,
  `CREATE TABLE IF NOT EXISTS "ProfileReaction" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfileReaction_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "ProfileReaction_fromId_toId_kind_dayKey_key" ON "ProfileReaction"("fromId", "toId", "kind", "dayKey");',
  'CREATE INDEX IF NOT EXISTS "ProfileReaction_toId_createdAt_idx" ON "ProfileReaction"("toId", "createdAt");',
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProfileReaction_fromId_fkey') THEN
      ALTER TABLE "ProfileReaction" ADD CONSTRAINT "ProfileReaction_fromId_fkey"
      FOREIGN KEY ("fromId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$;`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProfileReaction_toId_fkey') THEN
      ALTER TABLE "ProfileReaction" ADD CONSTRAINT "ProfileReaction_toId_fkey"
      FOREIGN KEY ("toId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$;`,
  // Mạng xã hội Đợt 3: tim + bình luận bảng tin.
  `CREATE TABLE IF NOT EXISTS "FeedHeart" (
    "eventKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedHeart_pkey" PRIMARY KEY ("eventKey", "userId")
  );`,
  'CREATE INDEX IF NOT EXISTS "FeedHeart_eventKey_idx" ON "FeedHeart"("eventKey");',
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FeedHeart_userId_fkey') THEN
      ALTER TABLE "FeedHeart" ADD CONSTRAINT "FeedHeart_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$;`,
  `CREATE TABLE IF NOT EXISTS "FeedComment" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "ownerStudentId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedComment_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE INDEX IF NOT EXISTS "FeedComment_eventKey_createdAt_idx" ON "FeedComment"("eventKey", "createdAt");',
  'CREATE INDEX IF NOT EXISTS "FeedComment_ownerStudentId_createdAt_idx" ON "FeedComment"("ownerStudentId", "createdAt");',
  'CREATE INDEX IF NOT EXISTS "FeedComment_createdAt_idx" ON "FeedComment"("createdAt");',
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FeedComment_ownerStudentId_fkey') THEN
      ALTER TABLE "FeedComment" ADD CONSTRAINT "FeedComment_ownerStudentId_fkey"
      FOREIGN KEY ("ownerStudentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$;`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FeedComment_authorUserId_fkey') THEN
      ALTER TABLE "FeedComment" ADD CONSTRAINT "FeedComment_authorUserId_fkey"
      FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$;`,
  // Bản dịch câu ví dụ trong kho từ vựng (10/10/2026).
  'ALTER TABLE "VocabWord" ADD COLUMN IF NOT EXISTS "exampleVi" TEXT;',
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
