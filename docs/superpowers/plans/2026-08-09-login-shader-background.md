# Nền động shader cho trang đăng nhập — Kế hoạch thi công

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm lớp nền WebGL động phía sau bố cục trang đăng nhập hiện có, ăn theo cả theme sáng lẫn tối, không ảnh hưởng tới các trang sau khi đăng nhập.

**Architecture:** Tách làm bốn phần rời nhau — một module thuần logic giữ bảng màu, một nền tĩnh CSS dùng chung cho mọi nhánh dự phòng, một component canvas nặng chứa `three`, và một component điều phối quyết định dựng canvas hay không. Component canvas được nạp bằng `next/dynamic` với `ssr: false` nên `three` chỉ nằm trong chunk riêng của route đăng nhập.

**Tech Stack:** Next.js 14 App Router, React 18.3.1, TypeScript `strict`, Tailwind, `three` + `@react-three/fiber@^8`, vitest.

**Spec:** `docs/superpowers/specs/2026-08-09-login-shader-background-design.md`

## Global Constraints

- Toàn bộ chữ hiển thị và chú thích trong mã **viết bằng tiếng Việt**, theo `CLAUDE.md`.
- **Phải ghim `@react-three/fiber@^8`.** Bản 9 yêu cầu React 19; dự án đang React 18.3.1.
- **Không cài `@react-three/drei` và `lucide-react`.** Registry khai chúng nhưng mã nguồn không dùng.
- **Không sửa** `app/student/*`, `app/teacher/*`, `app/layout.tsx`, `components/app-shell.tsx`.
- **Không đổi nội dung** cột trái (huy hiệu, tiêu đề, 3 thẻ 01–03) hay thẻ chọn vai trò trong `app/(auth)/login/layout.tsx`.
- Theme đọc từ thuộc tính `data-theme` trên `document.documentElement` (không có context theme trong dự án — xem `components/ui/animated-theme-toggle.tsx:32`).
- Dự án không cài jsdom hay testing-library. Test là **logic thuần + kiểm tra cấu trúc mã nguồn bằng `readFileSync`**, theo đúng lối của `tests/teacher-page-guard.test.ts`.
- Mọi test chạy bằng `npx vitest run <file>`.

---

### Task 1: Module bảng màu

Module thuần, không đụng DOM, nên test được trực tiếp.

**Files:**
- Create: `lib/login-background-theme.ts`
- Test: `tests/login-background.test.ts`

**Interfaces:**
- Consumes: không có.
- Produces:
  - `type LoginBackgroundTheme = "light" | "dark"`
  - `type LoginBackgroundPalette = { color1: string; color2: string; fade: string }`
  - `const LOGIN_BACKGROUND_PALETTES: Record<LoginBackgroundTheme, LoginBackgroundPalette>`
  - `function getLoginBackgroundPalette(theme: string | undefined): LoginBackgroundPalette`

- [ ] **Step 1: Viết test cho trước**

Tạo `tests/login-background.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  LOGIN_BACKGROUND_PALETTES,
  getLoginBackgroundPalette
} from "../lib/login-background-theme";

describe("bảng màu nền đăng nhập", () => {
  it("có đúng hai theme", () => {
    expect(Object.keys(LOGIN_BACKGROUND_PALETTES).sort()).toEqual(["dark", "light"]);
  });

  it("trả đúng bảng màu theo data-theme", () => {
    expect(getLoginBackgroundPalette("dark")).toBe(LOGIN_BACKGROUND_PALETTES.dark);
    expect(getLoginBackgroundPalette("light")).toBe(LOGIN_BACKGROUND_PALETTES.light);
  });

  // Script chống nhấp nháy có thể chưa kịp đặt data-theme.
  it("thiếu hoặc sai data-theme thì coi như theme sáng", () => {
    expect(getLoginBackgroundPalette(undefined)).toBe(LOGIN_BACKGROUND_PALETTES.light);
    expect(getLoginBackgroundPalette("")).toBe(LOGIN_BACKGROUND_PALETTES.light);
    expect(getLoginBackgroundPalette("xanh")).toBe(LOGIN_BACKGROUND_PALETTES.light);
  });

  // Màu loang phải trùng nền trang, không thì lộ vệt ở góc dưới trái.
  it("theme tối lấy màu loang trùng màu đậm (nền tối)", () => {
    expect(LOGIN_BACKGROUND_PALETTES.dark.fade).toBe(LOGIN_BACKGROUND_PALETTES.dark.color1);
  });

  it("hai theme không dùng chung màu đậm", () => {
    expect(LOGIN_BACKGROUND_PALETTES.dark.color1).not.toBe(
      LOGIN_BACKGROUND_PALETTES.light.color1
    );
  });

  // THREE.Color nhận nhiều định dạng, nhưng giữ hex 6 chữ số cho dễ soi.
  it("mọi màu là hex 6 chữ số", () => {
    const all = Object.values(LOGIN_BACKGROUND_PALETTES).flatMap((palette) => [
      palette.color1,
      palette.color2,
      palette.fade
    ]);

    expect(all).toHaveLength(6);
    for (const color of all) {
      expect(color).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});
```

- [ ] **Step 2: Chạy test cho chắc là hỏng**

Run: `npx vitest run tests/login-background.test.ts`
Expected: FAIL — `Failed to resolve import "../lib/login-background-theme"`

- [ ] **Step 3: Viết module**

Tạo `lib/login-background-theme.ts`:

```ts
// Bảng màu cho nền động của trang đăng nhập.
// Bám theo --background và --primary trong app/globals.css.

export type LoginBackgroundTheme = "light" | "dark";

export type LoginBackgroundPalette = {
  /** Màu đậm — chiếm phần lớn diện tích, dồn về phía dưới trái. */
  color1: string;
  /** Màu nhạt — hửng lên ở góc trên phải. */
  color2: string;
  /** Màu loang ở góc dưới trái; phải trùng nền trang để không lộ vệt. */
  fade: string;
};

export const LOGIN_BACKGROUND_PALETTES: Record<
  LoginBackgroundTheme,
  LoginBackgroundPalette
> = {
  // Theme sáng: chuyển từ xanh --primary sang xanh rất nhạt, giữ tinh thần nền sáng sạch.
  light: {
    color1: "#2563EB",
    color2: "#EFF6FF",
    fade: "#F2F6FA"
  },
  // Theme tối: phần lớn là navy gần trùng nền, chỉ hửng xanh ở góc trên phải.
  dark: {
    color1: "#0C1220",
    color2: "#2E62C4",
    fade: "#0C1220"
  }
};

export function getLoginBackgroundPalette(
  theme: string | undefined
): LoginBackgroundPalette {
  return theme === "dark"
    ? LOGIN_BACKGROUND_PALETTES.dark
    : LOGIN_BACKGROUND_PALETTES.light;
}
```

- [ ] **Step 4: Chạy lại test cho chắc là qua**

Run: `npx vitest run tests/login-background.test.ts`
Expected: PASS — 6 test

- [ ] **Step 5: Commit**

```bash
git add lib/login-background-theme.ts tests/login-background.test.ts
git commit -m "feat(login): bang mau cho nen dong trang dang nhap"
```

---

### Task 2: Nền tĩnh dùng chung

Nền tĩnh này là đích rơi của cả ba nhánh dự phòng, đồng thời là thứ hiện ra trong lúc chunk shader đang tải. Dùng thẳng biến `--body-radial` có sẵn trong `app/globals.css` nên tự đổi theo theme, không cần một dòng JS nào.

**Files:**
- Create: `components/ui/login-static-background.tsx`
- Modify: `tailwind.config.ts:36-44`
- Test: `tests/login-background.test.ts` (thêm vào file đã có ở Task 1)

**Interfaces:**
- Consumes: `cn` từ `@/lib/utils`.
- Produces: `export function LoginStaticBackground(props: { className?: string }): JSX.Element`

- [ ] **Step 1: Viết test cho trước**

Trong `tests/login-background.test.ts`, thêm hai dòng import này **lên đầu file** cùng chỗ với các import sẵn có:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
```

Rồi thêm phần dưới đây vào cuối file (giữ nguyên phần đã có):

```ts
const root = process.cwd();
const readSource = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

describe("nền tĩnh dự phòng", () => {
  const source = readSource("components", "ui", "login-static-background.tsx");

  // Dùng biến CSS nên tự đổi theo theme, không cần JS.
  it("lấy màu từ biến --body-radial", () => {
    expect(source).toContain("--body-radial");
  });

  it("không chắn chuột và ẩn với trình đọc màn hình", () => {
    expect(source).toContain("pointer-events-none");
    expect(source).toContain('aria-hidden="true"');
  });

  // Lớp lót phải hiện ngay, không hiệu ứng — và animate-fade-in có kèm
  // translateY, dùng vào đây sẽ kéo lệch cả mảng nền.
  it("không gắn hiệu ứng nào", () => {
    expect(source).not.toContain("animate-");
  });

  it("tailwind có keyframe mờ dần chỉ đổi độ trong", () => {
    const config = readSource("tailwind.config.ts");

    expect(config).toContain("fade-in-soft");
  });
});
```

- [ ] **Step 2: Chạy test cho chắc là hỏng**

Run: `npx vitest run tests/login-background.test.ts`
Expected: FAIL — `ENOENT ... login-static-background.tsx`

- [ ] **Step 3: Thêm keyframe mờ dần vào Tailwind**

Trong `tailwind.config.ts`, thay khối `keyframes` và `animation` hiện có bằng:

```ts
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        // Bản chỉ đổi độ trong — dùng cho mảng nền, vì translateY sẽ kéo lệch cả lớp.
        "fade-in-soft": {
          from: { opacity: "0" },
          to: { opacity: "1" }
        }
      },
      animation: {
        "fade-in": "fade-in 0.35s ease both",
        "fade-in-soft": "fade-in-soft 0.9s ease both"
      }
```

- [ ] **Step 4: Viết component nền tĩnh**

Tạo `components/ui/login-static-background.tsx`:

```tsx
import { cn } from "@/lib/utils";

// Nền tĩnh của trang đăng nhập. Vừa là lớp lót lúc chunk shader đang tải,
// vừa là đích rơi khi máy tắt hiệu ứng chuyển động hoặc không có WebGL.
// Màu lấy từ --body-radial trong app/globals.css nên tự đổi theo theme.
export function LoginStaticBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{ background: "var(--body-radial)" }}
    />
  );
}
```

- [ ] **Step 5: Chạy lại test cho chắc là qua**

Run: `npx vitest run tests/login-background.test.ts`
Expected: PASS — 10 test

- [ ] **Step 6: Commit**

```bash
git add components/ui/login-static-background.tsx tailwind.config.ts tests/login-background.test.ts
git commit -m "feat(login): nen tinh du phong cho trang dang nhap"
```

---

### Task 3: Lấy và vá mã shader

Không chép tay 150 dòng GLSL vào dự án — tải thẳng từ registry rồi vá bằng script, để lần sau muốn đối chiếu với bản gốc thì chạy lại là xong. Script tự dừng nếu bản gốc đổi khác dự đoán.

**Files:**
- Create: `scripts/fetch-login-shader.mjs`
- Create: `components/ui/login-shader-source.ts` (do script sinh ra)
- Test: `tests/login-background.test.ts` (thêm vào)

**Interfaces:**
- Consumes: không có.
- Produces:
  - `export const vertexShader: string`
  - `export const fragmentShader: string` — có thêm `uniform vec3 uFadeColor;` và dùng nó thay cho `vec3(1.0)` viết cứng.

- [ ] **Step 1: Viết test cho trước**

Thêm vào cuối `tests/login-background.test.ts`:

```ts
describe("mã shader", () => {
  it("có đủ hai shader và không rỗng", async () => {
    const { vertexShader, fragmentShader } = await import(
      "../components/ui/login-shader-source"
    );

    expect(vertexShader.length).toBeGreaterThan(50);
    expect(fragmentShader.length).toBeGreaterThan(500);
  });

  it("giữ nguyên phần tạo hình của bản gốc", async () => {
    const { fragmentShader } = await import("../components/ui/login-shader-source");

    expect(fragmentShader).toContain("snoise");
    expect(fragmentShader).toContain("bayerDither4x4");
  });

  // Bản gốc viết cứng vec3(1.0) -> loang trắng, chói trên theme tối.
  it("màu loang đã đổi thành uniform", async () => {
    const { fragmentShader } = await import("../components/ui/login-shader-source");

    expect(fragmentShader).toContain("uniform vec3 uFadeColor;");
    expect(fragmentShader).toContain("mix(uFadeColor, color, fadeMask)");
    expect(fragmentShader).not.toContain("mix(vec3(1.0), color, fadeMask)");
  });

  it("file được sinh tự động, có ghi nguồn", () => {
    const source = readSource("components", "ui", "login-shader-source.ts");

    expect(source).toContain("scripts/fetch-login-shader.mjs");
    expect(source).toContain("componentry.dev");
  });
});
```

- [ ] **Step 2: Chạy test cho chắc là hỏng**

Run: `npx vitest run tests/login-background.test.ts`
Expected: FAIL — không nạp được `../components/ui/login-shader-source`

- [ ] **Step 3: Viết script lấy shader**

Tạo `scripts/fetch-login-shader.mjs`:

```js
// Tải component hero-geometric từ registry của componentry.dev, rút lấy hai đoạn
// shader rồi vá màu loang thành uniform. Chạy lại khi muốn đối chiếu với bản gốc:
//   node scripts/fetch-login-shader.mjs
import { writeFileSync } from "node:fs";

const REGISTRY_URL = "https://componentry.dev/r/hero-geometric.json";
const OUT_PATH = "components/ui/login-shader-source.ts";

const response = await fetch(REGISTRY_URL);

if (!response.ok) {
  throw new Error(`Không tải được registry: HTTP ${response.status}`);
}

const registry = await response.json();
const file = registry.files?.[0]?.content;

if (typeof file !== "string") {
  throw new Error("Registry không có files[0].content — cấu trúc đã đổi");
}

function grab(name) {
  const match = file.match(new RegExp("const " + name + " = `([\\s\\S]*?)`;"));

  if (!match) {
    throw new Error(`Không tìm thấy ${name} trong mã gốc`);
  }

  const body = match[1];

  // Nội dung sẽ được nhúng lại vào template literal, không được chứa ` hay ${
  if (body.includes("`") || body.includes("${")) {
    throw new Error(`${name} chứa ký tự phá template literal`);
  }

  return body;
}

const vertexShader = grab("vertexShader");
let fragmentShader = grab("fragmentShader");

const HARDCODED_FADE = "mix(vec3(1.0), color, fadeMask)";

if (!fragmentShader.includes(HARDCODED_FADE)) {
  throw new Error("Bản gốc đã đổi cách loang màu — phải soát lại bằng tay");
}

fragmentShader = fragmentShader
  .replace("uniform vec3 uColor2;", "uniform vec3 uColor2;\nuniform vec3 uFadeColor;")
  .replace(HARDCODED_FADE, "mix(uFadeColor, color, fadeMask)");

if (!fragmentShader.includes("uniform vec3 uFadeColor;")) {
  throw new Error("Không chèn được uniform uFadeColor");
}

const header = `// Sinh tự động bởi scripts/fetch-login-shader.mjs — đừng sửa tay.
// Nguồn: ${REGISTRY_URL} (component hero-geometric của componentry.dev).
// Sửa duy nhất so với bản gốc: màu loang góc dưới trái đổi từ vec3(1.0) viết cứng
// thành uniform uFadeColor, để ăn theo nền của theme đang bật.
`;

writeFileSync(
  OUT_PATH,
  `${header}
export const vertexShader = \`${vertexShader}\`;

export const fragmentShader = \`${fragmentShader}\`;
`,
  "utf8"
);

console.log(`Đã ghi ${OUT_PATH}`);
```

- [ ] **Step 4: Chạy script**

Run: `node scripts/fetch-login-shader.mjs`
Expected: in ra `Đã ghi components/ui/login-shader-source.ts`

Nếu script ném lỗi "Bản gốc đã đổi cách loang màu" thì dừng lại báo người dùng — nghĩa là componentry đã cập nhật component, phải đọc lại mã mới trước khi đi tiếp.

- [ ] **Step 5: Chạy lại test cho chắc là qua**

Run: `npx vitest run tests/login-background.test.ts`
Expected: PASS — 14 test

- [ ] **Step 6: Commit**

```bash
git add scripts/fetch-login-shader.mjs components/ui/login-shader-source.ts tests/login-background.test.ts
git commit -m "feat(login): lay shader hero-geometric va va mau loang theo theme"
```

---

### Task 4: Component canvas

Đây là phần nặng, tách riêng để `next/dynamic` chỉ kéo `three` về trong chunk này.

**Files:**
- Create: `components/ui/login-shader-canvas.tsx`
- Modify: `package.json`
- Test: `tests/login-background.test.ts` (thêm vào)

**Interfaces:**
- Consumes: `vertexShader`, `fragmentShader` từ `@/components/ui/login-shader-source`; kiểu `LoginBackgroundPalette` từ `@/lib/login-background-theme`.
- Produces: `export default function LoginShaderCanvas(props: { palette: LoginBackgroundPalette }): JSX.Element` — **export mặc định**, vì `next/dynamic` ở Task 5 nạp theo kiểu đó.

- [ ] **Step 1: Cài thư viện**

```bash
pnpm add three "@react-three/fiber@^8"
```

```bash
pnpm add -D @types/three
```

Sau khi cài, mở `package.json` kiểm tra `@react-three/fiber` nằm ở dải `^8`, **không phải** `^9`. Nếu pnpm kéo về bản 9 thì cài lại bằng `pnpm add "@react-three/fiber@8"`.

- [ ] **Step 2: Viết test cho trước**

Thêm vào cuối `tests/login-background.test.ts`:

```ts
describe("component canvas", () => {
  const source = readSource("components", "ui", "login-shader-canvas.tsx");

  it("là client component và export mặc định", () => {
    expect(source).toContain('"use client"');
    expect(source).toContain("export default function LoginShaderCanvas");
  });

  it("truyền đủ năm uniform", () => {
    for (const name of ["uTime", "uResolution", "uColor1", "uColor2", "uFadeColor"]) {
      expect(source).toContain(name);
    }
  });

  // Bản gốc khoá dpr ở 1x, nhìn bệt trên màn hình nét cao.
  it("nâng mật độ điểm ảnh lên 1.5x", () => {
    expect(source).toContain("dpr={[1, 1.5]}");
    expect(source).not.toContain("dpr={[1, 1]}");
  });

  it("chỉ file này được import three", () => {
    const others = [
      ["components", "ui", "login-shader-background.tsx"],
      ["components", "ui", "login-static-background.tsx"],
      ["app", "(auth)", "login", "layout.tsx"]
    ];

    for (const parts of others) {
      const other = readSource(...parts);

      expect(other).not.toMatch(/from "three"/);
      expect(other).not.toMatch(/@react-three\/fiber/);
    }
  });
});
```

Test cuối sẽ hỏng ở bước này vì `login-shader-background.tsx` chưa tồn tại — đó là chủ ý, Task 5 sẽ làm nó qua. Ở bước 4 dưới đây chỉ cần bốn test đầu qua.

- [ ] **Step 3: Viết component canvas**

Tạo `components/ui/login-shader-canvas.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { fragmentShader, vertexShader } from "@/components/ui/login-shader-source";
import type { LoginBackgroundPalette } from "@/lib/login-background-theme";

// Chậm hơn bản gốc (1.0) cho đỡ hút mắt khỏi phần đăng nhập.
const SPEED = 0.6;

function GradientPlane({ palette }: { palette: LoginBackgroundPalette }) {
  // Tạo một lần rồi cập nhật trong useFrame — đổi theme không phải dựng lại material.
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uColor1: { value: new THREE.Color(palette.color1) },
      uColor2: { value: new THREE.Color(palette.color2) },
      uFadeColor: { value: new THREE.Color(palette.fade) }
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useFrame((state) => {
    uniforms.uTime.value = state.clock.getElapsedTime() * SPEED;
    uniforms.uResolution.value.set(state.size.width, state.size.height);
    uniforms.uColor1.value.set(palette.color1);
    uniforms.uColor2.value.set(palette.color2);
    uniforms.uFadeColor.value.set(palette.fade);
  });

  return (
    <mesh scale={[2, 2, 1]}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

export default function LoginShaderCanvas({
  palette
}: {
  palette: LoginBackgroundPalette;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 1] }}
      dpr={[1, 1.5]}
      gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
    >
      <GradientPlane palette={palette} />
    </Canvas>
  );
}
```

- [ ] **Step 4: Chạy test — bốn test đầu của khối phải qua**

Run: `npx vitest run tests/login-background.test.ts -t "component canvas"`
Expected: 4 PASS, 1 FAIL (`chỉ file này được import three` — thiếu file của Task 5)

- [ ] **Step 5: Kiểm tra TypeScript**

Run: `npx tsc --noEmit`
Expected: không có lỗi.

Nếu báo lỗi kiểu ở các thẻ `<mesh>` / `<planeGeometry>` / `<shaderMaterial>`, kiểm lại `@react-three/fiber` đúng là bản 8 chưa — bản 9 khai JSX theo kiểu React 19 và sẽ không khớp với React 18.

Nếu `next build` (ở Task 6) báo lỗi phân giải module của `three`, thêm vào `next.config` ở cấp cao nhất của object config:

```js
  transpilePackages: ["three"],
```

- [ ] **Step 6: Commit**

```bash
git add components/ui/login-shader-canvas.tsx package.json pnpm-lock.yaml tests/login-background.test.ts
git commit -m "feat(login): component canvas ve nen shader"
```

---

### Task 5: Component điều phối

Quyết định dựng canvas hay giữ nền tĩnh, và theo dõi thay đổi theme.

**Files:**
- Create: `components/ui/login-shader-background.tsx`
- Test: `tests/login-background.test.ts` (thêm vào)

**Interfaces:**
- Consumes: `LoginStaticBackground` (Task 2), `getLoginBackgroundPalette` + `LoginBackgroundPalette` (Task 1), `LoginShaderCanvas` export mặc định (Task 4).
- Produces: `export function LoginShaderBackground(): JSX.Element`

- [ ] **Step 1: Viết test cho trước**

Thêm vào cuối `tests/login-background.test.ts`:

```ts
describe("component điều phối nền", () => {
  const source = readSource("components", "ui", "login-shader-background.tsx");

  it("là client component", () => {
    expect(source).toContain('"use client"');
  });

  // ssr: false -> three không lọt vào bundle máy chủ, trang login hiện ngay.
  it("nạp canvas trễ, không dựng phía máy chủ", () => {
    expect(source).toContain("ssr: false");
    expect(source).toContain("login-shader-canvas");
  });

  it("tôn trọng cài đặt giảm chuyển động", () => {
    expect(source).toContain("prefers-reduced-motion: reduce");
  });

  it("dò WebGL trước khi dựng canvas", () => {
    expect(source).toContain("getContext");
    expect(source).toContain("webgl");
  });

  it("theo dõi data-theme để đổi màu ngay khi bấm nút", () => {
    expect(source).toContain("MutationObserver");
    expect(source).toContain('attributeFilter: ["data-theme"]');
    expect(source).toContain("disconnect()");
  });

  it("luôn có nền tĩnh làm lớp lót", () => {
    expect(source).toContain("LoginStaticBackground");
  });
});
```

- [ ] **Step 2: Chạy test cho chắc là hỏng**

Run: `npx vitest run tests/login-background.test.ts -t "component điều phối"`
Expected: FAIL — `ENOENT ... login-shader-background.tsx`

- [ ] **Step 3: Viết component điều phối**

Tạo `components/ui/login-shader-background.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { LoginStaticBackground } from "@/components/ui/login-static-background";
import {
  getLoginBackgroundPalette,
  type LoginBackgroundPalette
} from "@/lib/login-background-theme";

// Nạp trễ để three không nằm trong bundle máy chủ lẫn bundle chung.
const LoginShaderCanvas = dynamic(() => import("@/components/ui/login-shader-canvas"), {
  ssr: false,
  loading: () => null
});

function hasWebgl(): boolean {
  try {
    const probe = document.createElement("canvas");

    return Boolean(probe.getContext("webgl") ?? probe.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

// Nền của trang đăng nhập: nền tĩnh luôn nằm dưới, lớp shader chỉ chồng lên khi
// máy đáp ứng được. Ba trường hợp rơi về nền tĩnh: người dùng bật giảm chuyển động,
// máy không có WebGL, hoặc chunk shader chưa tải xong.
export function LoginShaderBackground() {
  const [palette, setPalette] = useState<LoginBackgroundPalette | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    if (!hasWebgl()) {
      return;
    }

    const root = document.documentElement;
    const sync = () => setPalette(getLoginBackgroundPalette(root.dataset.theme));

    sync();

    // Nút chuyển sáng/tối ghi thẳng vào data-theme, không qua context nào.
    const observer = new MutationObserver(sync);

    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <LoginStaticBackground />
      {palette ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 animate-fade-in-soft"
        >
          <LoginShaderCanvas palette={palette} />
        </div>
      ) : null}
    </>
  );
}
```

- [ ] **Step 4: Chạy lại test cho chắc là qua**

Run: `npx vitest run tests/login-background.test.ts`
Expected: PASS — toàn bộ 24 test, kể cả `chỉ file này được import three` của Task 4.

- [ ] **Step 5: Commit**

```bash
git add components/ui/login-shader-background.tsx tests/login-background.test.ts
git commit -m "feat(login): dieu phoi nen shader va cac nhanh du phong"
```

---

### Task 6: Gắn vào trang đăng nhập

**Files:**
- Modify: `app/(auth)/login/layout.tsx:13-15`
- Test: `tests/login-background.test.ts` (thêm vào)

**Interfaces:**
- Consumes: `LoginShaderBackground` (Task 5).
- Produces: không có.

- [ ] **Step 1: Viết test cho trước**

Thêm vào cuối `tests/login-background.test.ts`:

```ts
describe("gắn nền vào trang đăng nhập", () => {
  it("layout đăng nhập dựng nền động", () => {
    const source = readSource("app", "(auth)", "login", "layout.tsx");

    expect(source).toContain("LoginShaderBackground");
    // Canvas phủ toàn khung, phải cắt phần tràn để không sinh thanh cuộn.
    expect(source).toContain("overflow-hidden");
    // Nội dung phải nổi lên trên lớp nền.
    expect(source).toContain("relative z-10");
  });

  it("giữ nguyên nội dung cột trái", () => {
    const source = readSource("app", "(auth)", "login", "layout.tsx");

    expect(source).toContain("Không gian luyện thi IELTS cho lớp học của bạn.");
    expect(source).toContain("Giao bài");
    expect(source).toContain("Chấm chữa");
  });

  // Học viên sau khi đăng nhập không được tải thêm gì.
  it("layout học viên và giáo viên không đụng tới nền động", () => {
    for (const parts of [
      ["app", "student", "layout.tsx"],
      ["app", "teacher", "layout.tsx"],
      ["app", "layout.tsx"]
    ]) {
      const source = readSource(...parts);

      expect(source).not.toContain("LoginShaderBackground");
      expect(source).not.toMatch(/from "three"/);
      expect(source).not.toMatch(/@react-three\/fiber/);
    }
  });
});
```

- [ ] **Step 2: Chạy test cho chắc là hỏng**

Run: `npx vitest run tests/login-background.test.ts -t "gắn nền"`
Expected: FAIL — layout chưa có `LoginShaderBackground`

- [ ] **Step 3: Sửa layout**

Trong `app/(auth)/login/layout.tsx`, thêm import ngay dưới import `AnimatedThemeToggle`:

```tsx
import { LoginShaderBackground } from "@/components/ui/login-shader-background";
```

Rồi thay hai dòng mở `<main>` và `<section>` (dòng 13–15) bằng:

```tsx
    <main className="relative min-h-screen overflow-hidden text-foreground">
      <LoginShaderBackground />
      <AnimatedThemeToggle className="fixed right-4 top-4 z-50 shadow-card" />
      <section className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-5 pb-20 pt-10 lg:grid-cols-[1fr_440px] lg:gap-16 lg:pb-28 lg:pt-6">
```

Không đổi gì khác trong file — toàn bộ phần thân `<section>` giữ nguyên.

- [ ] **Step 4: Chạy toàn bộ test**

Run: `npx vitest run`
Expected: PASS — mọi test của dự án, không có test cũ nào hỏng.

- [ ] **Step 5: Lint và build**

```bash
pnpm lint
```

```bash
pnpm build
```

Expected: cả hai sạch. Nếu build báo lỗi phân giải module của `three`, áp dụng `transpilePackages: ["three"]` như ghi ở Task 4 Step 5, rồi build lại.

- [ ] **Step 6: Commit**

```bash
git add "app/(auth)/login/layout.tsx" tests/login-background.test.ts
git commit -m "feat(login): gan nen dong vao trang dang nhap"
```

---

## Kiểm tra bằng mắt sau khi xong

Phần này không tự động được, phải mở thật.

- [ ] Chạy `pnpm dev`, mở `http://localhost:3000/login`.
- [ ] Soi theme sáng: nền có chuyển động chậm, chữ và 3 thẻ 01–03 vẫn đọc rõ.
- [ ] Bấm nút chuyển sang theme tối: nền phải đổi màu ngay, **không** còn mảng trắng ở góc dưới trái.
- [ ] Bấm qua lại vài lần xem có rò rỉ hay giật không.
- [ ] Vào `/login/student` và `/login/teacher` — nền vẫn còn vì dùng chung layout.
- [ ] Bật "giảm chuyển động" trong Windows (Cài đặt → Trợ năng → Hiệu ứng hình ảnh), tải lại: phải ra nền tĩnh, không có canvas.
- [ ] Mở DevTools → Network, lọc JS, đăng nhập vào trang học viên rồi kiểm: **không** có chunk nào chứa `three`.
- [ ] Chỉnh lại ba màu trong `lib/login-background-theme.ts` nếu nhìn thật thấy chưa ưng — đây là bước dự kiến sẽ phải làm, giá trị trong spec chỉ là điểm khởi đầu.
