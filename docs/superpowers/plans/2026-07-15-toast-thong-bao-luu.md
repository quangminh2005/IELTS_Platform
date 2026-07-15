# Toast báo lưu thành công/thất bại — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mọi nút Lưu/Xoá/Tạo ở trang Tài liệu và trang Tạo/Nhập tài liệu bắn toast góc dưới phải báo thành công (xanh) hoặc thất bại (đỏ, kèm lý do tiếng Việt), thay vì im lặng hoặc dựng màn hình lỗi Next.js.

**Architecture:** Server action đổi từ "ném lỗi / `redirect`" sang **trả về `ActionResult = { ok, message }`**. Một `ToastProvider` gắn ở layout giáo viên giữ hàng đợi toast. Component `ActionForm` bọc `<form>`, gọi action, nhận kết quả rồi bắn toast — nhờ vậy ở trang Tài liệu gần như chỉ đổi tên thẻ JSX, toàn bộ ô nhập bên trong giữ nguyên.

**Tech Stack:** Next.js 14.2 App Router, React 18.3 (Next vendor bản canary — xem Rủi ro R1), TypeScript strict, Tailwind, zod 4.4, vitest.

**Spec:** [docs/superpowers/specs/2026-07-15-toast-thong-bao-luu-design.md](../specs/2026-07-15-toast-thong-bao-luu-design.md)

## Global Constraints

- **Tiếng Việt** cho mọi chuỗi hiển thị và comment (quy ước dự án, `CLAUDE.md`).
- **Không sửa `components/confirm-submit-button.tsx`** — còn 3 nơi ngoài phạm vi dùng: `app/teacher/classes/[classId]/page.tsx`, `app/teacher/students/[studentId]/page.tsx`, `components/assignment-list.tsx`. Chúng phải chạy y như cũ.
- **Không sửa `importMaterial`** và không gỡ `lib/material-notices.ts` / dải băng đầu trang (`app/teacher/materials/page.tsx:231-241`) — `importMaterial` vẫn redirect sang trang Tài liệu và cần chỗ báo.
- **`requireTeacher()` luôn nằm NGOÀI khối `try`** trong mọi action. Đã kiểm chứng `lib/actions/classes.ts:25-31`: nó **ném `Error`**, không `redirect`. Để nó ném ra như cũ — lỗi phân quyền không được làm mềm thành toast "Lưu thất bại", nếu không giáo viên sẽ ngồi sửa JSON trong khi thật ra hết phiên đăng nhập.
- **Toast tự tắt sau 4000ms.** Xanh = `emerald`, đỏ = `red`, có dark mode như các chỗ khác trong dự án.
- Tailwind có sẵn `animate-fade-in`, `shadow-card`, `shadow-pop` (`tailwind.config.ts`) — dùng lại, **không thêm thư viện**.
- Dùng `useFormState`/`useFormStatus` từ **`react-dom`** (React 18 style, như `components/material-import.tsx:4`), **không** dùng `useActionState` của React 19.
- **zod 4.4.3** — cú pháp `z.enum(values, "thông điệp")` và `z.string().min(n, "thông điệp")` hợp lệ, giữ nguyên hình dạng lời gọi sẵn có, chỉ đổi nội dung chuỗi.

## Rủi ro kỹ thuật

**R1 — `<form action={hàm client bất đồng bộ}>` có chạy không?**
`react-dom@18.3.1` cài trong `node_modules` **không** export `useFormStatus`/`useFormState`
(đã kiểm: cả hai trả `undefined` khi require thẳng bằng Node). Nhưng
`components/material-import.tsx` đang dùng chúng và chạy được → Next.js App Router **thay
React bằng bản canary vendored**, mà canary có đầy đủ form actions, gồm cả việc truyền hàm
client vào `action`. Suy luận này là nền tảng của `ActionForm`.

**Cổng kiểm chứng: Task 4 Step 5** — smoke test thật trên trình duyệt trước khi động vào
`materials/page.tsx`. Nếu hỏng, dừng lại, báo người dùng, và dùng phương án dự phòng:
`ActionForm` chuyển sang `onSubmit` + `e.preventDefault()` + `new FormData(e.currentTarget)`
+ `useTransition` cho trạng thái chờ, rồi truyền `pending` xuống nút qua context riêng
(vì `useFormStatus` chỉ theo dõi form action, không theo dõi `onSubmit`). Kiến trúc còn
lại (`ActionResult`, `ToastProvider`, 9 action, các bản dịch) **không đổi**.

**R2 — `<details>` có còn mở sau `revalidatePath` không?**
Trạng thái đóng/mở của `<details>` là trạng thái DOM không kiểm soát; React reconcile giữ
nguyên node nên phải mở. Kiểm ở Task 7 Step 3. Nếu sập: ghi nhận là hạn chế đã biết —
**không** tự ý chuyển `<details>` sang dạng có kiểm soát (ngoài phạm vi, đụng cả trang).

## File Structure

| File | Trách nhiệm |
|---|---|
| `lib/action-result.ts` | **Tạo.** Kiểu `ActionResult` + 2 hàm dựng. Thuần logic, không React → test được thẳng. |
| `tests/action-result.test.ts` | **Tạo.** Test cho trên. |
| `components/toast.tsx` | **Tạo.** `ToastProvider` + `useToast()` + khung hiển thị. Chỉ lo việc *hiện* toast. |
| `components/action-form.tsx` | **Tạo.** `ActionForm` / `ActionSubmitButton` / `ActionDeleteButton`. Chỉ lo nối form → action → toast. |
| `app/teacher/layout.tsx` | **Sửa.** Bọc `<AppShell>` trong `<ToastProvider>`. |
| `lib/actions/materials.ts` | **Sửa.** Dịch thông báo (Task 2); 9 action trả `ActionResult`; gỡ hết `redirect` trong 9 action đó. |
| `components/question-fields.tsx` | **Sửa.** Dùng component mới; đổi kiểu prop `formAction`/`deleteAction`. |
| `app/teacher/materials/page.tsx` | **Sửa.** Đổi thẻ form/nút sang component mới. |
| `components/material-editor.tsx` | **Sửa.** Đổi form Tạo tài liệu / Tạo phần sang component mới. |

**9 action đổi kiểu:** `createMaterial`, `updateMaterial`, `deleteMaterial`, `createUnit`,
`updateUnit`, `deleteUnit`, `createQuestion`, `updateQuestion`, `deleteQuestion`.

---

### Task 1: `ActionResult` — kiểu kết quả dùng chung

**Files:**
- Create: `lib/action-result.ts`
- Test: `tests/action-result.test.ts`

**Interfaces:**
- Consumes: (không có — task đầu tiên)
- Produces:
  - `type ActionResult = { ok: boolean; message: string }`
  - `actionOk(message: string): ActionResult`
  - `actionFail(error: unknown, prefix: string): ActionResult` — trả message dạng `` `${prefix} thất bại: ${lý do}` ``

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/action-result.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { actionFail, actionOk } from "../lib/action-result";

describe("actionOk", () => {
  it("đánh dấu thành công và giữ nguyên thông điệp", () => {
    expect(actionOk("Đã lưu câu 40.")).toEqual({ ok: true, message: "Đã lưu câu 40." });
  });
});

describe("actionFail", () => {
  it("ghép tiền tố với thông điệp của Error", () => {
    expect(actionFail(new Error("Đáp án phải là JSON hợp lệ."), "Lưu câu 40")).toEqual({
      ok: false,
      message: "Lưu câu 40 thất bại: Đáp án phải là JSON hợp lệ."
    });
  });

  it("dùng câu mặc định khi ném thứ không phải Error", () => {
    expect(actionFail("chuỗi ném thẳng", "Lưu câu 40")).toEqual({
      ok: false,
      message: "Lưu câu 40 thất bại: Có lỗi không xác định."
    });
  });

  it("dùng câu mặc định khi Error rỗng hoặc chỉ có khoảng trắng", () => {
    expect(actionFail(new Error("   "), "Xoá phần")).toEqual({
      ok: false,
      message: "Xoá phần thất bại: Có lỗi không xác định."
    });
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `npx vitest run tests/action-result.test.ts`
Expected: FAIL — `Failed to resolve import "../lib/action-result"`

- [ ] **Step 3: Viết implementation tối thiểu**

Tạo `lib/action-result.ts`:

```ts
// Kết quả server action trả về cho giao diện để bắn toast báo thành công/thất bại.
// Thuần dữ liệu, không dính React — dùng được cả ở server action lẫn client component.
export type ActionResult = {
  ok: boolean;
  message: string;
};

export function actionOk(message: string): ActionResult {
  return { ok: true, message };
}

// Ghép "<prefix> thất bại: <lý do>". Chỉ tin thông điệp của Error thật; thứ khác
// (chuỗi ném thẳng, object lạ, undefined) dùng câu mặc định để không đẩy nội dung
// khó hiểu ra trước mặt giáo viên.
export function actionFail(error: unknown, prefix: string): ActionResult {
  const reason =
    error instanceof Error && error.message.trim().length > 0
      ? error.message.trim()
      : "Có lỗi không xác định.";

  return { ok: false, message: `${prefix} thất bại: ${reason}` };
}
```

- [ ] **Step 4: Chạy test để chắc chắn nó pass**

Run: `npx vitest run tests/action-result.test.ts`
Expected: PASS — 4 test.

- [ ] **Step 5: Commit**

```bash
git add lib/action-result.ts tests/action-result.test.ts
git commit -m "feat: kiểu ActionResult cho server action báo kết quả"
```

---

### Task 2: Dịch thông báo lỗi trong `lib/actions/materials.ts` sang tiếng Việt

**Files:**
- Modify: `lib/actions/materials.ts` — `materialSchema` (`:27-32`), `unitSchema` (`:34-63`), `questionSchema` (`:65-75`), `optionalJson` (`:83-93`), `buildUnitMetadata` (`:97-133`)

**Interfaces:**
- Consumes: (không có)
- Produces: `optionalJson(value, label)` ném `` `${label} phải là JSON hợp lệ.` `` — các task sau truyền `label` là `"Lựa chọn"` / `"Đáp án"` để ra `"Đáp án phải là JSON hợp lệ."`

**Vì sao đứng riêng:** các thông điệp này hiện **chưa bao giờ đến mắt người dùng** (action
`throw` → màn hình lỗi Next.js). Từ Task 4 trở đi chúng thành nội dung chính của toast đỏ.
Dịch trước, một mình, để commit này thuần tuý là đổi chuỗi — dễ soát, dễ revert.

**Đã kiểm:** không có test nào so khớp các chuỗi tiếng Anh này
(`grep "must be valid JSON|must be at least|Choose a valid" tests/` → không khớp).
`importMaterialSchema`/`importUnitSchema`/`importQuestionSchema` là schema **riêng** cho
`importMaterial` — **không đụng tới**.

- [ ] **Step 1: Dịch `materialSchema`**

Thay `:27-32`:

```ts
const materialSchema = z.object({
  title: z.string().trim().min(2, "Tiêu đề tài liệu cần ít nhất 2 ký tự."),
  skill: z.enum(skills, "Chọn một kỹ năng IELTS hợp lệ."),
  sourceLabel: z.string().trim().optional(),
  description: z.string().trim().optional()
});
```

- [ ] **Step 2: Dịch `unitSchema`**

Trong `:34-63`, đổi các thông điệp (giữ nguyên cấu trúc và `superRefine`):

```ts
    materialId: z.string().trim().min(1, "Chọn tài liệu."),
    unitType: z.enum(unitTypes, "Chọn loại phần hợp lệ."),
    unitNumber: z.coerce.number().int().min(1, "Số thứ tự phải từ 1 trở lên."),
    title: z.string().trim().min(2, "Tiêu đề phần cần ít nhất 2 ký tự."),
```

và trong `defaultTimeLimitMinutes`:

```ts
      z.coerce.number().int().min(1, "Thời gian phải từ 1 phút trở lên.").optional()
```

Thông điệp `"Phần đọc/viết cần có Nội dung."` trong `superRefine` đã là tiếng Việt — giữ nguyên.

- [ ] **Step 3: Dịch `questionSchema`**

Thay `:65-75`:

```ts
const questionSchema = z.object({
  assignableUnitId: z.string().trim().min(1, "Chọn phần cho câu hỏi."),
  order: z.coerce.number().int().min(1, "Thứ tự phải từ 1 trở lên."),
  questionType: z.string().trim().min(1, "Thiếu dạng câu."),
  prompt: z.string().trim().min(1, "Đề bài không được để trống."),
  optionsJson: z.string().trim().optional(),
  correctAnswerJson: z.string().trim().optional(),
  explanation: z.string().trim().optional(),
  answerEvidence: z.string().trim().optional(),
  points: z.coerce.number().int().min(1, "Điểm phải từ 1 trở lên.")
});
```

- [ ] **Step 4: Dịch `optionalJson` và `buildUnitMetadata`**

Thay `:83-93`:

```ts
function optionalJson(value: string | undefined, label: string) {
  if (!value) {
    return null;
  }

  try {
    return JSON.stringify(JSON.parse(value));
  } catch {
    throw new Error(`${label} phải là JSON hợp lệ.`);
  }
}
```

Trong `buildUnitMetadata` (`:97-133`), đổi dòng ném lỗi:

```ts
      throw new Error("Metadata phải là JSON hợp lệ.");
```

- [ ] **Step 5: Kiểm build + test**

Run: `pnpm build && pnpm test`
Expected: cả hai PASS (đây mới chỉ là đổi chuỗi; chưa đổi hành vi).

- [ ] **Step 6: Commit**

```bash
git add lib/actions/materials.ts
git commit -m "i18n: dịch thông báo lỗi phần tài liệu sang tiếng Việt"
```

---

### Task 3: `ToastProvider` — khung hiện toast

**Files:**
- Create: `components/toast.tsx`
- Modify: `app/teacher/layout.tsx` (toàn bộ file, 9 dòng)

**Interfaces:**
- Consumes: `ActionResult` từ `lib/action-result` (Task 1)
- Produces:
  - `<ToastProvider>{children}</ToastProvider>` — client component
  - `useToast(): { notify: (result: ActionResult) => void }` — ném `Error` nếu gọi ngoài provider

**Ghi chú test:** `tests/` chỉ có vitest thuần, **không có jsdom / @testing-library**
(xem `vitest.config.ts` — không khai báo `environment`). Không viết unit test cho component
React ở đây; kiểm chứng bằng trình duyệt ở Task 4 và Task 7. Không thêm hạ tầng test mới
cho một component 60 dòng.

- [ ] **Step 1: Tạo `components/toast.tsx`**

```tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import type { ActionResult } from "@/lib/action-result";

type Toast = ActionResult & { id: number };

type ToastContextValue = {
  notify: (result: ActionResult) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

// 4 giây: đủ đọc một câu ngắn mà không cản việc sửa câu tiếp theo.
const TOAST_MS = 4000;

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast phải nằm trong <ToastProvider>.");
  }

  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((result: ActionResult) => {
    const id = nextId.current;
    nextId.current += 1;
    setToasts((current) => [...current, { ...result, id }]);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* pointer-events-none để khung rỗng không chặn click vào trang phía dưới. */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      role="status"
      // Lỗi phải được trình đọc màn hình đọc ngay, thành công thì đợi lượt.
      aria-live={toast.ok ? "polite" : "assertive"}
      className={`pointer-events-auto flex animate-fade-in items-start gap-3 rounded-lg border px-4 py-3 text-sm font-medium shadow-pop ${
        toast.ok
          ? "border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          : "border-red-400/60 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"
      }`}
    >
      <span className="flex-1 leading-5">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Đóng thông báo"
        className="-mr-1 -mt-0.5 shrink-0 rounded px-1 text-base leading-none opacity-70 transition-opacity hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Gắn provider vào layout giáo viên**

Thay **toàn bộ** `app/teacher/layout.tsx`:

```tsx
import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/toast";

export default function TeacherLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ToastProvider>
      <AppShell role="teacher">{children}</AppShell>
    </ToastProvider>
  );
}
```

- [ ] **Step 3: Kiểm typecheck + build**

Run: `pnpm build`
Expected: PASS. Chưa có gì gọi `notify` nên giao diện **không đổi** — đây chỉ là bước dựng khung.

- [ ] **Step 4: Commit**

```bash
git add components/toast.tsx app/teacher/layout.tsx
git commit -m "feat: ToastProvider góc dưới phải cho khu vực giáo viên"
```

---

### Task 4: `ActionForm` + kiểm chứng R1 trên trình duyệt

**Files:**
- Create: `components/action-form.tsx`
- Modify: `lib/actions/materials.ts` — `createQuestion` (`:429-478`), `updateQuestion` (`:480-542`)
- Modify: `components/question-fields.tsx` — thẻ `<form>` (`:245`, `:428`) + nút Lưu (`:417`) + kiểu prop (`:24`)

**Interfaces:**
- Consumes: `ActionResult`/`actionOk`/`actionFail` (Task 1); `optionalJson` đã dịch (Task 2); `useToast` (Task 3)
- Produces:
  - `type ServerAction = (formData: FormData) => Promise<ActionResult>`
  - `<ActionForm action={ServerAction} className?={string}>{children}</ActionForm>`
  - `<ActionSubmitButton className?={string} pendingLabel?={string}>{children}</ActionSubmitButton>`
  - `<ActionDeleteButton action={ServerAction} confirmMessage={string} className?={string}>{children}</ActionDeleteButton>`
  - `createQuestion(formData): Promise<ActionResult>`, `updateQuestion(formData): Promise<ActionResult>`

**Đây là task cổng.** Nó chứng minh R1 trên một mặt cắt nhỏ trước khi các task sau đụng vào
file lớn. Không đi tiếp khi Step 5 chưa xanh.

- [ ] **Step 1: Tạo `components/action-form.tsx`**

```tsx
"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";

export type ServerAction = (formData: FormData) => Promise<ActionResult>;

// Mạng hỏng hoặc máy chủ ném lỗi ngoài tầm kiểm soát của action. Không để Next.js
// dựng màn hình lỗi đỏ (giáo viên mất hết nội dung đang gõ) — báo bằng toast để
// bấm Lưu lại là xong.
const NETWORK_FAIL: ActionResult = {
  ok: false,
  message: "Không lưu được, kiểm tra kết nối rồi thử lại."
};

async function runAndNotify(
  action: ServerAction,
  formData: FormData,
  notify: (result: ActionResult) => void
) {
  try {
    notify(await action(formData));
  } catch {
    notify(NETWORK_FAIL);
  }
}

export function ActionForm({
  action,
  className,
  children
}: {
  action: ServerAction;
  className?: string;
  children: ReactNode;
}) {
  const { notify } = useToast();

  return (
    <form className={className} action={(formData) => runAndNotify(action, formData, notify)}>
      {children}
    </form>
  );
}

// Khoá nút trong lúc chờ để bấm hai lần không thành lưu hai lần.
export function ActionSubmitButton({
  className,
  pendingLabel = "Đang lưu…",
  children
}: {
  className?: string;
  pendingLabel?: string;
  children: ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className ?? ""} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

// formAction ghi đè action của form → cùng một <form> vừa Lưu vừa Xoá được.
export function ActionDeleteButton({
  action,
  confirmMessage,
  className,
  children
}: {
  action: ServerAction;
  confirmMessage: string;
  className?: string;
  children: ReactNode;
}) {
  const { notify } = useToast();
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className ?? ""} disabled:cursor-not-allowed disabled:opacity-60`}
      formAction={(formData) => runAndNotify(action, formData, notify)}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Thêm import `ActionResult` vào `lib/actions/materials.ts`**

Thêm cạnh các import sẵn có ở đầu file:

```ts
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
```

- [ ] **Step 3: Đổi `createQuestion` + `updateQuestion` sang trả `ActionResult`**

Thay **toàn bộ** `createQuestion`:

```ts
export async function createQuestion(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ
  const order = String(formData.get("order") ?? "?");

  try {
    const parsed = questionSchema.safeParse({
      assignableUnitId: formData.get("assignableUnitId"),
      order: formData.get("order"),
      questionType: formData.get("questionType"),
      prompt: formData.get("prompt"),
      optionsJson: formData.get("optionsJson"),
      correctAnswerJson: formData.get("correctAnswerJson"),
      explanation: formData.get("explanation"),
      answerEvidence: formData.get("answerEvidence"),
      points: formData.get("points")
    });

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Thông tin câu hỏi chưa hợp lệ.");
    }

    const unit = await prisma.assignableUnit.findFirst({
      where: { id: parsed.data.assignableUnitId, material: { teacherId: teacher.id } },
      select: { id: true }
    });

    if (!unit) {
      throw new Error("Không tìm thấy phần này của giáo viên.");
    }

    await prisma.question.create({
      data: {
        assignableUnitId: unit.id,
        order: parsed.data.order,
        questionType: parsed.data.questionType,
        prompt: parsed.data.prompt,
        optionsJson: optionalJson(parsed.data.optionsJson, "Lựa chọn"),
        correctAnswerJson: optionalJson(parsed.data.correctAnswerJson, "Đáp án"),
        explanation: optionalText(parsed.data.explanation),
        answerEvidence: optionalText(parsed.data.answerEvidence),
        points: parsed.data.points
      }
    });

    revalidatePath("/teacher/materials");
    return actionOk(`Đã tạo câu ${parsed.data.order}.`);
  } catch (error) {
    return actionFail(error, `Tạo câu ${order}`);
  }
}
```

Thay **toàn bộ** `updateQuestion`:

```ts
export async function updateQuestion(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ
  const order = String(formData.get("order") ?? "?");

  try {
    const id = idSchema.parse(formData.get("questionId"));
    const parsed = questionSchema.safeParse({
      assignableUnitId: formData.get("assignableUnitId"),
      order: formData.get("order"),
      questionType: formData.get("questionType"),
      prompt: formData.get("prompt"),
      optionsJson: formData.get("optionsJson"),
      correctAnswerJson: formData.get("correctAnswerJson"),
      explanation: formData.get("explanation"),
      answerEvidence: formData.get("answerEvidence"),
      points: formData.get("points")
    });

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Thông tin câu hỏi chưa hợp lệ.");
    }

    const unit = await prisma.assignableUnit.findFirst({
      where: { id: parsed.data.assignableUnitId, material: { teacherId: teacher.id } },
      select: { id: true }
    });

    if (!unit) {
      throw new Error("Không tìm thấy phần này của giáo viên.");
    }

    const result = await prisma.question.updateMany({
      where: { id, assignableUnit: { material: { teacherId: teacher.id } } },
      data: {
        assignableUnitId: unit.id,
        order: parsed.data.order,
        questionType: parsed.data.questionType,
        prompt: parsed.data.prompt,
        optionsJson: optionalJson(parsed.data.optionsJson, "Lựa chọn"),
        correctAnswerJson: optionalJson(parsed.data.correctAnswerJson, "Đáp án"),
        explanation: optionalText(parsed.data.explanation),
        answerEvidence: optionalText(parsed.data.answerEvidence),
        points: parsed.data.points
      }
    });

    if (result.count === 0) {
      throw new Error("Không tìm thấy câu hỏi này.");
    }

    revalidatePath("/teacher/materials");
    return actionOk(`Đã lưu câu ${parsed.data.order}.`);
  } catch (error) {
    return actionFail(error, `Lưu câu ${order}`);
  }
}
```

- [ ] **Step 4: Đổi thẻ form + nút Lưu trong `components/question-fields.tsx`**

Thêm import:

```tsx
import { ActionForm, ActionSubmitButton, type ServerAction } from "@/components/action-form";
```

Đổi kiểu prop trong `QuestionFieldsProps` (`:24`) từ
`formAction: (formData: FormData) => void | Promise<void>;` thành:

```tsx
  formAction: ServerAction;
```

Đổi thẻ mở form (`:245`) từ `<form action={formAction} className="mt-2 grid gap-3">` thành:

```tsx
    <ActionForm action={formAction} className="mt-2 grid gap-3">
```

Đổi thẻ đóng `</form>` (`:428`) thành `</ActionForm>`.

Đổi nút Lưu (`:417`) từ `<button className={secondaryButtonClass}>{submitLabel}</button>` thành:

```tsx
        <ActionSubmitButton className={secondaryButtonClass}>{submitLabel}</ActionSubmitButton>
```

**Chưa động tới** `ConfirmSubmitButton` xoá câu hỏi ở `:419-426` — để Task 5. Ở bước này
`question-fields.tsx` import cả `ConfirmSubmitButton` lẫn các component mới; đó là trạng
thái trung gian có chủ ý, build vẫn xanh.

- [ ] **Step 5: 🚦 CỔNG — kiểm chứng R1 trên trình duyệt**

```bash
pnpm build
```
Expected: PASS.

Rồi chạy dev server (dùng `preview_start`, **không** dùng Bash) và tự bấm thử:

1. Mở `/teacher/materials` → mở một tài liệu → Danh sách câu hỏi → mở "Sửa câu N".
2. Bấm **Lưu câu hỏi** không đổi gì → **phải thấy toast xanh "Đã lưu câu N."** ở góc dưới
   phải, tự tắt sau 4 giây.
3. Xoá dấu `]` cuối ô **Đáp án (JSON)** → bấm Lưu → **toast đỏ**
   `Lưu câu N thất bại: Đáp án phải là JSON hợp lệ.` (tiếng Việt — nhờ Task 2), và nội
   dung đang gõ **không mất**.
4. Xem console trình duyệt: không có lỗi React.

**Nếu bước 2 không hiện toast** (vd. form submit theo kiểu điều hướng cả trang, hoặc React
báo lỗi về `action`): R1 sai. **DỪNG**, báo người dùng, chuyển `ActionForm` sang phương án
dự phòng `onSubmit` + `useTransition` mô tả ở mục Rủi ro, rồi chạy lại Step 5.

- [ ] **Step 6: Commit**

```bash
git add components/action-form.tsx components/question-fields.tsx lib/actions/materials.ts
git commit -m "feat: toast báo kết quả khi lưu câu hỏi"
```

---

### Task 5: Nút Xoá câu hỏi

**Files:**
- Modify: `lib/actions/materials.ts` — `deleteQuestion` (`:544-572`)
- Modify: `components/question-fields.tsx` — import (`:4`), kiểu prop `deleteAction` (`:31`), nút xoá (`:419-426`)

**Interfaces:**
- Consumes: `ActionDeleteButton`, `ServerAction` (Task 4); `actionOk`/`actionFail` (Task 1)
- Produces: `deleteQuestion(formData): Promise<ActionResult>`

- [ ] **Step 1: Đổi `deleteQuestion` sang `ActionResult`**

Thay **toàn bộ** `deleteQuestion`:

```ts
export async function deleteQuestion(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const id = idSchema.parse(formData.get("questionId"));

    const question = await prisma.question.findFirst({
      where: { id, assignableUnit: { material: { teacherId: teacher.id } } },
      select: { id: true, order: true }
    });

    if (!question) {
      throw new Error("Không tìm thấy câu hỏi này.");
    }

    await prisma.question.delete({ where: { id: question.id } });

    revalidatePath("/teacher/materials");
    return actionOk(`Đã xoá câu ${question.order}.`);
  } catch (error) {
    return actionFail(error, "Xoá câu hỏi");
  }
}
```

Hai điểm: **không còn `redirect`**; `select` thêm `order` để thông báo nêu đúng số câu.

- [ ] **Step 2: Đổi nút xoá trong `components/question-fields.tsx`**

Xoá dòng import `ConfirmSubmitButton` (`:4`):

```tsx
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
```

Đổi import từ `@/components/action-form` (đã thêm ở Task 4) thành:

```tsx
import {
  ActionDeleteButton,
  ActionForm,
  ActionSubmitButton,
  type ServerAction
} from "@/components/action-form";
```

Đổi kiểu prop `deleteAction` (`:31`) từ
`deleteAction?: (formData: FormData) => void | Promise<void>;` thành:

```tsx
  deleteAction?: ServerAction;
```

Thay khối `:419-426`:

```tsx
          <ActionDeleteButton
            action={deleteAction}
            confirmMessage={deleteConfirm ?? "Xoá câu hỏi này? Không thể hoàn tác."}
            className={dangerButtonClass}
          >
            Xoá câu hỏi
          </ActionDeleteButton>
```

- [ ] **Step 3: Kiểm build**

Run: `pnpm build`
Expected: PASS. `components/confirm-submit-button.tsx` **vẫn còn** trong repo và vẫn được
3 trang ngoài phạm vi dùng — không xoá file.

- [ ] **Step 4: Kiểm trên trình duyệt**

Ở `/teacher/materials`, tạo một câu hỏi tạm để xoá (hoặc chọn câu không quan trọng), mở
"Sửa câu N" → bấm **Xoá câu hỏi** → hộp xác nhận hiện → OK → **toast xanh "Đã xoá câu N."**,
câu biến mất, **trang KHÔNG nhảy về đầu**.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/materials.ts components/question-fields.tsx
git commit -m "feat: toast khi xoá câu hỏi, bỏ chuyển trang"
```

---

### Task 6: Nhóm action Tài liệu + Phần, và nối trang Tài liệu / trang Tạo

**Files:**
- Modify: `lib/actions/materials.ts` — `createMaterial` (`:135-160`), `updateMaterial` (`:162-204`), `deleteMaterial` (`:206-260`), `createUnit` (`:262-316`), `updateUnit` (`:318-383`), `deleteUnit` (`:385-427`)
- Modify: `app/teacher/materials/page.tsx` — import (`:4-7`), form tài liệu (`:316-386`), form phần (`:430-577`)
- Modify: `components/material-editor.tsx` — form tạo tài liệu (`:65-104`), form tạo phần (`:106-209`)

**Interfaces:**
- Consumes: `ActionForm`, `ActionSubmitButton`, `ActionDeleteButton` (Task 4); `actionOk`/`actionFail` (Task 1)
- Produces: 6 action còn lại đều `(formData) => Promise<ActionResult>`

- [ ] **Step 1: Đổi `createMaterial` + `updateMaterial` + `deleteMaterial`**

```ts
export async function createMaterial(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const parsed = materialSchema.safeParse({
      title: formData.get("title"),
      skill: formData.get("skill"),
      sourceLabel: formData.get("sourceLabel"),
      description: formData.get("description")
    });

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Thông tin tài liệu chưa hợp lệ.");
    }

    await prisma.material.create({
      data: {
        teacherId: teacher.id,
        skill: parsed.data.skill,
        title: parsed.data.title,
        sourceLabel: optionalText(parsed.data.sourceLabel),
        description: optionalText(parsed.data.description)
      }
    });

    revalidatePath("/teacher");
    revalidatePath("/teacher/materials");
    return actionOk(`Đã tạo tài liệu "${parsed.data.title}".`);
  } catch (error) {
    return actionFail(error, "Tạo tài liệu");
  }
}

export async function updateMaterial(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const id = idSchema.parse(formData.get("materialId"));
    const parsed = materialSchema.safeParse({
      title: formData.get("title"),
      skill: formData.get("skill"),
      sourceLabel: formData.get("sourceLabel"),
      description: formData.get("description")
    });

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Thông tin tài liệu chưa hợp lệ.");
    }

    const result = await prisma.material.updateMany({
      where: { id, teacherId: teacher.id },
      data: {
        skill: parsed.data.skill,
        title: parsed.data.title,
        sourceLabel: optionalText(parsed.data.sourceLabel),
        description: optionalText(parsed.data.description)
      }
    });

    if (result.count === 0) {
      throw new Error("Không tìm thấy tài liệu này.");
    }

    await prisma.assignableUnit.updateMany({
      where: { materialId: id },
      data: { skill: parsed.data.skill }
    });

    revalidatePath("/teacher");
    revalidatePath("/teacher/materials");
    return actionOk(`Đã lưu tài liệu "${parsed.data.title}".`);
  } catch (error) {
    return actionFail(error, "Lưu tài liệu");
  }
}

export async function deleteMaterial(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const id = idSchema.parse(formData.get("materialId"));

    const material = await prisma.material.findFirst({
      where: { id, teacherId: teacher.id },
      select: {
        id: true,
        units: {
          select: {
            _count: { select: { assignmentUnits: true, answers: true, highlights: true } }
          }
        }
      }
    });

    if (!material) {
      throw new Error("Không tìm thấy tài liệu này.");
    }

    // Cho phép xoá kể cả khi đã giao bài / có bài làm. Xoá tài liệu kéo theo (cascade ở
    // DB) các phần, câu hỏi, câu trả lời và đánh dấu liên quan; các bài tập đã giao có
    // thể còn lại nhưng mất phần dùng tài liệu này.
    const answerCount = material.units.reduce((sum, unit) => sum + unit._count.answers, 0);
    const assignedCount = material.units.reduce(
      (sum, unit) => sum + unit._count.assignmentUnits,
      0
    );

    await prisma.material.delete({ where: { id: material.id } });

    revalidatePath("/teacher");
    revalidatePath("/teacher/materials");

    return actionOk(
      answerCount > 0 || assignedCount > 0
        ? `Đã xoá tài liệu (kèm ${answerCount} câu trả lời của học sinh${
            assignedCount > 0 ? `, gỡ khỏi ${assignedCount} lượt giao bài` : ""
          }).`
        : "Đã xoá tài liệu."
    );
  } catch (error) {
    return actionFail(error, "Xoá tài liệu");
  }
}
```

- [ ] **Step 2: Đổi `createUnit` + `updateUnit` + `deleteUnit`**

```ts
export async function createUnit(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const parsed = unitSchema.safeParse({
      materialId: formData.get("materialId"),
      unitType: formData.get("unitType"),
      unitNumber: formData.get("unitNumber"),
      title: formData.get("title"),
      instructions: formData.get("instructions"),
      content: formData.get("content"),
      audioUrl: formData.get("audioUrl"),
      transcript: formData.get("transcript"),
      defaultTimeLimitMinutes: formData.get("defaultTimeLimitMinutes"),
      metadataJson: formData.get("metadataJson"),
      imageUrlsJson: formData.get("imageUrlsJson")
    });

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Thông tin phần chưa hợp lệ.");
    }

    const material = await prisma.material.findFirst({
      where: { id: parsed.data.materialId, teacherId: teacher.id },
      select: { id: true, skill: true }
    });

    if (!material) {
      throw new Error("Không tìm thấy tài liệu của giáo viên này.");
    }

    await prisma.assignableUnit.create({
      data: {
        materialId: material.id,
        skill: material.skill,
        unitType: parsed.data.unitType,
        unitNumber: parsed.data.unitNumber,
        title: parsed.data.title,
        instructions: optionalText(parsed.data.instructions),
        content: parsed.data.content ?? "",
        audioUrl: optionalText(parsed.data.audioUrl),
        transcript: optionalText(parsed.data.transcript),
        defaultTimeLimitMinutes: parsed.data.defaultTimeLimitMinutes ?? null,
        metadataJson: buildUnitMetadata(parsed.data.metadataJson, parsed.data.imageUrlsJson)
      }
    });

    revalidatePath("/teacher/materials");
    return actionOk(`Đã tạo phần "${parsed.data.title}".`);
  } catch (error) {
    return actionFail(error, "Tạo phần");
  }
}

export async function updateUnit(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const id = idSchema.parse(formData.get("unitId"));
    const parsed = unitSchema.safeParse({
      materialId: formData.get("materialId"),
      unitType: formData.get("unitType"),
      unitNumber: formData.get("unitNumber"),
      title: formData.get("title"),
      instructions: formData.get("instructions"),
      content: formData.get("content"),
      audioUrl: formData.get("audioUrl"),
      transcript: formData.get("transcript"),
      defaultTimeLimitMinutes: formData.get("defaultTimeLimitMinutes"),
      metadataJson: formData.get("metadataJson"),
      imageUrlsJson: formData.get("imageUrlsJson")
    });

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Thông tin phần chưa hợp lệ.");
    }

    const material = await prisma.material.findFirst({
      where: { id: parsed.data.materialId, teacherId: teacher.id },
      select: { id: true, skill: true }
    });

    if (!material) {
      throw new Error("Không tìm thấy tài liệu của giáo viên này.");
    }

    const result = await prisma.assignableUnit.updateMany({
      where: { id, material: { teacherId: teacher.id } },
      data: {
        materialId: material.id,
        skill: material.skill,
        unitType: parsed.data.unitType,
        unitNumber: parsed.data.unitNumber,
        title: parsed.data.title,
        instructions: optionalText(parsed.data.instructions),
        content: parsed.data.content ?? "",
        audioUrl: optionalText(parsed.data.audioUrl),
        transcript: optionalText(parsed.data.transcript),
        defaultTimeLimitMinutes: parsed.data.defaultTimeLimitMinutes ?? null,
        metadataJson: buildUnitMetadata(parsed.data.metadataJson, parsed.data.imageUrlsJson)
      }
    });

    if (result.count === 0) {
      throw new Error("Không tìm thấy phần này.");
    }

    revalidatePath("/teacher/materials");
    return actionOk(`Đã lưu phần "${parsed.data.title}".`);
  } catch (error) {
    return actionFail(error, "Lưu phần");
  }
}

export async function deleteUnit(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const id = idSchema.parse(formData.get("unitId"));

    const unit = await prisma.assignableUnit.findFirst({
      where: { id, material: { teacherId: teacher.id } },
      select: {
        id: true,
        title: true,
        _count: { select: { assignmentUnits: true, answers: true, highlights: true } }
      }
    });

    if (!unit) {
      throw new Error("Không tìm thấy phần này.");
    }

    if (unit._count.assignmentUnits > 0 || unit._count.answers > 0 || unit._count.highlights > 0) {
      throw new Error("Phần này đã được giao hoặc đã có bài làm nên không xoá được.");
    }

    await prisma.assignableUnit.delete({ where: { id: unit.id } });

    revalidatePath("/teacher/materials");
    return actionOk(`Đã xoá phần "${unit.title}".`);
  } catch (error) {
    return actionFail(error, "Xoá phần");
  }
}
```

Lưu ý: thông báo "đã giao hoặc đã có bài làm" trước đây là tiếng Anh và hiện qua dải băng;
giờ là tiếng Việt qua toast đỏ. `select` thêm `title` để nêu đúng tên phần.

- [ ] **Step 3: Nối form trong `app/teacher/materials/page.tsx`**

Xoá dòng import `ConfirmSubmitButton` (`:4`) và thêm:

```tsx
import { ActionDeleteButton, ActionForm, ActionSubmitButton } from "@/components/action-form";
```

**Form tài liệu** — `:316` `<form action={updateMaterial} className="mt-4 grid gap-3">` →
`<ActionForm action={updateMaterial} className="mt-4 grid gap-3">`; `</form>` (`:386`) →
`</ActionForm>`. Thay khối nút (`:376-385`):

```tsx
                        <div className="flex flex-wrap gap-2">
                          <ActionSubmitButton className={secondaryButtonClass}>
                            Lưu tài liệu
                          </ActionSubmitButton>
                          <ActionDeleteButton
                            action={deleteMaterial}
                            confirmMessage={`Xoá tài liệu "${material.title}"?\n\nSẽ xoá toàn bộ phần, câu hỏi VÀ CẢ BÀI LÀM/ĐÁP ÁN của học sinh thuộc tài liệu này. Các bài tập đã giao có dùng tài liệu này sẽ bị gỡ phần đó. KHÔNG THỂ HOÀN TÁC.`}
                            className={dangerButtonClass}
                          >
                            Xoá tài liệu
                          </ActionDeleteButton>
                        </div>
```

**Form phần** — `:430` `<form action={updateUnit} className="mt-4 grid gap-3">` →
`<ActionForm action={updateUnit} className="mt-4 grid gap-3">`; `</form>` (`:577`) →
`</ActionForm>`. Thay khối nút (`:567-576`):

```tsx
                          <div className="flex flex-wrap gap-2">
                            <ActionSubmitButton className={secondaryButtonClass}>
                              Lưu phần
                            </ActionSubmitButton>
                            <ActionDeleteButton
                              action={deleteUnit}
                              confirmMessage={`Xoá phần "${unit.title}" cùng toàn bộ câu hỏi? Không thể hoàn tác.`}
                              className={dangerButtonClass}
                            >
                              Xoá phần
                            </ActionDeleteButton>
                          </div>
```

- [ ] **Step 4: Nối form trong `components/material-editor.tsx`**

Thêm import:

```tsx
import { ActionForm, ActionSubmitButton } from "@/components/action-form";
```

**Form tạo tài liệu** — `:65` →
`<ActionForm action={createMaterial} className="rounded-xl border border-border bg-card p-5 shadow-card">`;
`</form>` (`:104`) → `</ActionForm>`. Nút (`:101-103`) →

```tsx
        <ActionSubmitButton
          pendingLabel="Đang tạo…"
          className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
        >
          Tạo tài liệu
        </ActionSubmitButton>
```

**Form tạo phần** — `:106` →
`<ActionForm action={createUnit} className="rounded-xl border border-border bg-card p-5 shadow-card">`;
`</form>` (`:209`) → `</ActionForm>`. Nút (`:206-208`) →

```tsx
        <ActionSubmitButton
          pendingLabel="Đang tạo…"
          className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
        >
          Tạo phần
        </ActionSubmitButton>
```

`MaterialEditor` là server component (không có `"use client"`) — `ActionForm` là client
component nhận children từ server, hợp lệ với RSC. **Không** thêm `"use client"` vào file này.

- [ ] **Step 5: Kiểm build + test**

Run: `pnpm build && pnpm test`
Expected: cả hai PASS. `tests/material-notices.test.ts` vẫn phải xanh (`materialNoticePath`
còn dùng cho `importMaterial`).

- [ ] **Step 6: Commit**

```bash
git add lib/actions/materials.ts app/teacher/materials/page.tsx components/material-editor.tsx
git commit -m "feat: toast cho nút lưu/xoá tài liệu và phần"
```

---

### Task 7: Kiểm chứng đầu-cuối + hồi quy

**Files:** không sửa (chỉ kiểm; nếu phát hiện lỗi thì sửa rồi commit riêng)

**Interfaces:**
- Consumes: toàn bộ Task 1-6
- Produces: (không có — task kiểm chứng)

- [ ] **Step 1: Kiểm tự động**

```bash
pnpm build && pnpm test && pnpm lint
```
Expected: cả ba sạch.

- [ ] **Step 2: Kiểm luồng chính trên trình duyệt**

Chạy dev server bằng `preview_start` (**không** Bash). Ở `/teacher/materials`:

| Việc | Mong đợi |
|---|---|
| Sửa "Giải thích" câu N → Lưu câu hỏi | toast xanh "Đã lưu câu N.", tự tắt sau 4s |
| Bỏ `]` ở Đáp án (JSON) → Lưu | toast đỏ "Lưu câu N thất bại: Đáp án phải là JSON hợp lệ."; nội dung đang gõ không mất |
| Bấm X trên toast | tắt ngay, không đợi hết 4s |
| Sửa tiêu đề → Lưu tài liệu | toast xanh `Đã lưu tài liệu "..."` |
| Sửa tiêu đề phần → Lưu phần | toast xanh `Đã lưu phần "..."` |
| Bấm Lưu rồi nhìn nút | hiện "Đang lưu…" và bị khoá trong lúc chờ |
| Lưu 3 câu liên tiếp thật nhanh | 3 toast xếp chồng, không đè lên nhau |

- [ ] **Step 3: Kiểm R2 — `<details>` có còn mở không**

Mở "Sửa câu 40" ở **cuối** trang (cuộn xuống tận đáy), bấm Lưu.
Expected: trang **không nhảy về đầu**, khối "Sửa câu 40" **vẫn mở**, vị trí cuộn giữ nguyên.
Nếu sập: ghi nhận là hạn chế đã biết, báo người dùng, **không** tự ý đổi `<details>` sang
dạng có kiểm soát.

- [ ] **Step 4: Kiểm hồi quy các trang NGOÀI phạm vi**

`ConfirmSubmitButton` không bị sửa, nhưng phải xác nhận nó còn chạy:

- `/teacher/classes/<id>` — nút xoá vẫn hỏi xác nhận và chạy như cũ (redirect/dải băng như trước, **không** có toast — đúng như thiết kế).
- `/teacher/assignments` — nút xoá bài giao vẫn như cũ.
- Trang Tạo/Nhập tài liệu — khối **Nhập JSON** (`importMaterial`) vẫn redirect sang trang Tài liệu và hiện **dải băng** ở đầu trang như cũ.
- Trang Tạo/Nhập tài liệu — "Tạo tài liệu", "Tạo phần", "Tạo câu hỏi" đều ra toast.

- [ ] **Step 5: Chụp màn hình gửi người dùng**

Chụp toast xanh và toast đỏ (`computer` action `screenshot`) để người dùng thấy kết quả mà
không phải tự kiểm.

- [ ] **Step 6: Commit + push**

```bash
git add -A
git commit -m "test: kiểm chứng toast đầu-cuối trang Tài liệu"
git push origin feature/ielts-platform-mvp
```

Push xong Vercel tự deploy. Theo trí nhớ dự án: sau khi deploy nên kiểm lại trên bản Vercel
thật, đừng chỉ suy luận cục bộ. Tính năng này **không đổi schema** nên **không** cần đụng
`scripts/ensure-db.mjs`.
