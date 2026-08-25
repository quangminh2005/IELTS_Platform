import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LOGIN_SHADER_MIN_WIDTH,
  shouldLoadLoginShader
} from "../lib/login-background-theme";

const root = process.cwd();
const backgroundSource = readFileSync(
  join(root, "components", "ui", "login-shader-background.tsx"),
  "utf8"
);

// Bối cảnh: three.js 0.185 dùng cú pháp `static { ... }`, chỉ chạy từ iOS Safari
// 16.4 / Chrome 94 trở lên. Máy cũ hơn báo lỗi cú pháp ngay lúc đọc file, chunk
// chết, và vì không có lưới đỡ nào nên SẬP LUÔN trang đăng nhập — học viên không
// còn đường vào. Hai chốt dưới đây là để chuyện đó không lặp lại.
describe("chốt an toàn cho nền động trang đăng nhập", () => {
  describe("điều kiện nạp shader", () => {
    const desktop = { reducedMotion: false, hasWebgl: true, viewportWidth: 1440 };

    it("máy tính màn rộng, có WebGL, không bật giảm chuyển động thì mới nạp", () => {
      expect(shouldLoadLoginShader(desktop)).toBe(true);
    });

    // Chốt chính của lần sửa này: điện thoại KHÔNG tải three.js nữa.
    it("màn hình hẹp cỡ điện thoại thì không nạp", () => {
      expect(shouldLoadLoginShader({ ...desktop, viewportWidth: 390 })).toBe(false);
      expect(shouldLoadLoginShader({ ...desktop, viewportWidth: 768 })).toBe(false);
    });

    it("ngưỡng là màn từ 1024px trở lên", () => {
      expect(LOGIN_SHADER_MIN_WIDTH).toBe(1024);
      expect(shouldLoadLoginShader({ ...desktop, viewportWidth: 1023 })).toBe(false);
      expect(shouldLoadLoginShader({ ...desktop, viewportWidth: 1024 })).toBe(true);
    });

    it("máy không có WebGL thì không nạp", () => {
      expect(shouldLoadLoginShader({ ...desktop, hasWebgl: false })).toBe(false);
    });

    it("người dùng bật giảm chuyển động thì không nạp", () => {
      expect(shouldLoadLoginShader({ ...desktop, reducedMotion: true })).toBe(false);
    });
  });

  describe("lưới đỡ khi nền động hỏng", () => {
    // Kể cả khi qua hết các chốt trên, việc tải/khởi tạo shader vẫn có thể ném lỗi
    // (chunk hỏng, hết ngữ cảnh WebGL, trình duyệt lạ). Lỗi của một mảng TRANG TRÍ
    // tuyệt đối không được phép kéo sập trang đăng nhập.
    it("canvas shader nằm trong error boundary", () => {
      expect(backgroundSource).toMatch(/<LoginBackgroundBoundary>/);
    });

    it("có componentDidCatch hoặc getDerivedStateFromError để nuốt lỗi", () => {
      expect(backgroundSource).toMatch(/getDerivedStateFromError|componentDidCatch/);
    });

    it("nền tĩnh luôn được render, không phụ thuộc shader", () => {
      expect(backgroundSource).toContain("<LoginStaticBackground />");
    });
  });
});
