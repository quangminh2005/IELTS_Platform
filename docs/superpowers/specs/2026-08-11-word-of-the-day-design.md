# Thiết kế: Từ vựng mỗi ngày (Word of the Day)

Ngày: 2026-08-11
Trạng thái: đã chốt, chờ viết kế hoạch triển khai

## Mục tiêu

Mỗi ngày hiển thị cho học viên một từ vựng học thuật **rút ra từ chính các đề đang có
trên hệ thống** (transcript Listening + passage Reading), kèm quiz ôn lại các từ đã phát
những ngày trước.

Giá trị chính: từ vựng luôn gắn với đề học viên đang học, và mỗi từ đều dẫn ngược được
về đề gốc.

## Phạm vi

Trong phạm vi:

- Kho từ rút tự động từ đề đã có trong DB.
- Một từ chung cho **toàn bộ học viên** mỗi ngày (không cá nhân hoá, không theo lớp).
- Nghĩa/phiên âm/loại từ do script chạy tay gọi Claude API điền sẵn vào DB.
- Quiz ôn tập 5 câu/ngày, **làm lại bao nhiêu lần tuỳ thích**.
- Chuỗi ngày ôn từ **tách riêng**, không đụng điểm xếp hạng hay chuỗi tuần hiện có.
- Trang giáo viên để ẩn từ rác và sửa nghĩa.

Ngoài phạm vi (YAGNI):

- Không duyệt từ trước khi phát — phát tự động, cô sửa sau.
- Không gửi email từ vựng (slot cron Hobby đã dùng cho mail nhắc bài).
- Không audio phát âm ở bản đầu.
- Không cá nhân hoá từ theo từng học viên/lớp.
- Không cộng điểm vào bảng xếp hạng chung.

## Quyết định kiến trúc

| Vấn đề | Chọn | Lý do |
| --- | --- | --- |
| Nguồn từ | Rút từ transcript/passage đã có trong DB | Gắn với đề đang học, không tốn công soạn |
| Chất lượng | Tự động phát, cô sửa/ẩn sau | Ít việc lúc đầu; lọc AWL đủ sạch |
| Phạm vi | Cả trường cùng 1 từ/ngày | Đơn giản nhất, cô nhắc được từ hôm nay trong lớp |
| Nghĩa từ | Script chạy tay gọi Claude API, lưu DB | Web runtime không gọi AI → không tốn tiền, không chậm |
| Chọn từ trong ngày | Ghi sổ lười (lazy) vào `VocabDaily` | Không tốn cron; lịch sử ổn định kể cả khi ẩn từ |
| Quiz & điểm | Tách riêng hoàn toàn | Không sửa `lib/student-score.ts`, `lib/streak.ts` |

**Vì sao không dùng cron:** Vercel Hobby chỉ cho 1 cron/ngày và slot đó đã dùng cho
`/api/cron/reminders`. Cơ chế ghi sổ lười cho kết quả tương đương mà không tốn slot.

**Vì sao không dùng công thức xoay vòng (`ngày % số từ`):** khi cô ẩn một từ, toàn bộ
lịch sử xê dịch và quiz "từ hôm qua" sẽ hỏi sai từ. Bảng nhật ký loại bỏ hẳn rủi ro này.

## Mô hình dữ liệu

Bốn bảng mới. **Không sửa bảng nào đang có.** Theo quy ước dự án, các cột kiểu enum để
dạng `String` thường và ghi giá trị hợp lệ vào comment.

```prisma
model VocabWord {
  id           String   @id @default(cuid())
  word         String   @unique          // dạng chuẩn hoá, chữ thường
  display      String                    // dạng hiển thị
  phonetic     String?                   // IPA, vd /səˈsteɪnəbl/
  partOfSpeech String?                   // noun | verb | adjective | adverb
  meaningVi    String                    // nghĩa tiếng Việt
  definitionEn String?                   // định nghĩa tiếng Anh
  exampleEn    String                    // câu ví dụ NGUYÊN VĂN từ đề
  sourceUnitId String?
  sourceSkill  String?                   // listening | reading
  hidden       Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  sourceUnit AssignableUnit? @relation(fields: [sourceUnitId], references: [id], onDelete: SetNull)
  dailies    VocabDaily[]
  progress   VocabProgress[]

  @@index([hidden])
  @@index([sourceUnitId])
}

model VocabDaily {
  id        String   @id @default(cuid())
  date      DateTime @unique @db.Date    // ngày theo giờ VN
  wordId    String
  createdAt DateTime @default(now())

  word VocabWord @relation(fields: [wordId], references: [id], onDelete: Cascade)

  @@index([wordId])
}

model VocabProgress {
  id           String    @id @default(cuid())
  studentId    String
  wordId       String
  correctCount Int       @default(0)
  wrongCount   Int       @default(0)
  lastAnswerAt DateTime?

  student StudentProfile @relation(fields: [studentId], references: [id], onDelete: Cascade)
  word    VocabWord      @relation(fields: [wordId], references: [id], onDelete: Cascade)

  @@unique([studentId, wordId])
  @@index([wordId])
}

model VocabQuizDay {
  id        String   @id @default(cuid())
  studentId String
  date      DateTime @db.Date
  correct   Int                          // kết quả TỐT NHẤT trong ngày
  total     Int
  updatedAt DateTime @updatedAt

  student StudentProfile @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([studentId, date])
}
```

Cần thêm quan hệ ngược ở `AssignableUnit` (`vocabWords VocabWord[]`) và
`StudentProfile` (`vocabProgress VocabProgress[]`, `vocabQuizDays VocabQuizDay[]`).

**Bắt buộc:** thêm lệnh tạo bốn bảng này vào [scripts/ensure-db.mjs](../../../scripts/ensure-db.mjs).
Script đó chạy trong lúc build nên là đường duy nhất đưa schema lên prod. Quên bước này
thì prod sập ngay lần deploy kế tiếp.

## Module logic thuần

Tất cả đều không đụng Prisma → test được bằng vitest, theo đúng kiểu `lib/grading.ts`.

### `lib/vocab-extract.ts`

```ts
extractCandidates(input: { text: string; skill: string; unitId: string }): VocabCandidate[]
```

Bốn tầng lọc, chạy tuần tự:

1. Tách từ, hạ chữ thường, bỏ số và dấu câu.
2. Bỏ stopword và ~2000 từ phổ thông nhất.
3. Chỉ giữ từ thuộc **danh sách từ học thuật AWL** (570 nhóm từ) — tầng lọc chính.
4. Bỏ tên riêng: từ **luôn** viết hoa ở giữa câu trong mọi lần xuất hiện.

Mỗi ứng viên trả về gồm từ chuẩn hoá, dạng hiển thị, câu đầu tiên chứa nó, `unitId`,
`skill`.

### `lib/vocab-day.ts`

```ts
vietnamDateKey(now: Date): string              // "2026-08-11" theo Asia/Ho_Chi_Minh
pickNextWord(input: { candidates: WordRef[]; usedIds: string[] }): WordRef | null
```

Chọn từ chưa dùng; hết vòng thì xoay lại từ đầu. Trả `null` khi kho rỗng.

### `lib/vocab-quiz.ts`

```ts
buildQuiz(input: { pool: QuizWord[]; progress: ProgressRow[]; count: number; seed: number }): QuizQuestion[]
```

Chọn từ để ôn theo thứ tự ưu tiên: sai nhiều nhất → lâu chưa ôn nhất → chưa ôn lần nào.
Mỗi câu gồm 1 đáp án đúng + 3 nghĩa nhiễu lấy từ từ khác, đã kiểm tra không trùng đáp án
đúng. `seed` để mỗi lượt làm lại bốc bộ từ khác nhau.

### `lib/vocab-streak.ts`

```ts
calculateVocabStreak(input: { days: string[]; today: string }): { days: number; activeToday: boolean }
```

Đếm số ngày liên tiếp có làm quiz, tính đến hôm nay hoặc hôm qua.

## Server actions — `lib/actions/vocab.ts`

Mọi action mở đầu bằng `requireStudent()` / `requireTeacher()` theo đúng quy ước dự án,
validate bằng zod, trả `ActionResult` để hiện toast.

- `submitVocabQuiz(formData)` — học viên. Chấm ngay trong action (không tin điểm do
  client gửi lên), cộng dồn `VocabProgress`, `upsert` `VocabQuizDay` chỉ ghi đè khi
  `correct` cao hơn kết quả đã có trong ngày.
- `hideVocabWord(formData)` / `updateVocabWord(formData)` — giáo viên. Ẩn từ **không**
  xoá bản ghi `VocabDaily` cũ, nên lịch sử giữ nguyên.

## Giao diện

### Thẻ trên trang chủ học viên

Chèn vào [app/student/page.tsx](../../../app/student/page.tsx), đặt dưới hàng
chuỗi/hạng và trên `ProgressRing`:

```
┌─────────────────────────────────────────────┐
│ Từ vựng hôm nay          🔥 chuỗi 5 ngày    │
│                                             │
│ sustainable  /səˈsteɪnəbl/  (adj)           │
│ bền vững, có thể duy trì lâu dài            │
│                                             │
│ "…a more sustainable approach to farming."  │
│ ↳ Cambridge 20 · Reading Test 1             │
│                                             │
│         [ Ôn 5 từ cũ → ]                    │
└─────────────────────────────────────────────┘
```

Dòng nguồn bấm được, dẫn về đề gốc.

### `/student/vocab`

Quiz 5 câu, dạng chọn 1 trong 4 nghĩa. Nộp xong hiện đúng/sai từng câu kèm nghĩa đúng.
Có nút làm lại — mỗi lượt bốc 5 từ khác (hết từ mới lặp lại). Cuối trang liệt kê các từ
đã học kèm số lần đúng/sai.

### `/teacher/vocab`

Bảng kho từ có tìm kiếm và phân trang. Mỗi dòng: từ, nghĩa, nguồn, đã phát ngày nào.
Thao tác: **Ẩn** và **Sửa** (nghĩa/phiên âm/ví dụ).

Trang dùng `requireTeacherPage()` (không phải `requireTeacher()`) theo quy ước
[CLAUDE.md](../../../CLAUDE.md); `tests/teacher-page-guard.test.ts` sẽ tự bắt lỗi này.

Theo quy ước đang dùng ở các trang teacher khác: truy vấn bằng `select` tường minh,
**không** dùng `include`, để tránh kéo theo `content`/`transcript` rất nặng.

### Điều hướng

Thêm mục **Từ vựng** vào nhánh `student` trong
[components/app-shell.tsx](../../../components/app-shell.tsx), đặt sau "Tự luyện".

## Luồng chọn từ trong ngày

1. Học viên mở trang chủ. Server tính `vietnamDateKey(new Date())`.
2. Tra `VocabDaily` theo ngày đó. Có rồi → dùng luôn.
3. Chưa có → `pickNextWord` trên các từ `hidden: false`, rồi `create`.
4. Nếu hai người vào cùng lúc, người thua dính lỗi trùng khoá Prisma **P2002** → bắt lỗi
   đó và đọc lại bản ghi của người thắng.

Không cần cron, không cần khoá phân tán.

## Script rút từ — `scripts/vocab-extract.mjs`

Chạy trên máy, dùng `DATABASE_URL_PROD` giống các script import prod đang có.

1. Đọc `AssignableUnit` (`transcript` cho Listening, `content` cho Reading).
2. Chạy `extractCandidates` cho từng unit, gộp lại và khử trùng lặp.
3. Bỏ những từ đã có trong `VocabWord`.
4. Gọi Claude API theo lô ~50 từ, yêu cầu trả JSON: nghĩa Việt, IPA, loại từ, định nghĩa
   Anh.
5. Ghi vào `VocabWord`.

Chạy lại được nhiều lần: đứt giữa chừng chỉ cần chạy lại, từ đã có sẽ bỏ qua.
**Web lúc chạy thật không gọi AI.**

## Xử lý lỗi

| Tình huống | Hành vi |
| --- | --- |
| Kho từ rỗng hoặc bị ẩn hết | Thẻ hiện "Chưa có từ nào", không văng lỗi |
| Hai người vào cùng lúc | Bắt P2002, đọc lại bản ghi đã có |
| Kho có dưới 4 từ | Tạm ẩn quiz thay vì hiện câu thiếu lựa chọn |
| Học viên chưa có từ nào để ôn | Nút "Ôn 5 từ cũ" ẩn đi cho tới khi đủ từ |
| AI trả JSON hỏng | Script ghi log, bỏ qua từ đó, không ghi rác vào DB |
| Neon đang ngủ khi chạy script | Dùng `warmUpDatabase()` như `/api/cron/reminders` |

## Kiểm thử

Toàn bộ là logic thuần, không cần DB:

- `tests/vocab-extract.test.ts` — lọc đúng tên riêng, stopword, AWL; lấy đúng câu ví dụ.
- `tests/vocab-day.test.ts` — ranh giới ngày theo giờ VN (nửa đêm VN, không phải UTC);
  không lặp từ khi chưa hết vòng; kho rỗng trả `null`.
- `tests/vocab-quiz.test.ts` — ưu tiên từ sai nhiều/lâu chưa ôn; đáp án nhiễu không trùng
  đáp án đúng; `seed` khác cho bộ từ khác.
- `tests/vocab-streak.test.ts` — chuỗi đứt khi nghỉ một ngày; hôm nay chưa làm vẫn giữ
  chuỗi tới hết ngày.

`tests/teacher-page-guard.test.ts` có sẵn tự động phủ `/teacher/vocab`.

## Thứ tự triển khai

1. Schema + `scripts/ensure-db.mjs`.
2. Bốn module logic thuần + test (làm trước, không phụ thuộc gì).
3. `scripts/vocab-extract.mjs`, chạy thử trên DB local rồi mới chạy prod.
4. Thẻ trang chủ học viên + luồng ghi sổ lười.
5. Trang `/student/vocab` + `submitVocabQuiz`.
6. Trang `/teacher/vocab` + hai action của giáo viên.
7. Thêm mục điều hướng.

## Rủi ro đã biết

- **Chất lượng lọc từ** là rủi ro lớn nhất. Giảm thiểu bằng lọc AWL + nút Ẩn của giáo
  viên. Chấp nhận rằng đợt đầu sẽ có vài từ cần ẩn.
- **Nghĩa AI sinh có thể không khớp ngữ cảnh trong đề.** Giảm thiểu bằng cách gửi kèm
  câu ví dụ vào prompt và cho giáo viên sửa.
- **Kho từ cạn** nếu đề ít. Ước lượng vài trăm tới trên một nghìn từ — đủ nhiều năm ở
  nhịp 1 từ/ngày; hết vòng thì xoay lại chứ không lỗi.
