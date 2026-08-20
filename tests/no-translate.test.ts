import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
