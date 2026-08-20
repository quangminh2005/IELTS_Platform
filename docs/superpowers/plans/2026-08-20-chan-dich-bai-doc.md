# Chặn dịch bài đọc / bài nghe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chặn menu chuột phải (kèm "Dịch mục đã chọn" / "Tìm trên Google"), chặn dịch cả trang và tắt soát chính tả trong vùng đoạn văn + khối câu hỏi của màn làm bài Listening/Reading — mà không đụng tới cơ chế bôi đen tô màu.

**Architecture:** Một hook client `useNoTranslateGuard()` trả về bộ props (`translate="no"`, `className` có `notranslate`, `spellCheck={false}`, `onPointerDown`, `onContextMenu`) cùng một node toast portal ra `<body>`. Hook được gắn vào **thẻ bọc sẵn có** của `HighlightLayer` (đoạn văn) và `HighlightRegion` (khối câu hỏi) — hai thành phần này chỉ được dùng ở nhánh không-phải-Writing của màn làm bài, nên phạm vi trúng chính xác mà không cần thêm thẻ `div` nào. Logic quyết định chặn hay không tách ra `lib/no-translate.ts` dạng hàm thuần để test bằng vitest.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript strict, Tailwind CSS, vitest. Không thêm thư viện mới.

**Spec:** [docs/superpowers/specs/2026-08-20-chan-dich-bai-doc-design.md](../specs/2026-08-20-chan-dich-bai-doc-design.md)

## Global Constraints

- **Chữ hiển thị và chú thích code viết bằng tiếng Việt**, đúng lối các tệp sẵn có.
- **Không đụng `prisma/schema.prisma`, không thêm server action, không thêm bảng.** Đây là thay đổi thuần client.
- **Không đụng ô soạn bài Writing, không đụng trang xem lại kết quả, không đụng trình phát audio.**
- **Không chặn copy, không xoá vùng chọn** (`removeAllRanges`) ngoài chỗ đã có sẵn.
- **Không được chặn trên cảm ứng.** Android Chrome cũng bắn `contextmenu` khi nhấn giữ; chặn bừa sẽ giết thao tác bôi đen tô màu của học sinh dùng điện thoại.
- **`className` phải được GHÉP thêm `notranslate`, không được ghi đè.** `HighlightRegion` nhận `className="space-y-4"` từ thẻ cha; mất nó là hỏng khoảng cách khối câu hỏi.
- Câu nhắc hiển thị đúng nguyên văn: `Không dùng từ điển hay công cụ dịch khi đang làm bài nhé.`
- Toast phải `createPortal` ra `document.body` — `AppShell` có `transform` (`animate-fade-in`) nên `position: fixed` để bên trong sẽ bám cột nội dung thay vì bám màn hình.
- Package manager là **pnpm**. Chạy một tệp test: `npx vitest run tests/<tên>.test.ts`.

---

## File Structure

| Tệp | Trách nhiệm |
| --- | --- |
| `lib/no-translate.ts` *(mới)* | Logic thuần: có chặn `contextmenu` không, câu nhắc, thời gian toast. Không import React/DOM. |
| `components/no-translate-guard.tsx` *(mới)* | Hook client: gom props gắn lên thẻ bọc + dựng toast portal. |
| `components/highlight-layer.tsx` *(sửa)* | Gắn hook vào thẻ bọc đoạn văn. |
| `components/highlight-region.tsx` *(sửa)* | Gắn hook vào thẻ bọc khối câu hỏi. |
| `tests/no-translate.test.ts` *(mới)* | Test logic thuần + test cấu trúc đọc mã nguồn. |

---

### Task 1: Logic thuần `lib/no-translate.ts`

**Files:**
- Create: `lib/no-translate.ts`
- Test: `tests/no-translate.test.ts`

**Interfaces:**
- Consumes: không có (task đầu tiên).
- Produces:
  - `shouldBlockContextMenu(pointerType: string | null): boolean`
  - `NO_TRANSLATE_NOTICE: string`
  - `NO_TRANSLATE_NOTICE_MS: number`

- [ ] **Step 1: Viết test đỏ**

Tạo `tests/no-translate.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  NO_TRANSLATE_NOTICE,
  NO_TRANSLATE_NOTICE_MS,
  shouldBlockContextMenu
} from "@/lib/no-translate";

// Android Chrome cũng bắn `contextmenu` khi nhấn giữ. Chặn bừa là giết luôn
// thao tác bôi đen tô màu của học sinh làm bài trên điện thoại.
describe("shouldBlockContextMenu", () => {
  it("chặn khi bấm bằng chuột", () => {
    expect(shouldBlockContextMenu("mouse")).toBe(true);
  });

  it("KHÔNG chặn khi nhấn giữ bằng ngón tay", () => {
    expect(shouldBlockContextMenu("touch")).toBe(false);
  });

  it("KHÔNG chặn khi dùng bút cảm ứng", () => {
    expect(shouldBlockContextMenu("pen")).toBe(false);
  });

  it("chặn khi chưa có cú chạm nào trước đó (phím Menu / Shift+F10 trên bàn phím)", () => {
    expect(shouldBlockContextMenu(null)).toBe(true);
  });

  it("chặn khi trình duyệt cũ không báo loại con trỏ", () => {
    expect(shouldBlockContextMenu("")).toBe(true);
  });
});

describe("câu nhắc", () => {
  it("là tiếng Việt có dấu, đúng nguyên văn đã chốt", () => {
    expect(NO_TRANSLATE_NOTICE).toBe(
      "Không dùng từ điển hay công cụ dịch khi đang làm bài nhé."
    );
  });

  it("tự tắt sau 3 giây", () => {
    expect(NO_TRANSLATE_NOTICE_MS).toBe(3000);
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó đỏ**

```bash
npx vitest run tests/no-translate.test.ts
```

Expected: FAIL — `Failed to resolve import "@/lib/no-translate"`.

- [ ] **Step 3: Viết `lib/no-translate.ts`**

```ts
// Logic thuần cho việc chặn công cụ dịch trong vùng làm bài Listening/Reading.
// Không phụ thuộc React/DOM để test thẳng bằng vitest (dự án không cài jsdom),
// cùng lối với lib/proctor-signals.ts.
//
// LƯU Ý: đây chỉ là RÀO CẢN nhắc học sinh giữ luật, KHÔNG phải khoá chống gian
// lận — xem mục "Giới hạn đã biết" trong spec. Trên điện thoại gần như không
// chặn được gì.

// Câu nhắc hiện lên khi học sinh bấm chuột phải. Tiếng Việt CÓ DẤU.
export const NO_TRANSLATE_NOTICE =
  "Không dùng từ điển hay công cụ dịch khi đang làm bài nhé.";

// 3 giây: đủ đọc một câu ngắn mà không che mất đoạn văn quá lâu.
export const NO_TRANSLATE_NOTICE_MS = 3000;

// Chỉ chặn menu chuột phải trên MÁY TÍNH.
//
// Android Chrome cũng bắn `contextmenu` khi nhấn–giữ, mà nhấn–giữ chính là thao
// tác bôi đen để tô màu trên điện thoại. Chặn theo cảm ứng là giết luôn tính
// năng tô màu — nên cứ thấy ngón tay / bút là thả qua.
//
// Không rõ loại con trỏ (chưa có `pointerdown` nào, hoặc trình duyệt cũ không hỗ
// trợ PointerEvent) thì chặn: trường hợp đó gần như chắc chắn là máy tính, và
// bấm phím Menu / Shift+F10 trên bàn phím cũng rơi vào đây.
export function shouldBlockContextMenu(pointerType: string | null): boolean {
  return pointerType !== "touch" && pointerType !== "pen";
}
```

- [ ] **Step 4: Chạy lại test cho xanh**

```bash
npx vitest run tests/no-translate.test.ts
```

Expected: PASS — 7 tests passed.

- [ ] **Step 5: Commit**

```bash
git add lib/no-translate.ts tests/no-translate.test.ts
git commit -m "feat(lam-bai): logic chan menu chuot phai theo loai con tro"
```

---

### Task 2: Hook `useNoTranslateGuard`

**Files:**
- Create: `components/no-translate-guard.tsx`
- Modify: `tests/no-translate.test.ts` (thêm khối test cấu trúc)

**Interfaces:**
- Consumes: `shouldBlockContextMenu`, `NO_TRANSLATE_NOTICE`, `NO_TRANSLATE_NOTICE_MS` từ `@/lib/no-translate` (Task 1).
- Produces:
  - `useNoTranslateGuard(className?: string): { guardProps: NoTranslateGuardProps; notice: ReactNode }`
  - `guardProps` gồm đúng các khoá: `translate`, `className`, `spellCheck`, `onPointerDown`, `onContextMenu`.

- [ ] **Step 1: Viết test đỏ**

Thêm vào **cuối** `tests/no-translate.test.ts` (giữ nguyên phần đã có ở Task 1), và thêm hai import ở đầu tệp:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
```

Rồi thêm ở cuối tệp:

```ts
const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const guard = read("components/no-translate-guard.tsx");

describe("khiên chặn dịch", () => {
  it("khai báo translate=no để Chrome / tiện ích Google Dịch bỏ qua vùng này", () => {
    expect(guard).toContain('translate: "no"');
    expect(guard).toContain("notranslate");
  });

  it("tắt soát chính tả (gạch chân đỏ cũng là gợi ý sửa từ)", () => {
    expect(guard).toContain("spellCheck: false");
  });

  it("hỏi shouldBlockContextMenu trước khi chặn, không chặn bừa", () => {
    expect(guard).toContain("shouldBlockContextMenu");
    expect(guard).toContain("preventDefault");
  });

  it("nhớ loại con trỏ từ pointerdown", () => {
    expect(guard).toContain("onPointerDown");
    expect(guard).toContain("pointerType");
  });

  // AppShell bọc nội dung trong div có transform (animate-fade-in), biến nó
  // thành containing block cho position: fixed. Toast phải portal ra body thì
  // mới bám màn hình thay vì bám cột nội dung.
  it("toast được portal ra body", () => {
    expect(guard).toContain("createPortal");
    expect(guard).toContain("document.body");
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó đỏ**

```bash
npx vitest run tests/no-translate.test.ts
```

Expected: FAIL — `ENOENT: no such file or directory ... components/no-translate-guard.tsx`.

- [ ] **Step 3: Viết `components/no-translate-guard.tsx`**

```tsx
"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";

import {
  NO_TRANSLATE_NOTICE,
  NO_TRANSLATE_NOTICE_MS,
  shouldBlockContextMenu
} from "@/lib/no-translate";

/*
  Khiên chặn công cụ dịch cho vùng đoạn văn + khối câu hỏi khi đang làm bài.

  Ba lớp, đặt MỘT LẦN trên thẻ bọc:
  - translate="no" + class "notranslate": Chrome dịch cả trang và các tiện ích
    (Google Dịch, Immersive Translate) đều bỏ qua vùng này.
  - onContextMenu: chặn menu chuột phải, tức mất luôn "Dịch mục đã chọn" và
    "Tìm trên Google".
  - spellCheck={false}: tắt gạch chân đỏ báo sai chính tả trong mọi ô đáp án bên
    trong — IELTS chấm cả chính tả, thi thật không có gợi ý này.

  Hai thuộc tính `translate` và `spellcheck` DI TRUYỀN xuống con cháu theo chuẩn
  HTML, nên đặt ở thẻ bọc là phủ hết đoạn văn, câu hỏi và mọi <input> bên trong —
  không phải sửa từng chỗ, và không sót khi sau này thêm dạng câu hỏi mới.
*/

export type NoTranslateGuardProps = {
  translate: "no";
  className: string;
  spellCheck: false;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
};

export function useNoTranslateGuard(className = ""): {
  guardProps: NoTranslateGuardProps;
  notice: ReactNode;
} {
  // Loại con trỏ của cú `pointerdown` gần nhất. Dùng ref chứ không dùng state:
  // giá trị này chỉ để đọc trong handler, đổi nó không cần vẽ lại gì cả.
  const pointerTypeRef = useRef<string | null>(null);
  // Object mới mỗi lần bấm: bấm liên tục thì đặt lại đồng hồ 3 giây chứ không
  // xếp chồng thêm toast.
  const [flash, setFlash] = useState<{ at: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  // Chỉ dựng portal sau khi mount ở client (document.body đã sẵn sàng).
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!flash) {
      return;
    }

    const timer = window.setTimeout(() => setFlash(null), NO_TRANSLATE_NOTICE_MS);

    return () => window.clearTimeout(timer);
  }, [flash]);

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    pointerTypeRef.current = event.pointerType;
  }

  function handleContextMenu(event: ReactMouseEvent<HTMLElement>) {
    if (!shouldBlockContextMenu(pointerTypeRef.current)) {
      return;
    }

    event.preventDefault();
    setFlash({ at: Date.now() });
  }

  const guardProps: NoTranslateGuardProps = {
    translate: "no",
    // GHÉP thêm, không ghi đè: thẻ cha truyền class khoảng cách vào đây.
    className: [className, "notranslate"].filter(Boolean).join(" "),
    spellCheck: false,
    onPointerDown: handlePointerDown,
    onContextMenu: handleContextMenu
  };

  const notice =
    mounted && flash
      ? createPortal(
          <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-4">
            <div
              role="status"
              className="flex max-w-md items-center gap-2 rounded-xl border border-amber-400/60 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 shadow-pop animate-fade-in dark:bg-amber-950 dark:text-amber-100"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                className="h-5 w-5 shrink-0"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
              </svg>
              <span className="min-w-0 break-words leading-6">{NO_TRANSLATE_NOTICE}</span>
            </div>
          </div>,
          document.body
        )
      : null;

  return { guardProps, notice };
}
```

- [ ] **Step 4: Chạy lại test cho xanh**

```bash
npx vitest run tests/no-translate.test.ts
```

Expected: PASS — 12 tests passed.

- [ ] **Step 5: Commit**

```bash
git add components/no-translate-guard.tsx tests/no-translate.test.ts
git commit -m "feat(lam-bai): hook khien chan cong cu dich + toast nhac nho"
```

---

### Task 3: Gắn khiên vào hai vùng tô màu

**Files:**
- Modify: `components/highlight-layer.tsx` (thêm import + hook, sửa thẻ bọc ở khối `return`, khoảng dòng 315–342)
- Modify: `components/highlight-region.tsx` (thêm import + hook, sửa thẻ bọc ở khối `return`, khoảng dòng 473–480)
- Modify: `tests/no-translate.test.ts` (thêm khối test cấu trúc)

**Interfaces:**
- Consumes: `useNoTranslateGuard` từ `@/components/no-translate-guard` (Task 2).
- Produces: không có API mới — đây là task nối dây cuối cùng.

- [ ] **Step 1: Viết test đỏ**

Thêm vào **cuối** `tests/no-translate.test.ts`:

```ts
const layer = read("components/highlight-layer.tsx");
const region = read("components/highlight-region.tsx");
const workspace = read("components/attempt-workspace.tsx");

describe("gắn khiên đúng chỗ", () => {
  it("cả đoạn văn lẫn khối câu hỏi đều đeo khiên", () => {
    for (const source of [layer, region]) {
      expect(source).toContain("useNoTranslateGuard");
      expect(source).toContain("{...guardProps}");
      expect(source).toContain("{notice}");
    }
  });

  // Khiên chỉ được sống trong hai thẻ bọc kia. Rải thẳng lên màn làm bài sẽ kéo
  // theo cả ô soạn bài Writing — chỗ học sinh CẦN chuột phải để dán và sửa chữ.
  it("không rải khiên thẳng lên màn làm bài", () => {
    expect(workspace).not.toContain("useNoTranslateGuard");
  });

  // HighlightRegion nhận className="space-y-4" từ thẻ cha. Ghi đè nó là hỏng
  // khoảng cách giữa các khối câu hỏi.
  it("khối câu hỏi truyền className của thẻ cha vào khiên để được ghép thêm", () => {
    expect(region).toContain("useNoTranslateGuard(className)");
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó đỏ**

```bash
npx vitest run tests/no-translate.test.ts
```

Expected: FAIL — `expected '...' to contain 'useNoTranslateGuard'`.

- [ ] **Step 3: Sửa `components/highlight-layer.tsx`**

Thêm import (ngay dưới dòng `import { useSelectionCapture } ...` nếu có, hoặc cạnh các import `@/components/...`):

```tsx
import { useNoTranslateGuard } from "@/components/no-translate-guard";
```

Trong thân `HighlightLayer`, thêm ngay dưới dòng khai báo `const containerRef = useRef<HTMLDivElement>(null);`:

```tsx
  // Chặn chuột phải + công cụ dịch trên đoạn văn (xem components/no-translate-guard.tsx).
  const { guardProps, notice } = useNoTranslateGuard(
    "whitespace-pre-wrap rounded-md border border-border bg-background/50 p-4 text-sm leading-7 text-foreground"
  );
```

Rồi sửa thẻ bọc trong khối `return`. **Trước:**

```tsx
      <div
        ref={containerRef}
        onMouseUp={captureSelection}
        onKeyUp={captureSelection}
        className="whitespace-pre-wrap rounded-md border border-border bg-background/50 p-4 text-sm leading-7 text-foreground"
      >
```

**Sau** (chuỗi class đã chuyển lên lời gọi hook ở trên, nên xoá khỏi đây):

```tsx
      <div
        {...guardProps}
        ref={containerRef}
        onMouseUp={captureSelection}
        onKeyUp={captureSelection}
      >
```

Cuối cùng, thêm `{notice}` ngay trước dòng `{error ? ... }` ở cuối khối `return`:

```tsx
      {notice}

      {error ? <p className="text-xs text-red-500">{error}</p> : null}
```

- [ ] **Step 4: Sửa `components/highlight-region.tsx`**

Thêm import cạnh các import `@/components/...` sẵn có:

```tsx
import { useNoTranslateGuard } from "@/components/no-translate-guard";
```

Trong thân `HighlightRegion`, thêm ngay dưới dòng khai báo `containerRef`:

```tsx
  // Chặn chuột phải + công cụ dịch trên khối câu hỏi. Truyền className của thẻ
  // cha vào để được GHÉP thêm "notranslate" — ghi đè là mất space-y-4.
  const { guardProps, notice } = useNoTranslateGuard(className);
```

Sửa thẻ bọc trong khối `return`. **Trước:**

```tsx
      <div
        ref={containerRef}
        onMouseUp={captureSelection}
        onClick={handleClick}
        className={className}
      >
        {children}
      </div>
```

**Sau:**

```tsx
      <div
        {...guardProps}
        ref={containerRef}
        onMouseUp={captureSelection}
        onClick={handleClick}
      >
        {children}
      </div>
```

Thêm `{notice}` ngay trước thẻ đóng `</>` ở cuối khối `return`:

```tsx
      {notice}
    </>
```

- [ ] **Step 5: Chạy lại test cho xanh**

```bash
npx vitest run tests/no-translate.test.ts
```

Expected: PASS — 15 tests passed.

- [ ] **Step 6: Chạy toàn bộ test để chắc không phá cái gì**

```bash
pnpm test
```

Expected: PASS toàn bộ. Đặc biệt `tests/highlight-touch.test.ts` phải vẫn xanh — nó canh việc hai vùng tô màu còn dùng `useSelectionCapture`.

- [ ] **Step 7: Kiểm kiểu TypeScript và build**

```bash
pnpm build
```

Expected: build thành công, không có lỗi type. Nếu TypeScript than về `translate: "no"` không khớp kiểu thuộc tính `translate` của `div`, kiểm lại `NoTranslateGuardProps.translate` đang khai báo là literal `"no"` chứ không phải `string`.

- [ ] **Step 8: Commit**

```bash
git add components/highlight-layer.tsx components/highlight-region.tsx tests/no-translate.test.ts
git commit -m "feat(lam-bai): chan chuot phai va cong cu dich tren bai doc va khoi cau hoi"
```

---

### Task 4: Kiểm trên máy thật rồi đẩy lên prod

**Files:** không sửa tệp nào — đây là bước xác minh.

**Interfaces:**
- Consumes: toàn bộ Task 1–3.
- Produces: không có.

- [ ] **Step 1: Chạy dev server**

Dùng `preview_start` với `.claude/launch.json` (KHÔNG chạy dev server bằng Bash). Nếu chưa có tệp cấu hình, tạo `.claude/launch.json`:

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "ielts-dev", "runtimeExecutable": "pnpm", "runtimeArgs": ["dev"], "port": 3000 }
  ]
}
```

- [ ] **Step 2: Nhờ giáo viên đăng nhập rồi mở một bài Reading đang giao**

Claude không gõ được mật khẩu — phải nhờ người dùng đăng nhập tài khoản học viên trước, rồi mới tiếp quản trình duyệt.

- [ ] **Step 3: Kiểm 4 điểm trên máy tính**

1. Bấm chuột phải lên đoạn văn → **không** hiện menu, **có** toast màu hổ phách ở giữa trên màn hình.
2. Toast tự tắt sau 3 giây; bấm chuột phải liên tục vẫn chỉ có **một** toast.
3. Bôi đen một cụm từ trong đoạn văn → popup chọn màu vẫn hiện, tô màu vẫn lưu được.
4. Gõ sai chính tả trong một ô điền đáp án → **không** còn gạch chân đỏ.

- [ ] **Step 4: Soi console không có lỗi**

Dùng `read_console_messages` với `onlyErrors: true`. Expected: rỗng.

- [ ] **Step 5: Chụp màn hình lúc toast đang hiện làm bằng chứng**

Dùng `computer` với `action: "screenshot"`, gửi cho giáo viên bằng `SendUserFile`.

- [ ] **Step 6: Đẩy lên prod**

```bash
git push origin feature/ielts-platform-mvp
```

Vercel tự deploy. Sau khi deploy xong, nhắc giáo viên thử **trên điện thoại** để tự thấy đúng cái giới hạn đã ghi trong spec: nhấn giữ vẫn ra thanh "Dịch". Nếu thấy không chấp nhận được thì quay lại bàn phương án chặn triệt để (viết lại cơ chế chọn theo từng từ).

---

## Ghi nhớ sau khi xong

Cập nhật memory: tính năng chặn dịch đã ship, **chỉ có tác dụng trên máy tính**, cố ý không đụng bôi đen/copy, và lý do (giữ tính năng tô màu trên điện thoại).
