# Mở rộng toast ra các trang giáo viên còn lại — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps dùng checkbox `- [ ]`.

**Goal:** Các nút chỉnh sửa ở Lớp học, Học viên, Chấm bài, ngân hàng nhận xét đều hiện popup báo kết quả — nối tiếp khuôn mẫu đã ship ở trang Tài liệu.

**Nền tảng đã có (session trước, đã ship):**
- `lib/action-result.ts` — `ActionResult` + `actionOk` + `actionFail`
- `components/toast.tsx` — `ToastProvider` (đã gắn ở `app/teacher/layout.tsx`) + `useToast`
- `components/action-form.tsx` — `ActionForm` / `ActionSubmitButton` / `ActionDeleteButton`
- Xem [plan cũ](2026-07-15-toast-thong-bao-luu.md).

## Hai cơ chế phản hồi (dùng đúng chỗ)

- **Cơ chế A — `ActionForm` + `ToastProvider`** (giá trị trả về, KHÔNG điều hướng): cho nút
  đứng yên tại trang. Giữ nguyên vị trí cuộn.
- **Cơ chế B — `redirect` + `NoticeToast`** (`components/notice-toast.tsx`, đã có sẵn, đọc
  thông báo từ query param): cho nút **buộc phải rời trang** — Xoá lớp / Xoá học viên (đang
  đứng trên trang của chính thứ bị xoá). Sau redirect về `/teacher/classes`, `NoticeToast`
  hiện popup.

Trang **Giao bài** đã dùng cơ chế B sẵn (`assignment-notices.ts` + `<NoticeToast>` ở
`app/teacher/assignments/page.tsx:146`) → **KHÔNG đụng**. `updateAssignment` khi lưu vẫn mất
vị trí cuộn (hạn chế đã biết) — để sau nếu cần.

## Global Constraints

- Tiếng Việt cho mọi chuỗi hiển thị/comment.
- `requireTeacher()` (`lib/actions/classes.ts:25`, **ném Error** không redirect) luôn NGOÀI `try`.
- Không đụng: `annotations.ts` (theo quyết định người dùng — ghi chú bôi đen giữ nguyên),
  `importMaterial`, trang Giao bài, `confirm-submit-button.tsx` (vẫn dùng cho deleteClass/
  deleteStudent).
- Dịch các thông báo lỗi tiếng Anh sẽ nổi lên toast sang tiếng Việt. Đã kiểm: không test nào
  so khớp các chuỗi này (`grep` trong `tests/` → 0).

## Rủi ro R3 — `ActionForm` phải cho `redirect()` đi qua

`saveTeacherReview` có nút "Lưu & chấm bài tiếp" → `redirect(/teacher/review/<next>)`
(`reviews.ts:124`). `redirect()` ném `NEXT_REDIRECT`. `ActionForm.runAndNotify` hiện bắt mọi
lỗi thành toast "Không lưu được" → sẽ **nuốt mất** điều hướng.

**Sửa `runAndNotify`** cho bền cả hai khả năng (chưa chắc redirect nổi lên client dạng nào):

```ts
async function runAndNotify(action, formData, notify) {
  let result: ActionResult | undefined;
  try {
    result = await action(formData);
  } catch (error) {
    if (isNextControlFlowError(error)) throw error; // để Next điều hướng
    notify(NETWORK_FAIL);
    return;
  }
  if (result) notify(result); // nếu redirect được xử lý ngầm → result undefined → không toast
}

function isNextControlFlowError(error: unknown) {
  const digest =
    error && typeof error === "object" && "digest" in error ? String((error as any).digest) : "";
  return digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND";
}
```

Materials/questions không còn redirect nên thay đổi này là no-op với chúng — **vẫn phải hồi
quy** một nút Lưu câu hỏi sau khi sửa. **Cổng kiểm chứng: Task 4** (bấm "Lưu & chấm tiếp"
phải nhảy sang bài kế).

---

### Task 1: Lớp học (trang danh sách) — createClass, updateClassWeeklyGoal

**Files:** `lib/actions/classes.ts`, `app/teacher/classes/page.tsx`

- [ ] **B1:** `classes.ts` — `createClass` và `updateClassWeeklyGoal` → `Promise<ActionResult>`
  (thêm import `actionFail/actionOk/ActionResult`; `requireTeacher()` ngoài `try`; dịch
  `classSchema`/`studentSchema`/`weeklyGoalSchema` + các `throw` sang tiếng Việt). Thông báo:
  `` `Đã tạo lớp "${name}".` `` / `"Đã lưu chỉ tiêu tuần."`
- [ ] **B2:** `classes/page.tsx` — import `ActionForm, ActionSubmitButton` từ `@/components/action-form`;
  form `createClass` → `ActionForm` + nút → `ActionSubmitButton pendingLabel="Đang tạo…"`;
  form `updateClassWeeklyGoal` (`:66`) → `ActionForm` + nút "Lưu" → `ActionSubmitButton`.
- [ ] **B3:** Thêm `<NoticeToast>` vào `classes/page.tsx` đọc `searchParams.classesMessage/
  classesStatus` (chuẩn bị sẵn cho Xoá lớp/học viên ở Task 2-3). Trang thành async đọc
  `searchParams` nếu chưa.
- [ ] **B4:** `pnpm build`; browser: tạo lớp tạm → toast xanh; sửa chỉ tiêu → toast. Commit.

### Task 2: Chi tiết lớp — addStudent, removeStudentFromClass (toast); deleteClass (redirect+NoticeToast)

**Files:** `lib/actions/classes.ts`, `lib/class-notices.ts` (tạo), `app/teacher/classes/[classId]/page.tsx`

- [ ] **B1:** Tạo `lib/class-notices.ts` — `classNoticePath(status, message)` →
  `/teacher/classes?classesStatus=&classesMessage=` (soi `lib/assignment-notices.ts`).
- [ ] **B2:** `classes.ts` — `addStudent`, `removeStudentFromClass` → `ActionResult` (dịch).
  Thông báo: `` `Đã thêm học viên "${displayName}".` `` / `"Đã gỡ học viên khỏi lớp."`
- [ ] **B3:** `classes.ts` — `deleteClass` giữ redirect nhưng đổi thành
  `redirect(classNoticePath("success", "Đã xoá lớp."))`; nhánh không tìm thấy →
  `redirect(classNoticePath("error", "Không tìm thấy lớp này."))` (thay cho `throw`, để có
  popup thay vì màn lỗi).
- [ ] **B4:** `[classId]/page.tsx` — form `addStudent` → `ActionForm` + `ActionSubmitButton`;
  `removeStudentFromClass` `ConfirmSubmitButton` → `ActionDeleteButton`. `deleteClass` GIỮ
  NGUYÊN `<form action={deleteClass}>` + `ConfirmSubmitButton` (redirect).
- [ ] **B5:** `pnpm build`; browser: thêm học viên tạm → toast; gỡ học viên → toast; xoá một
  lớp tạm → về danh sách + NoticeToast "Đã xoá lớp." Commit.

### Task 3: Chi tiết học viên — resetRecipientAttempts (toast); deleteStudent (redirect+NoticeToast)

**Files:** `lib/actions/attempts.ts`, `lib/actions/classes.ts`, `app/teacher/students/[studentId]/page.tsx`

- [ ] **B1:** `attempts.ts` — `resetRecipientAttempts` → `ActionResult` (import action-result;
  `requireTeacher()` ngoài `try`; dịch "Missing recipient id."/"Assignment not found..."→VN).
  Thông báo: `"Đã đặt lại lượt làm cho bài này."`
- [ ] **B2:** `classes.ts` — `deleteStudent` đổi `redirect("/teacher/classes")` →
  `redirect(classNoticePath("success", "Đã xoá học viên."))`; nhánh lỗi → classNoticePath error.
- [ ] **B3:** `students/[studentId]/page.tsx` — `resetRecipientAttempts` `ConfirmSubmitButton`
  → `ActionDeleteButton`. `deleteStudent` GIỮ NGUYÊN plain form + `ConfirmSubmitButton`.
- [ ] **B4:** `pnpm build`; browser: reset một lượt → toast; (không xoá học viên thật của prod).
  Commit.

### Task 4 (CỔNG R3): Chấm bài — saveTeacherReview + comment snippets + ActionForm passthrough

**Files:** `components/action-form.tsx`, `lib/actions/reviews.ts`, `lib/actions/comment-snippets.ts`, `components/review-form.tsx`, `components/comment-bank.tsx`

- [ ] **B1:** `action-form.tsx` — sửa `runAndNotify` theo mục R3 (passthrough NEXT_REDIRECT,
  bỏ notify nếu result rỗng).
- [ ] **B2:** `reviews.ts` — `saveTeacherReview` → `Promise<ActionResult>`; `requireTeacher()`
  ngoài `try`; dịch `reviewSchema` + "Criteria scores must be valid JSON." + "Attempt not
  found..." → VN. Nhánh goNext GIỮ `redirect(...)` bên trong `try` (ActionForm sẽ cho qua).
  Non-goNext → `actionOk(\`Đã lưu nhận xét (band ${overallBand}).\`)`.
- [ ] **B3:** `comment-snippets.ts` — `createCommentSnippet`, `deleteCommentSnippet` →
  `ActionResult` (dịch). Thông báo: `"Đã thêm câu nhận xét mẫu."` / `"Đã xoá câu mẫu."`
- [ ] **B4:** `review-form.tsx` — `<form action={saveTeacherReview}>` → `<ActionForm>`; hai nút
  submit → `ActionSubmitButton` (nút goNext giữ `name="goNext" value="1"`, `pendingLabel="Đang lưu…"`).
- [ ] **B5:** `comment-bank.tsx` — hai `<form>` → `<ActionForm>`; giữ nút `✕`/"Thêm" là
  `<button type="submit">` bên trong (ActionForm lo notify).
- [ ] **B6 (CỔNG):** `pnpm build`; browser trên trang `/teacher/review/<id>`:
  1. "Lưu nhận xét" → toast xanh, đứng yên.
  2. Nếu có bài kế: "Lưu & chấm bài tiếp" → **PHẢI nhảy sang bài kế** (redirect qua được).
  3. Thêm/xoá câu nhận xét mẫu → toast.
  4. **Hồi quy:** quay lại `/teacher/materials`, Lưu câu hỏi → toast vẫn chạy.
  Nếu (2) hỏng (không nhảy, hoặc ra toast lỗi) → xem lại `isNextControlFlowError`. Commit.

### Task 5: Kiểm chứng + hồi quy + push

- [ ] **B1:** `pnpm build && pnpm test && pnpm lint` — sạch.
- [ ] **B2:** Hồi quy các trang ngoài phạm vi: Giao bài vẫn NoticeToast như cũ; annotations
  (ghi chú bôi đen) vẫn thêm/xoá được (không toast — đúng chủ ý).
- [ ] **B3:** Commit lẻ nếu còn; `git push origin feature/ielts-platform-mvp` (KHÔNG `git add -A`
  — tránh cuốn 17 file `tmp/` dở của người dùng; chỉ add file mình sửa).
- [ ] **B4:** Sau deploy, kiểm bản Vercel thật (thao tác vô hại: lưu lại đúng giá trị cũ).

## Ngoài phạm vi
Ghi chú bôi đen (annotations), chuyển Giao bài sang cơ chế A, gỡ dải băng/NoticeToast cũ.
