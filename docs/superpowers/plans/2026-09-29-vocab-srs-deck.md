# Ôn Sổ từ theo lịch — Implementation Plan

> Thực hiện inline trong phiên (executing-plans). Spec: `docs/superpowers/specs/2026-09-29-vocab-srs-deck-design.md`.

**Goal:** Thay quiz 5 câu bằng bộ thẻ ôn theo lịch (Leitner 6 hộp) + cho học viên tự thêm từ ở trang Kết quả.

**Architecture:** Bảng mới `VocabDeckCard`. Logic thuần ở `lib/vocab-srs.ts` (lịch, dạng câu, dựng buổi ôn) và `lib/vocab-selection.ts` (kiểm vùng bôi đen, tách câu, đọc JSON từ điển) — có test. Truy vấn gom ở `lib/vocab-deck.ts`. Action mới ở `lib/actions/vocab-deck.ts`. UI: `components/vocab-review-session.tsx`, `components/vocab-selection-adder.tsx`.

**Tech Stack:** Next 14 App Router, Prisma/Postgres, vitest, Tailwind.

## Global Constraints

- Chữ hiển thị + comment tiếng Việt có dấu.
- iOS Safari ≥ 15.6: không regex lookbehind, không `static {}`; overlay nổi phải portal ra `body`.
- Mọi action bắt đầu bằng `requireStudent()`; mọi truy vấn thẻ lọc theo `studentId` của phiên.
- Bảng mới phải có trong `scripts/ensure-db.mjs` (prod tự tạo khi build).
- Không dùng `window.confirm` (xoá = bấm 2 lần).
- String-enum `VocabDeckCard.source`: `bank | student` ghi vào comment đầu schema.
- Thẻ có `wordId` luôn đọc nội dung từ kho; `source` chỉ nói nguồn gốc (HS tự thêm một từ có sẵn trong kho → `source=student`, `wordId` có giá trị, không tính vào hạn mức thẻ mới).

---

### Task 1: Schema + ensure-db
- Modify `prisma/schema.prisma` (model `VocabDeckCard`, quan hệ ở `StudentProfile`, `VocabWord`, comment enum), `scripts/ensure-db.mjs`.
- `pnpm prisma db push` lên DB local; commit.

### Task 2: `lib/vocab-srs.ts` (TDD)
- Produces: `BOX_INTERVAL_DAYS`, `MASTERED_BOX=5`, `NEW_CARDS_PER_DAY=5`, `SESSION_SIZE=20`,
  `normalizeWordKey(s)`, `nextSchedule({box, correct, today}) → {box, dueDate}`,
  `questionKindForBox(box, canCloze) → QuizKind`, `cardState(box) → "new"|"learning"|"mastered"`,
  `legacyBox(correct, wrong)`, `pickNewWords({candidates:{id, releasedOn|null}[], exclude:Set, todayWordId, limit}) → string[]`,
  `buildReviewSession({due: DeckCardView[], fresh: QuizWord[], pool: QuizWord[], seed, size}) → SessionItem[]`.
- `lib/vocab-quiz.ts`: bỏ `buildQuiz`, xuất `buildQuestion({word, kind, pool, seed, index})`.
- Test: `tests/vocab-srs.test.ts`; sửa `tests/vocab-quiz.test.ts`.

### Task 3: `lib/vocab-selection.ts` (TDD)
- `isAddableSelection(text)`, `cleanSelection(text)`, `sentenceAround(text, start, end)`, `parseDictionaryEntry(json)`.
- Test: `tests/vocab-selection.test.ts`.

### Task 4: `lib/vocab-deck.ts` + `lib/actions/vocab-deck.ts`
- Loader: `ensureLegacyCards`, `getReviewSession(studentId, {extraNew})`, `getDeckEntries(studentId)`, `countDueCards(studentId)`.
- Actions: `answerVocabCard`, `lookupVocabWord`, `addStudentVocabWord`, `updateStudentVocabWord`, `deleteStudentVocabWord`.
- Bỏ `submitVocabQuiz`.

### Task 5: Trang ôn `/student/vocab` + `components/vocab-review-session.tsx`; xoá `vocab-quiz-form.tsx`.

### Task 6: Sổ từ `/student/vocab/words` + `lib/vocab-words.ts` (trạng thái, tự thêm, sửa/xoá) + test.

### Task 7: Tự thêm từ ở trang Kết quả — `components/vocab-selection-adder.tsx` bọc nội dung trang kết quả học viên.

### Task 8: Phía thầy + trang chủ — cột Đã thuộc/Quá hạn (`lib/vocab-teacher-stats.ts` + bảng), nút "Ôn thẻ hôm nay (N)" (`components/vocab-card.tsx`, `getVocabSidebar`).

### Task 9: Kiểm tra — `pnpm test`, `pnpm lint`, `pnpm build`, chạy thử local bằng tài khoản học viên; commit + push.
