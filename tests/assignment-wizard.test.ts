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
