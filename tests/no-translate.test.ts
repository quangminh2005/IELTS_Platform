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
