# Thiết kế: Pop-up (toast) báo lưu thành công/thất bại cho nút sửa ở trang Tài liệu

Ngày: 2026-07-15
Nhánh: `feature/ielts-platform-mvp`

## Mục tiêu

Bấm **Lưu câu hỏi** (và mọi nút Lưu/Xoá/Tạo ở khu soạn đề) phải hiện **pop-up báo
thành công hay thất bại**. Hiện tại các nút Lưu **không báo gì cả** — giáo viên sửa
xong 40 câu mà không biết câu nào đã vào DB, câu nào rơi vì JSON sai.

## Bối cảnh (đã khảo sát)

- **Nút Lưu im lặng hoàn toàn.** `updateMaterial` (`lib/actions/materials.ts:162`),
  `updateUnit` (`:318`), `updateQuestion` (`:480`) chỉ `revalidatePath("/teacher/materials")`
  rồi kết thúc — không trả thông báo, không chuyển trang. Lỗi thì `throw new Error(...)`
  → màn hình lỗi đỏ của Next.js, mất hết dữ liệu đang gõ.
- **Nút Xoá báo qua dải băng đầu trang.** `deleteMaterial` (`:206`), `deleteUnit` (`:385`),
  `deleteQuestion` (`:544`) gọi `redirect(materialNoticePath(...))` → `lib/material-notices.ts`
  đẩy `?materialsStatus=&materialsMessage=` → `app/teacher/materials/page.tsx:231-241`
  render dải băng. Nhược điểm: chuyển trang làm **mất vị trí cuộn** và **đóng sập mọi
  `<details>` đang mở**; thông báo nằm ở đầu trang trong khi giáo viên đang ở cuối trang.
- **Form nằm trong server component.** `app/teacher/materials/page.tsx` là server
  component, dùng `<form action={updateMaterial}>` (`:316`), `<form action={updateUnit}>`
  (`:430`); `QuestionFields` (`components/question-fields.tsx:245`) là client component đã
  sẵn `"use client"`.
- **Hai component dùng chung, phải cẩn thận:**
  - `ConfirmSubmitButton` (`components/confirm-submit-button.tsx`) dùng ở **4 nơi ngoài
    phạm vi**: `app/teacher/classes/[classId]/page.tsx`, `app/teacher/students/[studentId]/page.tsx`,
    `components/assignment-list.tsx`, ngoài `materials/page.tsx` và `question-fields.tsx`.
    → **Giữ nguyên, không sửa.** Thêm component mới cho phạm vi này.
  - `QuestionFields` dùng ở **2 nơi**: `materials/page.tsx:595` (`updateQuestion`) và
    `components/material-editor.tsx:215` (`createQuestion`, trang Tạo/Nhập tài liệu).
    → Đổi kiểu prop `formAction` **bắt buộc kéo theo** `createQuestion`.
- **Khuôn mẫu sẵn có để bám theo:** `components/material-import.tsx` đã dùng
  `useFormState`/`useFormStatus` từ `react-dom` (React 18.3, Next 14.2 — **không** phải
  `useActionState` của React 19) và `ImportMaterialState = { status, message }`.

## Quyết định thiết kế (đã thống nhất với người dùng)

1. **Toast góc dưới phải, tự tắt sau 4 giây**, có nút X. Không dùng hộp thoại bắt bấm OK
   — sửa 40 câu là phải bấm OK 40 lần.
2. **Phạm vi: trang Tài liệu** (`/teacher/materials`) + trang **Tạo/Nhập tài liệu**
   (do dùng chung `QuestionFields`, và để trang Tạo không khập khiễng 1 nút báo/2 nút im).
   Lớp học, Giao bài, Chấm bài, Học viên **để sau**.
3. **Bỏ `redirect` khỏi cả 9 action** → ở nguyên vị trí cuộn, `<details>` vẫn mở. Không chỉ
   nhóm Xoá: `createUnit` (`:279`, `:296`) và `updateUnit` (`:336`, `:353`) cũng đang
   `redirect` ở nhánh lỗi — tất cả chuyển thành `ActionResult`.
4. **Giữ dải băng đầu trang** — `importMaterial` (`:809`) vẫn redirect từ trang Tạo sang
   trang Tài liệu và cần chỗ báo.
5. **Thông báo nêu rõ đối tượng**: "Đã lưu câu 40.", "Đã lưu phần Part 4." — không phải
   "Thành công" chung chung, vì giáo viên mở nhiều khối sửa cùng lúc.
6. **Dịch thông báo lỗi phần câu hỏi sang tiếng Việt.** Hiện là tiếng Anh
   (`"Correct answer JSON must be valid JSON."` — `materials.ts:91`, `:65-75`). Pop-up báo
   lỗi bằng tiếng người dùng phải tự dịch thì vô dụng; và quy ước dự án là tiếng Việt.

## Kiến trúc

### File mới

**`lib/action-result.ts`** — thuần logic, không dính React, test được trực tiếp.

```ts
export type ActionResult = { ok: boolean; message: string };
export function actionOk(message: string): ActionResult;
export function actionFail(error: unknown, prefix: string): ActionResult;
```

`actionFail` rút thông điệp từ `Error` (hoặc `ZodError` đã bắt sẵn), ghép tiền tố dạng
`"Lưu câu 40 thất bại: <lý do>"`. Lỗi không phải `Error` → thông điệp mặc định
`"Có lỗi không xác định."` (không rò rỉ nội dung lạ ra giao diện).

**`components/toast.tsx`** — client.

- `ToastProvider` giữ mảng toast (`id`, `ok`, `message`), cung cấp `useToast()` trả về
  `notify(result: ActionResult)`.
- Khung hiển thị `fixed bottom-4 right-4 z-50`, xếp chồng, mỗi toast tự gỡ sau **4000ms**
  (`setTimeout`, dọn trong cleanup của `useEffect` để không rò khi gỡ sớm bằng nút X).
- Xanh (`emerald`) khi `ok`, đỏ (`red`) khi lỗi — bám bảng màu sẵn có của dự án, có biến
  thể dark mode như các chỗ khác.
- `role="status"` + `aria-live="polite"` cho thành công; `aria-live="assertive"` cho lỗi.

**`components/action-form.tsx`** — client. Ba thứ:

- `ActionForm` — bọc `<form>`, nhận `action: (fd: FormData) => Promise<ActionResult>`,
  gọi action rồi `notify(kết quả)`. **Children truyền nguyên từ server component** (chỉ
  `action` và children qua ranh giới → hợp lệ với RSC).
- `ActionSubmitButton` — nút Lưu, dùng `useFormStatus()`: khi `pending` thì hiện
  "Đang lưu…" và `disabled` (chặn double-click gây lưu hai lần).
- `ActionDeleteButton` — nút Xoá, giữ `window.confirm` như `ConfirmSubmitButton` cũ, dùng
  `formAction` để ghi đè action của form, rồi `notify`.

### File sửa

| File | Thay đổi |
|---|---|
| `app/teacher/layout.tsx` | Bọc `<AppShell>` trong `<ToastProvider>` |
| `lib/actions/materials.ts` | 9 action đổi kiểu trả về sang `Promise<ActionResult>`; bỏ toàn bộ `redirect` trong 9 action đó; dịch thông báo sang tiếng Việt |
| `app/teacher/materials/page.tsx` | `<form action=>` → `<ActionForm action=>`; `<button>` → `<ActionSubmitButton>`; `<ConfirmSubmitButton>` → `<ActionDeleteButton>` |
| `components/question-fields.tsx` | Như trên; prop `formAction` đổi kiểu sang `(fd) => Promise<ActionResult>` |
| `components/material-editor.tsx` | `createMaterial` / `createUnit` dùng `<ActionForm>` + `<ActionSubmitButton>` |

**9 action đổi kiểu:** `createMaterial`, `updateMaterial`, `deleteMaterial`, `createUnit`,
`updateUnit`, `deleteUnit`, `createQuestion`, `updateQuestion`, `deleteQuestion`.
`importMaterial` **giữ nguyên** (`useFormState` + redirect, đang chạy tốt, không đụng).

## Luồng dữ liệu

```
Bấm Lưu
  → ActionForm gọi updateQuestion(formData)     [client → server]
  → requireTeacher() → zod → prisma.updateMany → revalidatePath
  → trả { ok: true, message: "Đã lưu câu 40." } [server → client]
  → notify() → toast xanh góc dưới phải
  → 4 giây sau tự gỡ
```

`revalidatePath` vẫn render lại danh sách từ server. Trạng thái đóng/mở của `<details>` là
**trạng thái DOM không kiểm soát**, React reconcile giữ nguyên → khối đang mở vẫn mở.

## Xử lý lỗi

Ba loại, cả ba ra toast đỏ:

1. **Dữ liệu sai** (hay gặp: Đáp án/Lựa chọn JSON thiếu ngoặc) → zod hoặc `optionalJson`
   ném lỗi → bắt trong action → `"Lưu câu 40 thất bại: Đáp án phải là JSON hợp lệ."`
2. **Mạng/máy chủ hỏng** → `await action(fd)` ném ở client → `ActionForm` bắt →
   `"Không lưu được, kiểm tra kết nối rồi thử lại."` (thay cho màn hình lỗi Next.js).
3. **Không tìm thấy bản ghi của giáo viên này** → `"Không tìm thấy câu hỏi này."`

### `requireTeacher()` nằm ngoài khối `try`

Đã kiểm chứng trong `lib/actions/classes.ts:25-31`: `requireTeacher()` **ném
`new Error("Teacher access required.")`**, *không* gọi `redirect()`. Vậy nên **không có**
rủi ro `try/catch` nuốt mất `NEXT_REDIRECT` — sau khi gỡ `redirect` khỏi cả 9 action
(quyết định 3), trong `try` không còn nguồn nào ném `NEXT_REDIRECT`.

Dù vậy vẫn đặt `requireTeacher()` **ngoài `try`**, vì lý do khác: lỗi phân quyền không nên
bị làm mềm thành toast "Lưu thất bại" — giáo viên sẽ tưởng mình gõ sai JSON và ngồi sửa
JSON, trong khi thật ra phiên đăng nhập đã hết. Để nó ném ra như hiện nay (giữ nguyên hành
vi cũ, không hồi quy).

```ts
export async function updateQuestion(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher();   // ngoài try: lỗi phân quyền ném ra như cũ
  try {
    /* zod, prisma, revalidatePath */
    return actionOk(`Đã lưu câu ${order}.`);
  } catch (error) {
    return actionFail(error, `Lưu câu ${order}`);
  }
}
```

## Kiểm thử

- **Tự động** — `tests/action-result.test.ts` (vitest): `actionOk` dựng đúng
  `{ ok: true, message }`; `actionFail` ghép tiền tố + lấy `.message` của `Error`; giá trị
  không phải `Error` cho thông điệp mặc định chứ không ném tiếp.
- **Không thêm test cấu trúc** kiểu grep vào `materials/page.tsx` — quá giòn với việc đổi
  tên thẻ JSX.
- **Thủ công trên trình duyệt** (`pnpm dev`), Claude tự chạy rồi chụp màn hình gửi lại:
  1. Sửa câu 40 → bấm Lưu → toast xanh "Đã lưu câu 40." → 4 giây tự tắt.
  2. Phá JSON đáp án (bỏ dấu `]`) → bấm Lưu → toast đỏ nêu đúng lý do, dữ liệu đang gõ
     **không mất**.
  3. Xoá một câu → toast xanh, câu biến mất, **trang không nhảy về đầu**, khối đang mở
     vẫn mở.
  4. Lưu tài liệu / Lưu phần → toast đúng tên đối tượng.
- **Hồi quy phải kiểm:** nút Xoá ở Lớp học / Học viên / Giao bài vẫn chạy như cũ
  (`ConfirmSubmitButton` không đụng tới); `pnpm build` và `pnpm test` sạch.

## Ngoài phạm vi

- Toast cho Lớp học, Giao bài, Chấm bài, Học viên, ngân hàng nhận xét.
- Thay `window.confirm` bằng hộp thoại tự vẽ.
- Gỡ dải băng đầu trang hay `lib/material-notices.ts`.
- Đụng vào `importMaterial`.
