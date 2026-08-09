import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
