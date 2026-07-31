# Form "Tạo bài giao" dạng stepper — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển form tạo bài giao ở `/teacher/assignments` từ cột phải 25rem sang modal stepper 3 bước (Chọn đề → Học viên → Cài đặt & xuất bản).

**Architecture:** Một `<form action={createAssignment}>` duy nhất nằm trong modal; cả 3 bước luôn ở trong DOM, bước không hiện chỉ bị ẩn bằng class `hidden` nên `FormData` vẫn gửi đủ. Vỏ modal là client component nhận 4 slot `ReactNode` do `AssignmentBuilder` (server component) dựng sẵn, nhờ đó `UnitPicker` vẫn render ở server. Mọi logic thuần (chặn bước, nhãn tóm tắt, chuẩn hoá tìm kiếm) tách ra `lib/assignment-wizard.ts` để test được bằng vitest.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript strict, Tailwind CSS, vitest.

## Global Constraints

- Spec gốc: `docs/superpowers/specs/2026-07-31-assignment-wizard-design.md`.
- **Không đụng** `lib/actions/assignments.ts` và `prisma/schema.prisma`.
- **Không đổi** tên trường FormData: `title`, `instructions`, `dueDate`, `dueTime`, `unitIds`, `studentIds`, `skillTime_*`, `lockAudio`.
- **Không** tự gợi ý tiêu đề, **không** tự điền thời gian mặc định cho kỹ năng.
- Form "Sửa bài giao" trong `components/assignment-list.tsx` phải giữ nguyên giao diện → mọi thay đổi trong `UnitPicker` / `StudentPicker` / `DueDateField` đều nằm sau prop mới, **mặc định tắt**.
- Chữ hiển thị và comment bằng **tiếng Việt** (quy ước repo).
- Bước bị ẩn phải ẩn bằng class, **không** render có điều kiện — mất input là lỗi nặng nhất của thiết kế này.
- Không dùng escape `\u…` trong mã nguồn (công cụ ghi file từng biến dạng escape này); cần ký tự đặc biệt thì dùng `String.fromCharCode`.

## File Structure

**Tạo mới**

| File | Trách nhiệm |
| --- | --- |
| `lib/assignment-wizard.ts` | Logic thuần: danh sách bước, lý do chặn bước, bước xa nhất, nhãn tóm tắt/nút, chuẩn hoá tìm kiếm |
| `components/assignment-wizard.tsx` | Vỏ modal client: mở/đóng, bước, đếm lựa chọn, thanh bước, thanh chân |
| `components/unit-search-filter.tsx` | Lớp bọc client lọc cây chọn đề theo `data-search` |
| `tests/assignment-wizard.test.ts` | Test logic thuần + test cấu trúc chống mất input |

**Sửa**

| File | Thay đổi |
| --- | --- |
| `components/assignment-builder.tsx` | Đổi vai: dựng 4 slot rồi truyền vào wizard |
| `components/assignment-list.tsx` | Thêm prop `headerAction` |
| `app/teacher/assignments/page.tsx` | Bỏ lưới 2 cột, đặt builder vào header danh sách |
| `components/unit-picker.tsx` | Thêm `data-search` / `data-wizard-node`, prop `wide` |
| `components/unit-picker-test.tsx` | Thêm `data-search`, prop `wide` (2 cột) |
| `components/student-picker.tsx` | Prop `wide`: chip lớp, ô tìm, 2 cột |
| `components/due-date-field.tsx` | Prop `quickPicks`: chip Hôm nay / Ngày mai / +3 ngày |

---

### Task 1: Logic thuần của wizard

**Files:**
- Create: `lib/assignment-wizard.ts`
- Test: `tests/assignment-wizard.test.ts`

**Interfaces:**
- Consumes: không có (task đầu tiên).
- Produces:
  - `type WizardStep = 1 | 2 | 3`
  - `type WizardCounts = { units: number; students: number }`
  - `WIZARD_STEPS: { id: WizardStep; label: string }[]`
  - `stepBlocker(step: WizardStep, counts: WizardCounts): string | null`
  - `maxReachableStep(counts: WizardCounts): WizardStep`
  - `summaryLabel(counts: WizardCounts): string`
  - `submitLabel(counts: WizardCounts): string`
  - `normalizeSearch(value: string): string`
  - `matchesSearch(haystack: string, query: string): boolean`

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/assignment-wizard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  WIZARD_STEPS,
  matchesSearch,
  maxReachableStep,
  normalizeSearch,
  stepBlocker,
  submitLabel,
  summaryLabel
} from "../lib/assignment-wizard";

describe("WIZARD_STEPS", () => {
  it("có đúng 3 bước theo thứ tự đã chốt", () => {
    expect(WIZARD_STEPS.map((step) => step.id)).toEqual([1, 2, 3]);
    expect(WIZARD_STEPS.map((step) => step.label)).toEqual([
      "Chọn đề",
      "Học viên",
      "Cài đặt"
    ]);
  });
});

describe("stepBlocker", () => {
  it("chặn bước 1 khi chưa chọn phần nào", () => {
    expect(stepBlocker(1, { units: 0, students: 0 })).toBe("Chọn ít nhất 1 phần");
  });

  it("cho qua bước 1 khi đã chọn phần", () => {
    expect(stepBlocker(1, { units: 2, students: 0 })).toBeNull();
  });

  it("chặn bước 2 khi chưa chọn học viên", () => {
    expect(stepBlocker(2, { units: 2, students: 0 })).toBe("Chọn ít nhất 1 học viên");
  });

  it("không chặn bước 3", () => {
    expect(stepBlocker(3, { units: 0, students: 0 })).toBeNull();
  });
});

describe("maxReachableStep", () => {
  it("chưa chọn phần thì kẹt ở bước 1", () => {
    expect(maxReachableStep({ units: 0, students: 5 })).toBe(1);
  });

  it("có phần nhưng chưa có học viên thì tới bước 2", () => {
    expect(maxReachableStep({ units: 1, students: 0 })).toBe(2);
  });

  it("đủ cả hai thì tới bước 3", () => {
    expect(maxReachableStep({ units: 1, students: 1 })).toBe(3);
  });
});

describe("summaryLabel", () => {
  it("nói rõ khi còn thiếu", () => {
    expect(summaryLabel({ units: 0, students: 0 })).toBe(
      "Chưa chọn phần · chưa chọn học viên"
    );
  });

  it("đếm khi đã chọn", () => {
    expect(summaryLabel({ units: 2, students: 8 })).toBe("2 phần · 8 học viên");
  });
});

describe("submitLabel", () => {
  it("ghi rõ số học viên sẽ nhận bài", () => {
    expect(submitLabel({ units: 2, students: 8 })).toBe("Giao bài cho 8 học viên");
  });

  it("về nhãn chung khi chưa chọn ai", () => {
    expect(submitLabel({ units: 2, students: 0 })).toBe("Giao bài");
  });
});

describe("normalizeSearch", () => {
  it("bỏ dấu tiếng Việt và hạ chữ thường", () => {
    expect(normalizeSearch("Nguyễn Hoàng Đức")).toBe("nguyen hoang duc");
  });

  it("cắt khoảng trắng thừa", () => {
    expect(normalizeSearch("  Test 12  ")).toBe("test 12");
  });
});

describe("matchesSearch", () => {
  it("chuỗi rỗng khớp tất cả", () => {
    expect(matchesSearch("IELTS Master", "")).toBe(true);
  });

  it("gõ không dấu vẫn tìm được tên có dấu", () => {
    expect(matchesSearch("Nguyễn Hoàng Đức", "duc")).toBe(true);
  });

  it("không khớp thì trả false", () => {
    expect(matchesSearch("Cambridge IELTS 20", "master")).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

```bash
npx vitest run tests/assignment-wizard.test.ts
```

Kỳ vọng: FAIL — `Failed to resolve import "../lib/assignment-wizard"`.

- [ ] **Step 3: Viết `lib/assignment-wizard.ts`**

```ts
// Logic thuần cho form giao bài dạng stepper. Tách riêng khỏi component để
// test được bằng vitest và để vỏ modal chỉ còn việc dựng giao diện.

export type WizardStep = 1 | 2 | 3;

export type WizardCounts = {
  units: number;
  students: number;
};

export const WIZARD_STEPS: { id: WizardStep; label: string }[] = [
  { id: 1, label: "Chọn đề" },
  { id: 2, label: "Học viên" },
  { id: 3, label: "Cài đặt" }
];

// Lý do khoá nút "Tiếp tục" ở bước hiện tại; null = đi tiếp được.
export function stepBlocker(step: WizardStep, counts: WizardCounts): string | null {
  if (step === 1 && counts.units === 0) {
    return "Chọn ít nhất 1 phần";
  }
  if (step === 2 && counts.students === 0) {
    return "Chọn ít nhất 1 học viên";
  }
  return null;
}

// Bước xa nhất được phép nhảy tới khi bấm thẳng vào thanh bước.
export function maxReachableStep(counts: WizardCounts): WizardStep {
  if (counts.units === 0) {
    return 1;
  }
  if (counts.students === 0) {
    return 2;
  }
  return 3;
}

// Dòng tóm tắt luôn hiện ở thanh chân modal.
export function summaryLabel(counts: WizardCounts): string {
  const units = counts.units === 0 ? "Chưa chọn phần" : `${counts.units} phần`;
  const students =
    counts.students === 0 ? "chưa chọn học viên" : `${counts.students} học viên`;
  return `${units} · ${students}`;
}

// Nhãn nút cuối, ghi rõ việc sắp làm.
export function submitLabel(counts: WizardCounts): string {
  return counts.students === 0 ? "Giao bài" : `Giao bài cho ${counts.students} học viên`;
}

// Dải dấu thanh Unicode (U+0300–U+036F). Dựng bằng fromCharCode để không phải
// gõ escape \u trong mã nguồn.
const COMBINING_MARKS = new RegExp(
  `[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`,
  "g"
);

// Hạ chữ thường + bỏ dấu để gõ không dấu vẫn tìm được tên học viên có dấu.
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

export function matchesSearch(haystack: string, query: string): boolean {
  const needle = normalizeSearch(query);
  if (!needle) {
    return true;
  }
  return normalizeSearch(haystack).includes(needle);
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

```bash
npx vitest run tests/assignment-wizard.test.ts
```

Kỳ vọng: PASS, 17 test.

- [ ] **Step 5: Commit**

```bash
git add lib/assignment-wizard.ts tests/assignment-wizard.test.ts
git commit -m "feat(giao-bai): logic thuan cho form giao bai dang stepper"
```

---

### Task 2: Vỏ modal 3 bước, nội dung giữ nguyên

Kết thúc task này, giao bài phải chạy được đầu-cuối qua modal với đúng các picker hiện tại. Bước 1 chưa có ô tìm kiếm, bước 2 chưa có chip lớp — để dành các task sau.

**Files:**
- Create: `components/assignment-wizard.tsx`
- Modify: `components/assignment-builder.tsx` (viết lại toàn bộ), `components/assignment-list.tsx:32-37,395-404`, `app/teacher/assignments/page.tsx:154-168`
- Test: `tests/assignment-wizard.test.ts` (thêm nhóm test cấu trúc)

**Interfaces:**
- Consumes: mọi export của `lib/assignment-wizard.ts` ở Task 1.
- Produces:
  - `AssignmentWizard` với props:
    ```ts
    type AssignmentWizardProps = {
      unitStep: ReactNode;
      studentStep: ReactNode;
      settingsLeft: ReactNode;
      settingsRight: ReactNode;
      canCreate: boolean;
      disabledReason: string | null;
    };
    ```
  - `AssignmentList` thêm prop `headerAction?: ReactNode`.

- [ ] **Step 1: Viết test cấu trúc thất bại**

Thêm vào cuối `tests/assignment-wizard.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("components/assignment-wizard.tsx", () => {
  const source = readSource("components/assignment-wizard.tsx");

  it("dùng đúng server action cũ", () => {
    expect(source).toContain("action={createAssignment}");
  });

  it("render đủ 4 slot, mỗi slot đúng một lần", () => {
    for (const slot of ["{unitStep}", "{studentStep}", "{settingsLeft}", "{settingsRight}"]) {
      expect(source.split(slot).length - 1).toBe(1);
    }
  });

  it("đánh dấu đủ 3 bước", () => {
    for (const step of ["1", "2", "3"]) {
      expect(source).toContain(`data-wizard-step="${step}"`);
    }
  });

  it("ẩn bước bằng class chứ không render có điều kiện (giữ input trong DOM)", () => {
    expect(source).toContain('"hidden"');
    expect(source).not.toMatch(/step === 1 \? \(?\s*</);
  });

  it("nút điều hướng không được submit form", () => {
    expect(source).toContain("Tiếp tục");
    expect(source).toContain("Quay lại");
    expect(source.split('type="button"').length - 1).toBeGreaterThanOrEqual(3);
  });

  it("chặn Enter submit sớm khi chưa ở bước cuối", () => {
    expect(source).toContain("onKeyDown");
    expect(source).toContain("preventDefault");
  });

  it("có thuộc tính a11y của hộp thoại", () => {
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
  });
});

describe("bố cục trang giao bài", () => {
  it("trang không còn lưới 2 cột 25rem", () => {
    expect(readSource("app/teacher/assignments/page.tsx")).not.toContain("25rem");
  });

  it("builder không còn tự render form riêng", () => {
    const source = readSource("components/assignment-builder.tsx");
    expect(source).toContain("AssignmentWizard");
    expect(source).not.toContain("<form");
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

```bash
npx vitest run tests/assignment-wizard.test.ts
```

Kỳ vọng: FAIL — `ENOENT: no such file or directory ... components/assignment-wizard.tsx`.

- [ ] **Step 3: Tạo `components/assignment-wizard.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createAssignment } from "@/lib/actions/assignments";
import {
  WIZARD_STEPS,
  maxReachableStep,
  stepBlocker,
  submitLabel,
  summaryLabel,
  type WizardCounts,
  type WizardStep
} from "@/lib/assignment-wizard";

type AssignmentWizardProps = {
  unitStep: ReactNode;
  studentStep: ReactNode;
  settingsLeft: ReactNode;
  settingsRight: ReactNode;
  canCreate: boolean;
  disabledReason: string | null;
};

const EMPTY_COUNTS: WizardCounts = { units: 0, students: 0 };

// Vỏ modal cho form tạo bài giao. Cả 3 bước nằm trong CÙNG một <form>; bước
// không hiện chỉ bị ẩn bằng class "hidden" nên mọi checkbox vẫn ở trong DOM và
// FormData gửi lên vẫn đủ — tuyệt đối không render có điều kiện từng bước.
export function AssignmentWizard({
  unitStep,
  studentStep,
  settingsLeft,
  settingsRight,
  canCreate,
  disabledReason
}: AssignmentWizardProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>(1);
  const [counts, setCounts] = useState<WizardCounts>(EMPTY_COUNTS);
  const formRef = useRef<HTMLFormElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Đếm lại số phần / học viên mỗi khi có ô nào đổi trạng thái tick. Nghe trên
  // <form> nên không cần nâng state của hai picker lên đây.
  useEffect(() => {
    if (!open) {
      return;
    }
    const form = formRef.current;
    if (!form) {
      return;
    }
    const recount = () => {
      setCounts({
        units: form.querySelectorAll('input[name="unitIds"]:checked').length,
        students: form.querySelectorAll('input[name="studentIds"]:checked').length
      });
    };
    recount();
    form.addEventListener("change", recount);
    return () => form.removeEventListener("change", recount);
  }, [open]);

  const requestClose = useCallback(() => {
    const dirty = counts.units > 0 || counts.students > 0;
    if (dirty && !window.confirm("Bỏ bài giao đang tạo?")) {
      return;
    }
    setOpen(false);
    setStep(1);
    setCounts(EMPTY_COUNTS);
    triggerRef.current?.focus();
  }, [counts]);

  // Esc đóng, khoá cuộn nền, đưa focus vào modal khi mở.
  useEffect(() => {
    if (!open) {
      return;
    }
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        requestClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, requestClose]);

  const blocker = stepBlocker(step, counts);
  const reachable = maxReachableStep(counts);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        disabled={!canCreate}
        title={disabledReason ?? undefined}
        className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        + Tạo bài giao
      </button>
      {disabledReason ? (
        <span className="text-xs text-muted-foreground">{disabledReason}</span>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              requestClose();
            }
          }}
        >
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Tạo bài giao"
            className="flex h-full w-full max-w-[55rem] flex-col overflow-hidden bg-card shadow-card outline-none sm:h-auto sm:max-h-[85vh] sm:rounded-xl"
          >
            <form
              ref={formRef}
              action={createAssignment}
              className="flex min-h-0 flex-1 flex-col"
              onKeyDown={(event) => {
                // Enter ở bước 1–2 sẽ submit sớm cả form → chặn lại.
                if (event.key !== "Enter" || step === 3) {
                  return;
                }
                if ((event.target as HTMLElement).tagName === "TEXTAREA") {
                  return;
                }
                event.preventDefault();
              }}
            >
              <div className="border-b border-border px-5 pb-3 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold">Tạo bài giao</h3>
                  <button
                    type="button"
                    onClick={requestClose}
                    aria-label="Đóng"
                    className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground transition hover:border-primary hover:text-primary"
                  >
                    ✕
                  </button>
                </div>

                <ol className="mt-3 flex flex-wrap items-center gap-1.5">
                  {WIZARD_STEPS.map((item) => {
                    const active = item.id === step;
                    const usable = item.id <= reachable;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          disabled={!usable}
                          onClick={() => setStep(item.id)}
                          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
                            active
                              ? "bg-primary/10 font-semibold text-primary"
                              : "text-muted-foreground hover:text-foreground disabled:hover:text-muted-foreground"
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          <span
                            className={`flex size-5 items-center justify-center rounded-full text-xs ${
                              active
                                ? "bg-primary text-primary-foreground"
                                : "border border-border"
                            }`}
                          >
                            {item.id}
                          </span>
                          <span className="hidden sm:inline">{item.label}</span>
                        </button>
                      </li>
                    );
                  })}
                  <li className="ml-1 text-xs text-muted-foreground sm:hidden">
                    Bước {step}/3 · {WIZARD_STEPS[step - 1].label}
                  </li>
                </ol>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30 px-5 py-4">
                <div data-wizard-step="1" className={step === 1 ? "" : "hidden"}>
                  {unitStep}
                </div>
                <div data-wizard-step="2" className={step === 2 ? "" : "hidden"}>
                  {studentStep}
                </div>
                <div data-wizard-step="3" className={step === 3 ? "" : "hidden"}>
                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="space-y-4">{settingsLeft}</div>
                    <div className="space-y-4">{settingsRight}</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
                <span className="text-xs text-muted-foreground">{summaryLabel(counts)}</span>
                <div className="flex items-center gap-2">
                  {blocker ? (
                    <span className="text-xs text-amber-600 dark:text-amber-300">{blocker}</span>
                  ) : null}
                  <button
                    type="button"
                    disabled={step === 1}
                    onClick={() => setStep((current) => (current > 1 ? ((current - 1) as WizardStep) : current))}
                    className="rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Quay lại
                  </button>
                  {step === 3 ? (
                    <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">
                      {submitLabel(counts)}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={Boolean(blocker)}
                      onClick={() => setStep((current) => ((current + 1) as WizardStep))}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Tiếp tục
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
```

- [ ] **Step 4: Viết lại `components/assignment-builder.tsx`**

Thay toàn bộ nội dung file bằng:

```tsx
import { DueDateField } from "@/components/due-date-field";
import { SkillTimeInputs } from "@/components/skill-time-inputs";
import {
  StudentPicker,
  type StudentPickerClass,
  type StudentPickerStudent
} from "@/components/student-picker";
import { UnitPicker, type UnitPickerMaterial } from "@/components/unit-picker";
import { AssignmentWizard } from "@/components/assignment-wizard";
import { ResetOnToken } from "@/components/reset-on-token";

type AssignmentBuilderProps = {
  materials: UnitPickerMaterial[];
  students: StudentPickerStudent[];
  classOptions: StudentPickerClass[];
  // Đổi sau mỗi lần tạo bài thành công → remount wizard để đóng modal và xoá
  // sạch lựa chọn cũ.
  resetToken: string;
};

const fieldClass =
  "mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2";

// Dựng sẵn nội dung từng bước ở phía server rồi truyền vào vỏ modal client —
// nhờ vậy cây chọn đề (UnitPicker) vẫn là server component, không phải đẩy
// toàn bộ danh sách đề sang trình duyệt.
export function AssignmentBuilder({
  materials,
  students,
  classOptions,
  resetToken
}: AssignmentBuilderProps) {
  const hasUnits = materials.some((material) => material.units.length > 0);
  const canCreate = hasUnits && students.length > 0;
  const disabledReason = !hasUnits
    ? "Hãy thêm phần tài liệu trước khi giao bài."
    : students.length === 0
      ? "Hãy thêm học viên vào lớp trước khi giao bài."
      : null;

  const unitSkills: Record<string, string> = {};
  materials.forEach((material) =>
    material.units.forEach((unit) => {
      unitSkills[unit.id] = unit.skill;
    })
  );

  return (
    <ResetOnToken token={resetToken}>
      <AssignmentWizard
        canCreate={canCreate}
        disabledReason={disabledReason}
        unitStep={<UnitPicker materials={materials} />}
        studentStep={<StudentPicker students={students} classOptions={classOptions} />}
        settingsLeft={
          <>
            <div>
              <label className="block text-sm font-medium" htmlFor="title">
                Tiêu đề
              </label>
              <input id="title" name="title" minLength={2} required className={fieldClass} />
            </div>

            <div>
              <label className="block text-sm font-medium" htmlFor="instructions">
                Hướng dẫn
              </label>
              <textarea id="instructions" name="instructions" rows={3} className={fieldClass} />
            </div>

            <fieldset>
              <legend className="text-sm font-medium">Hạn nộp</legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    className="block text-xs font-medium text-muted-foreground"
                    htmlFor="dueDate"
                  >
                    Ngày
                  </label>
                  <DueDateField id="dueDate" name="dueDate" />
                </div>
                <div>
                  <label
                    className="block text-xs font-medium text-muted-foreground"
                    htmlFor="dueTime"
                  >
                    Giờ
                  </label>
                  <input
                    id="dueTime"
                    name="dueTime"
                    type="time"
                    defaultValue="23:59"
                    className={fieldClass}
                  />
                </div>
              </div>
            </fieldset>
          </>
        }
        settingsRight={
          <>
            <fieldset>
              <legend className="text-sm font-semibold">Thời gian mỗi kỹ năng</legend>
              <p className="mt-1 text-xs text-muted-foreground">
                Mỗi kỹ năng là một phiên riêng, có đồng hồ riêng. Bỏ trống = không giới hạn.
              </p>
              <div className="mt-3">
                <SkillTimeInputs unitSkills={unitSkills} />
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-semibold">Chế độ thi thật (Listening)</legend>
              <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-background p-3">
                <input
                  type="checkbox"
                  name="lockAudio"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <span className="text-sm leading-5">
                  <span className="font-medium">Ẩn thanh audio</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Audio tự phát liên tục như thi thật: học viên không bấm dừng/tua được, chỉ
                    chỉnh âm lượng, và phải kiểm tra âm thanh trước khi vào bài.
                  </span>
                </span>
              </label>
            </fieldset>
          </>
        }
      />
    </ResetOnToken>
  );
}
```

- [ ] **Step 5: Thêm prop `headerAction` cho `components/assignment-list.tsx`**

Sửa khai báo props (khoảng dòng 32-37):

```tsx
type AssignmentListProps = {
  assignments: AssignmentItem[];
  materials: UnitPickerMaterial[];
  students: StudentPickerStudent[];
  classOptions: StudentPickerClass[];
  // Nút "+ Tạo bài giao" đặt ngay ở header thẻ danh sách.
  headerAction?: ReactNode;
};
```

Thêm import ở đầu file:

```tsx
import type { ReactNode } from "react";
```

Sửa chữ ký hàm và header (khoảng dòng 380-404):

```tsx
export function AssignmentList({
  assignments,
  materials,
  students,
  classOptions,
  headerAction
}: AssignmentListProps) {
```

```tsx
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold">Bài đã giao</h3>
        <div className="flex flex-wrap items-center gap-3">
          {assignments.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {assignments.length} bài · {groups.length} ngày
            </span>
          ) : null}
          {headerAction}
        </div>
      </div>
```

- [ ] **Step 6: Sửa `app/teacher/assignments/page.tsx`**

Thay khối `<section>` (dòng 154-168) bằng:

```tsx
      <section>
        <AssignmentList
          assignments={assignmentItems}
          materials={materials}
          students={students}
          classOptions={classOptions}
          headerAction={
            <AssignmentBuilder
              resetToken={builderResetKey}
              materials={materials}
              students={students}
              classOptions={classOptions}
            />
          }
        />
      </section>
```

- [ ] **Step 7: Chạy test, lint, build**

```bash
npx vitest run tests/assignment-wizard.test.ts
```

Kỳ vọng: PASS toàn bộ (gồm 9 test cấu trúc mới).

```bash
pnpm lint
```

Kỳ vọng: không lỗi.

```bash
pnpm build
```

Kỳ vọng: build thành công.

- [ ] **Step 8: Kiểm tay trên dev server**

Mở `/teacher/assignments`, đăng nhập bằng `teacher@example.com` / `teacher123`. Xác nhận:
1. Danh sách chiếm trọn chiều rộng, nút "+ Tạo bài giao" nằm ở header.
2. Bấm nút → modal mở ở bước 1; nút "Tiếp tục" mờ kèm chữ "Chọn ít nhất 1 phần".
3. Tick 1 phần → qua bước 2; tick 1 học viên → qua bước 3; nút cuối ghi "Giao bài cho 1 học viên".
4. Quay lại bước 1 rồi tiến thẳng tới bước 3 → lựa chọn cũ vẫn còn.
5. Bấm nút cuối → bài mới xuất hiện trong danh sách, modal đóng.

- [ ] **Step 9: Commit**

```bash
git add components/assignment-wizard.tsx components/assignment-builder.tsx components/assignment-list.tsx app/teacher/assignments/page.tsx tests/assignment-wizard.test.ts
git commit -m "feat(giao-bai): modal stepper 3 buoc thay cho form cot phai"
```

---

### Task 3: Bước 1 — tìm kiếm, chip đã chọn, 2 cột

**Files:**
- Create: `components/unit-search-filter.tsx`
- Modify: `components/unit-picker.tsx`, `components/unit-picker-test.tsx`, `components/assignment-wizard.tsx`, `components/assignment-builder.tsx`
- Test: `tests/assignment-wizard.test.ts`

**Interfaces:**
- Consumes: `matchesSearch` (Task 1); `AssignmentWizard` (Task 2).
- Produces:
  - `UnitSearchFilter({ children }: { children: ReactNode })`
  - `UnitPicker` thêm prop tuỳ chọn `wide?: boolean` (mặc định `false`)
  - `UnitPickerTest` thêm props `searchText?: string`, `wide?: boolean`
  - `AssignmentWizard` thêm prop `unitTitles: Record<string, string>`
  - Quy ước DOM: mọi nhánh mang `data-wizard-node="book" | "skill" | "test" | "unit"` kèm `data-search` chứa cả text của tổ tiên.

- [ ] **Step 1: Viết test thất bại**

Thêm vào `tests/assignment-wizard.test.ts`:

```ts
describe("bước 1 — cây chọn đề", () => {
  it("cây gắn data-search cho cả 4 cấp", () => {
    const picker = readSource("components/unit-picker.tsx");
    const test = readSource("components/unit-picker-test.tsx");
    expect(picker).toContain('data-wizard-node="book"');
    expect(picker).toContain('data-wizard-node="skill"');
    expect(test).toContain('data-wizard-node="test"');
    expect(test).toContain('data-wizard-node="unit"');
  });

  it("lớp lọc đọc data-search và mở nhánh khớp", () => {
    const source = readSource("components/unit-search-filter.tsx");
    expect(source).toContain("matchesSearch");
    expect(source).toContain("data-wizard-node");
    expect(source).toContain("hidden");
  });

  it("chip bỏ chọn bấm vào chính checkbox để React cập nhật state", () => {
    const source = readSource("components/assignment-wizard.tsx");
    expect(source).toContain('input[name="unitIds"][value=');
    expect(source).toContain(".click()");
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

```bash
npx vitest run tests/assignment-wizard.test.ts
```

Kỳ vọng: FAIL — thiếu `components/unit-search-filter.tsx`.

- [ ] **Step 3: Gắn `data-search` vào `components/unit-picker.tsx`**

Thêm `wide` vào props:

```tsx
type UnitPickerProps = {
  materials: UnitPickerMaterial[];
  selectedUnitIds?: string[];
  compact?: boolean;
  // Bố cục rộng cho modal giao bài: các phần trong một đề xếp 2 cột.
  wide?: boolean;
};
```

```tsx
export function UnitPicker({
  materials,
  selectedUnitIds,
  compact = false,
  wide = false
}: UnitPickerProps) {
```

Thêm thuộc tính vào `<details>` cấp bộ đề:

```tsx
          <details
            key={bookNode.book}
            open={bookSelected > 0}
            data-wizard-node="book"
            data-search={bookNode.book}
            className="rounded-md border border-border bg-background/40"
          >
```

Thêm vào `<details>` cấp kỹ năng (text gộp cả tên bộ đề để lọc theo nhánh):

```tsx
                  <details
                    key={skillNode.skill}
                    open={skillSelected > 0}
                    data-wizard-node="skill"
                    data-search={`${bookNode.book} ${skillLabel(skillNode.skill)}`}
                    className="rounded-md border border-border/70 bg-background/40"
                  >
```

Truyền text và `wide` xuống từng đề:

```tsx
                          <UnitPickerTest
                            key={material.id}
                            label={test.label}
                            units={material.units}
                            selectedUnitIds={testSelectedIds}
                            padY={padY}
                            wide={wide}
                            searchText={`${bookNode.book} ${skillLabel(skillNode.skill)} ${test.label}`}
                          />
```

- [ ] **Step 4: Gắn `data-search` và 2 cột vào `components/unit-picker-test.tsx`**

Props:

```tsx
type UnitPickerTestProps = {
  label: string;
  units: UnitPickerTestUnit[];
  selectedUnitIds: string[];
  padY: string;
  // Text dùng để lọc, đã gộp tên bộ đề + kỹ năng + tên đề.
  searchText?: string;
  wide?: boolean;
};
```

```tsx
export function UnitPickerTest({
  label,
  units,
  selectedUnitIds,
  padY,
  searchText = "",
  wide = false
}: UnitPickerTestProps) {
```

Thẻ `<details>` gốc:

```tsx
    <details
      ref={rootRef}
      open={open}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
      data-wizard-node="test"
      data-search={searchText}
      className="rounded-md border border-border/60 bg-background/60"
    >
```

Danh sách phần — bọc thêm class 2 cột khi `wide`:

```tsx
      <div
        className={
          wide
            ? "grid gap-x-4 border-t border-border/60 sm:grid-cols-2"
            : "divide-y divide-border border-t border-border/60"
        }
      >
        {units.map((unit) => (
          <label
            key={unit.id}
            data-wizard-node="unit"
            data-search={`${searchText} ${unit.title}`}
            className={`flex gap-3 px-3 text-sm ${padY} ${wide ? "border-b border-border/60" : ""}`}
          >
```

Phần còn lại của `<label>` giữ nguyên.

- [ ] **Step 5: Tạo `components/unit-search-filter.tsx`**

```tsx
"use client";

import { useRef, useState, type ReactNode } from "react";
import { matchesSearch } from "@/lib/assignment-wizard";

// Ô tìm kiếm lọc cây chọn đề. Cây do server render nên ở đây chỉ ẩn/hiện các
// nhánh theo data-search — checkbox vẫn nằm nguyên trong DOM, không mất lựa chọn.
export function UnitSearchFilter({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");

  function applyFilter(value: string) {
    setQuery(value);
    const root = rootRef.current;
    if (!root) {
      return;
    }

    // Duyệt ngược thứ tự tài liệu = con trước cha, nhờ vậy khi xét một nhánh thì
    // các nhánh con đã được ẩn/hiện xong.
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-wizard-node]")).reverse();

    nodes.forEach((node) => {
      const selfMatch = matchesSearch(node.dataset.search ?? "", value);
      const hasVisibleChild = node.querySelector("[data-wizard-node]:not([hidden])") !== null;
      const visible = selfMatch || hasVisibleChild;
      node.hidden = !visible;
      if (value && visible && node instanceof HTMLDetailsElement) {
        node.open = true;
      }
    });
  }

  return (
    <div ref={rootRef} className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(event) => applyFilter(event.target.value)}
        placeholder="Tìm bộ đề, test hoặc phần…"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
      />
      {children}
    </div>
  );
}
```

- [ ] **Step 6: Thêm chip "đã chọn" vào `components/assignment-wizard.tsx`**

Thêm prop:

```tsx
type AssignmentWizardProps = {
  unitStep: ReactNode;
  studentStep: ReactNode;
  settingsLeft: ReactNode;
  settingsRight: ReactNode;
  canCreate: boolean;
  disabledReason: string | null;
  // id phần -> tên phần, để hiện chip "đã chọn" ở bước 1.
  unitTitles: Record<string, string>;
};
```

Thêm `unitTitles` vào danh sách tham số hàm.

Thay `counts` bằng state có thêm danh sách id đã chọn — sửa `recount`:

```tsx
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
```

```tsx
    const recount = () => {
      const units = Array.from(
        form.querySelectorAll<HTMLInputElement>('input[name="unitIds"]:checked')
      );
      setSelectedUnitIds(units.map((input) => input.value));
      setCounts({
        units: units.length,
        students: form.querySelectorAll('input[name="studentIds"]:checked').length
      });
    };
```

Thêm hàm bỏ chọn — bấm vào chính checkbox để React nhận `onChange` (gán `checked` trực tiếp sẽ lệch state):

```tsx
  function unselectUnit(unitId: string) {
    const input = formRef.current?.querySelector<HTMLInputElement>(
      `input[name="unitIds"][value="${unitId}"]`
    );
    input?.click();
  }
```

Nhớ reset khi đóng modal, trong `requestClose`:

```tsx
    setSelectedUnitIds([]);
```

Dựng chip ngay trên slot bước 1:

```tsx
                <div data-wizard-step="1" className={step === 1 ? "" : "hidden"}>
                  {selectedUnitIds.length > 0 ? (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {selectedUnitIds.map((unitId) => (
                        <span
                          key={unitId}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs"
                        >
                          {unitTitles[unitId] ?? "Phần đã chọn"}
                          <button
                            type="button"
                            aria-label={`Bỏ chọn ${unitTitles[unitId] ?? "phần này"}`}
                            onClick={() => unselectUnit(unitId)}
                            className="text-muted-foreground transition hover:text-red-500"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {unitStep}
                </div>
```

- [ ] **Step 7: Nối vào `components/assignment-builder.tsx`**

Thêm import:

```tsx
import { UnitSearchFilter } from "@/components/unit-search-filter";
```

Dựng bảng tên phần cùng lúc với `unitSkills`:

```tsx
  const unitSkills: Record<string, string> = {};
  const unitTitles: Record<string, string> = {};
  materials.forEach((material) =>
    material.units.forEach((unit) => {
      unitSkills[unit.id] = unit.skill;
      unitTitles[unit.id] = unit.title;
    })
  );
```

Truyền vào wizard và bọc cây bằng ô tìm kiếm:

```tsx
        unitTitles={unitTitles}
        unitStep={
          <UnitSearchFilter>
            <UnitPicker materials={materials} wide />
          </UnitSearchFilter>
        }
```

- [ ] **Step 8: Chạy test, lint, build**

```bash
npx vitest run tests/assignment-wizard.test.ts
```

Kỳ vọng: PASS.

```bash
pnpm lint && pnpm build
```

Kỳ vọng: không lỗi.

- [ ] **Step 9: Kiểm tay**

Mở modal, bước 1:
1. Gõ "test 12" → chỉ còn các nhánh khớp, nhánh khớp tự mở.
2. Xoá ô tìm → cây hiện lại đầy đủ.
3. Tick 2 phần → 2 chip hiện phía trên; bấm ✕ trên một chip → checkbox tương ứng bỏ tick, bộ đếm ở thanh chân giảm còn 1.
4. Gõ tìm khi đang có phần được tick → sang bước 3, "Thời gian mỗi kỹ năng" vẫn liệt kê đúng kỹ năng (chứng tỏ input bị ẩn vẫn tính).

- [ ] **Step 10: Commit**

```bash
git add components/unit-search-filter.tsx components/unit-picker.tsx components/unit-picker-test.tsx components/assignment-wizard.tsx components/assignment-builder.tsx tests/assignment-wizard.test.ts
git commit -m "feat(giao-bai): buoc chon de co tim kiem, chip da chon va 2 cot"
```

---

### Task 4: Bước 2 — chip lớp, tìm học viên, 2 cột

**Files:**
- Modify: `components/student-picker.tsx`, `components/assignment-builder.tsx`
- Test: `tests/assignment-wizard.test.ts`

**Interfaces:**
- Consumes: `matchesSearch` (Task 1).
- Produces: `StudentPicker` thêm prop `wide?: boolean` (mặc định `false`); khi `wide` bật thì hiện chip lớp + ô tìm + lưới 2 cột, khi tắt giữ nguyên giao diện cũ cho form "Sửa bài giao".

- [ ] **Step 1: Viết test thất bại**

Thêm vào `tests/assignment-wizard.test.ts`:

```ts
describe("bước 2 — chọn học viên", () => {
  const source = readSource("components/student-picker.tsx");

  it("có chế độ rộng cho modal, mặc định tắt", () => {
    expect(source).toContain("wide = false");
  });

  it("giữ ô select tích nhanh theo lớp cho form sửa bài", () => {
    expect(source).toContain("+ Tích nhanh theo lớp…");
  });

  it("chế độ rộng lọc theo tên bằng matchesSearch", () => {
    expect(source).toContain("matchesSearch");
  });

  it("builder bật chế độ rộng", () => {
    expect(readSource("components/assignment-builder.tsx")).toMatch(
      /<StudentPicker[^>]*\swide\s*\/>/
    );
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

```bash
npx vitest run tests/assignment-wizard.test.ts
```

Kỳ vọng: FAIL — `student-picker.tsx` chưa có `wide = false`.

- [ ] **Step 3: Sửa `components/student-picker.tsx`**

Thêm import và props:

```tsx
import { matchesSearch } from "@/lib/assignment-wizard";
```

```tsx
type StudentPickerProps = {
  students: StudentPickerStudent[];
  classOptions: StudentPickerClass[];
  selectedStudentIds?: string[];
  compact?: boolean;
  // Bố cục rộng cho modal giao bài: chip lớp + ô tìm + danh sách 2 cột.
  wide?: boolean;
};

export function StudentPicker({
  students,
  classOptions,
  selectedStudentIds,
  compact = false,
  wide = false
}: StudentPickerProps) {
```

Thêm state ô tìm ngay dưới state `selected`:

```tsx
  const [query, setQuery] = useState("");
```

Thêm hàm bật/tắt cả lớp (dùng cho chip) cạnh `selectClass`:

```tsx
  // Chip lớp: bấm lần đầu chọn cả lớp, bấm lại bỏ cả lớp.
  function toggleClass(classId: string) {
    const ids = studentsByClass.get(classId) ?? [];
    setSelected((current) => {
      const next = new Set(current);
      const allIn = ids.length > 0 && ids.every((id) => next.has(id));
      ids.forEach((id) => (allIn ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  const classFullySelected = (classId: string) => {
    const ids = studentsByClass.get(classId) ?? [];
    return ids.length > 0 && ids.every((id) => selected.has(id));
  };
```

Danh sách hiển thị (lọc chỉ áp dụng ở chế độ rộng):

```tsx
  const visibleStudents = wide
    ? students.filter((student) =>
        matchesSearch(`${student.displayName} ${student.email}`, query)
      )
    : students;
```

Thay khối thanh công cụ hiện tại bằng nhánh rẽ theo `wide`:

```tsx
      {wide ? (
        <div className="space-y-2">
          {classOptions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {classOptions.map((classItem) => (
                <button
                  key={classItem.id}
                  type="button"
                  onClick={() => toggleClass(classItem.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    classFullySelected(classItem.id)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:border-primary"
                  }`}
                >
                  {classItem.name}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm học viên…"
              className="min-w-[12rem] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
            />
            <button
              type="button"
              onClick={toggleAll}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition hover:border-primary"
            >
              {allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
            </button>
            <span className="text-xs text-muted-foreground">
              Đã chọn {selected.size}/{students.length}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {classOptions.length > 0 ? (
            <select
              defaultValue=""
              onChange={(event) => {
                selectClass(event.target.value);
                event.currentTarget.value = "";
              }}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
            >
              <option value="">+ Tích nhanh theo lớp…</option>
              {classOptions.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            onClick={toggleAll}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition hover:border-primary"
          >
            {allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
          </button>
          <span className="text-xs text-muted-foreground">
            Đã chọn {selected.size}/{students.length}
          </span>
        </div>
      )}
```

Danh sách học viên — **luôn render đủ `students`**, học viên bị lọc chỉ bị ẩn bằng class để không mất tick:

```tsx
      <div
        className={
          wide
            ? "grid rounded-md border border-border bg-background/40 sm:grid-cols-2"
            : "divide-y divide-border rounded-md border border-border bg-background/40"
        }
      >
        {students.map((student) => {
          const hiddenBySearch = !visibleStudents.includes(student);
          return (
            <label
              key={student.id}
              className={`flex gap-3 px-4 text-sm ${padY} ${
                wide ? "border-b border-border" : ""
              } ${hiddenBySearch ? "hidden" : ""}`}
            >
              <input
                name="studentIds"
                value={student.id}
                type="checkbox"
                checked={selected.has(student.id)}
                onChange={() => toggle(student.id)}
                className="mt-1 h-4 w-4 rounded border-border accent-primary"
              />
              <span>
                <span className="block font-medium">{student.displayName}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {student.email}
                  {student.classNames.length > 0 ? ` | ${student.classNames.join(", ")}` : ""}
                </span>
              </span>
            </label>
          );
        })}
      </div>
```

- [ ] **Step 4: Bật chế độ rộng trong `components/assignment-builder.tsx`**

```tsx
        studentStep={<StudentPicker students={students} classOptions={classOptions} wide />}
```

- [ ] **Step 5: Chạy test, lint, build**

```bash
npx vitest run tests/assignment-wizard.test.ts
```

Kỳ vọng: PASS.

```bash
pnpm lint && pnpm build
```

Kỳ vọng: không lỗi.

- [ ] **Step 6: Kiểm tay**

1. Bước 2: bấm chip tên lớp → cả lớp được tick, chip đổi màu; bấm lại → bỏ hết.
2. Gõ "duc" (không dấu) → tìm được "Nguyễn Hoàng Đức".
3. Tick một học viên rồi gõ tìm để họ biến mất khỏi danh sách → thanh chân vẫn đếm đủ (input bị ẩn chứ không bị gỡ).
4. Mở "Sửa bài giao" ở một bài trong danh sách → phần chọn học viên vẫn y như cũ (ô select "+ Tích nhanh theo lớp…", một cột).

- [ ] **Step 7: Commit**

```bash
git add components/student-picker.tsx components/assignment-builder.tsx tests/assignment-wizard.test.ts
git commit -m "feat(giao-bai): buoc chon hoc vien co chip lop, o tim va 2 cot"
```

---

### Task 5: Bước 3 — chip hạn nộp, ẩn audio theo kỹ năng, hộp tóm tắt

**Files:**
- Modify: `components/due-date-field.tsx`, `components/assignment-wizard.tsx`, `components/assignment-builder.tsx`
- Test: `tests/assignment-wizard.test.ts`

**Interfaces:**
- Consumes: `AssignmentWizard` với `unitTitles` (Task 3); `WizardCounts` (Task 1).
- Produces:
  - `DueDateField` thêm prop `quickPicks?: boolean` (mặc định `false`).
  - `AssignmentWizard` thêm prop `unitSkills: Record<string, string>`; ẩn/hiện khối `data-wizard-when-skill="listening"` theo kỹ năng đang chọn và render hộp tóm tắt ở cột phải bước 3.

- [ ] **Step 1: Viết test thất bại**

Thêm vào `tests/assignment-wizard.test.ts`:

```ts
describe("bước 3 — cài đặt & xuất bản", () => {
  it("DueDateField có chip nhanh, mặc định tắt", () => {
    const source = readSource("components/due-date-field.tsx");
    expect(source).toContain("quickPicks = false");
    expect(source).toContain("Hôm nay");
    expect(source).toContain("Ngày mai");
  });

  it("khối ẩn thanh audio được đánh dấu để chỉ hiện khi có Listening", () => {
    expect(readSource("components/assignment-builder.tsx")).toContain(
      'data-wizard-when-skill="listening"'
    );
    expect(readSource("components/assignment-wizard.tsx")).toContain(
      "data-wizard-when-skill"
    );
  });

  it("wizard render hộp tóm tắt ở bước cuối", () => {
    expect(readSource("components/assignment-wizard.tsx")).toContain("Sẽ giao");
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

```bash
npx vitest run tests/assignment-wizard.test.ts
```

Kỳ vọng: FAIL — `due-date-field.tsx` chưa có `quickPicks = false`.

- [ ] **Step 3: Thêm chip nhanh vào `components/due-date-field.tsx`**

Props:

```tsx
type DueDateFieldProps = {
  name?: string;
  // Giá trị mặc định dạng yyyy-mm-dd (khớp với <input type="date"> cũ).
  defaultValue?: string;
  id?: string;
  // Chip chọn nhanh Hôm nay / Ngày mai / +3 ngày (chỉ dùng ở modal giao bài).
  quickPicks?: boolean;
};

export function DueDateField({
  name = "dueDate",
  defaultValue,
  id,
  quickPicks = false
}: DueDateFieldProps) {
```

Thêm khối chip ngay trước `{open ? (`:

```tsx
      {quickPicks ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {[
            { label: "Hôm nay", days: 0 },
            { label: "Ngày mai", days: 1 },
            { label: "+3 ngày", days: 3 }
          ].map((pick) => (
            <button
              key={pick.label}
              type="button"
              onClick={() => {
                const date = new Date();
                date.setDate(date.getDate() + pick.days);
                setSelected(date);
              }}
              className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
            >
              {pick.label}
            </button>
          ))}
        </div>
      ) : null}
```

- [ ] **Step 4: Đánh dấu khối audio trong `components/assignment-builder.tsx`**

Bọc fieldset "Chế độ thi thật (Listening)" bằng thuộc tính đánh dấu:

```tsx
            <fieldset data-wizard-when-skill="listening">
              <legend className="text-sm font-semibold">Chế độ thi thật (Listening)</legend>
```

Bật chip nhanh cho ô ngày:

```tsx
                  <DueDateField id="dueDate" name="dueDate" quickPicks />
```

Truyền `unitSkills` sang wizard (bảng đã dựng sẵn ở Task 3):

```tsx
        unitSkills={unitSkills}
```

- [ ] **Step 5: Ẩn khối audio + hộp tóm tắt trong `components/assignment-wizard.tsx`**

Thêm prop:

```tsx
  // id phần -> kỹ năng, để chỉ hiện "Ẩn thanh audio" khi có phần Listening.
  unitSkills: Record<string, string>;
```

Thêm `unitSkills` vào tham số hàm, rồi thêm effect ẩn/hiện (đặt sau effect đếm):

```tsx
  // Khối nào có data-wizard-when-skill chỉ hiện khi kỹ năng đó đang được chọn.
  // Khi ẩn thì bỏ tick luôn để không gửi lên cấu hình thừa.
  useEffect(() => {
    if (!open) {
      return;
    }
    const form = formRef.current;
    if (!form) {
      return;
    }
    const skills = new Set(selectedUnitIds.map((unitId) => unitSkills[unitId]));
    form.querySelectorAll<HTMLElement>("[data-wizard-when-skill]").forEach((node) => {
      const needed = node.dataset.wizardWhenSkill ?? "";
      const visible = skills.has(needed);
      node.hidden = !visible;
      if (!visible) {
        node
          .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
          .forEach((input) => {
            input.checked = false;
          });
      }
    });
  }, [open, selectedUnitIds, unitSkills]);
```

Thêm hộp tóm tắt vào cột phải của bước 3:

```tsx
                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="space-y-4">{settingsLeft}</div>
                    <div className="space-y-4">
                      {settingsRight}
                      <div className="rounded-lg border border-border bg-background p-3">
                        <p className="text-sm font-semibold">Sẽ giao</p>
                        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {selectedUnitIds.map((unitId) => (
                            <li key={unitId}>· {unitTitles[unitId] ?? "Phần đã chọn"}</li>
                          ))}
                        </ul>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Cho {counts.students} học viên
                        </p>
                      </div>
                    </div>
                  </div>
```

- [ ] **Step 6: Chạy test, lint, build**

```bash
npx vitest run tests/assignment-wizard.test.ts
```

Kỳ vọng: PASS.

```bash
pnpm lint && pnpm build
```

Kỳ vọng: không lỗi.

- [ ] **Step 7: Kiểm tay**

1. Chọn một phần Reading → bước 3 **không** thấy khối "Ẩn thanh audio".
2. Thêm một phần Listening → khối hiện ra; tick nó rồi quay lại bỏ hết phần Listening → khối biến mất và tick bị bỏ.
3. Bấm chip "Ngày mai" → ô ngày hiện đúng ngày mai; bấm ✕ xoá ngày vẫn chạy.
4. Hộp "Sẽ giao" liệt kê đúng tên các phần và số học viên.
5. Giao thử một bài đủ Listening + Reading, mở lại "Sửa bài giao" → hạn nộp, thời gian kỹ năng, ẩn audio đúng như đã chọn.

- [ ] **Step 8: Commit**

```bash
git add components/due-date-field.tsx components/assignment-wizard.tsx components/assignment-builder.tsx tests/assignment-wizard.test.ts
git commit -m "feat(giao-bai): buoc cai dat co chip han nop, an audio theo ky nang, hop tom tat"
```

---

### Task 6: Chốt và đưa lên prod

**Files:** không sửa file nào mới; chỉ chạy kiểm và push.

**Interfaces:**
- Consumes: toàn bộ Task 1–5.
- Produces: nhánh `feature/ielts-platform-mvp` đã đẩy, Vercel tự deploy.

- [ ] **Step 1: Chạy toàn bộ test**

```bash
pnpm test
```

Kỳ vọng: toàn bộ file test PASS. Nếu `tests/teacher-page-guard.test.ts` hoặc test cấu trúc khác đỏ, sửa cho đúng chứ không nới lỏng test.

- [ ] **Step 2: Lint và build**

```bash
pnpm lint && pnpm build
```

Kỳ vọng: không lỗi, không cảnh báo mới.

- [ ] **Step 3: Kiểm hồi quy form "Sửa bài giao"**

Mở `/teacher/assignments`, bung "Sửa bài giao" ở một bài cũ. Xác nhận giao diện y hệt trước khi đổi: cây chọn đề một cột, không có ô tìm kiếm, học viên một cột với ô select "+ Tích nhanh theo lớp…", ô ngày không có chip nhanh. Sửa tiêu đề rồi lưu → lưu được.

- [ ] **Step 4: Push**

```bash
git push origin feature/ielts-platform-mvp
```

- [ ] **Step 5: Kiểm trên Vercel sau khi deploy xong**

Vào bản deploy prod, đăng nhập tài khoản giáo viên, tạo thử một bài giao qua đủ 3 bước cho 1 học viên, rồi xoá bài thử đó. Xác nhận không có lỗi runtime trong log.

---

## Ghi chú cho người thực hiện

- **Bẫy số 1 — mất input:** đừng bao giờ đổi `className={step === 1 ? "" : "hidden"}` thành render có điều kiện. Test cấu trúc ở Task 2 canh đúng chỗ này.
- **Bẫy số 2 — checkbox controlled:** `UnitPickerTest` và `StudentPicker` giữ trạng thái tick bằng React state. Muốn bỏ tick từ bên ngoài phải gọi `input.click()` (bắn sự kiện thật) chứ không gán `input.checked = false` — gán trực tiếp sẽ lệch giữa DOM và state. Ngoại lệ duy nhất là ô `lockAudio` ở Task 5: nó là checkbox thường (uncontrolled) nên gán trực tiếp được.
- **Bẫy số 3 — sự kiện change:** nút "Chọn tất cả" trong `UnitPickerTest` đổi tick bằng state nên trình duyệt không tự bắn `change`; component đã tự `dispatchEvent` (dòng 36-42). Bộ đếm của wizard dựa vào sự kiện này — nếu thêm nút tích hàng loạt mới ở đâu đó, nhớ bắn sự kiện tương tự.
- **Bẫy số 4 — `hidden` và `querySelectorAll`:** `:checked` vẫn khớp phần tử đang bị ẩn, nên bộ đếm không bị sai khi lọc tìm kiếm. Đừng "tối ưu" bằng cách gỡ node khỏi DOM.
