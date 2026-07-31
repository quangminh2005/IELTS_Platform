import { describe, expect, it } from "vitest";
import {
  WIZARD_STEPS,
  matchesSearch,
  maxReachableStep,
  normalizeSearch,
  stepBlocker,
  submitLabel,
  summaryLabel,
  toggleClassChip
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
    for (const step of [1, 2, 3]) {
      // Bẫy cả hai dạng render-có-điều-kiện bọc quanh khối data-wizard-step="n":
      // ternary `{step === n ? (<div data-wizard-step="n" ...>` và
      // `&&` `{step === n && <div data-wizard-step="n" ...>`. Cả hai đều gỡ
      // input khỏi DOM khi step khác n, chỉ khác cú pháp. Neo theo
      // `data-wizard-step="n"` để không bắt nhầm ternary khác trong file (ví
      // dụ ternary đổi nhãn nút submit ở bước 3, vốn không liên quan tới việc
      // ẩn/hiện nội dung bước).
      expect(source).not.toMatch(
        new RegExp(`\\{\\s*step === ${step}\\s*\\?\\s*\\(?\\s*<div\\s+data-wizard-step="${step}"`)
      );
      expect(source).not.toMatch(
        new RegExp(`\\{\\s*step === ${step}\\s*&&\\s*\\(?\\s*<div\\s+data-wizard-step="${step}"`)
      );
    }
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

describe("bước 1 — cây chọn đề", () => {
  it("cây gắn data-search cho cả 4 cấp", () => {
    const picker = readSource("components/unit-picker.tsx");
    const test = readSource("components/unit-picker-test.tsx");
    expect(picker).toContain('data-wizard-node="book"');
    expect(picker).toContain('data-wizard-node="skill"');
    expect(test).toContain('data-wizard-node="test"');
    expect(test).toContain('data-wizard-node="unit"');
  });

  it("data-search mỗi cấp phải gộp text của tổ tiên (không thì gõ tên bộ đề sẽ làm rỗng nhánh con)", () => {
    const picker = readSource("components/unit-picker.tsx");
    const test = readSource("components/unit-picker-test.tsx");

    // Cấp kỹ năng: data-search phải chứa cả tên bộ đề (bookNode.book) lẫn nhãn
    // kỹ năng, không chỉ riêng nhãn kỹ năng.
    expect(picker).toContain('data-search={`${bookNode.book} ${skillLabel(skillNode.skill)}`}');

    // searchText truyền xuống UnitPickerTest phải gộp đủ cả 3 cấp trên: tên bộ
    // đề, nhãn kỹ năng và tên đề (test.label).
    expect(picker).toContain(
      "searchText={`${bookNode.book} ${skillLabel(skillNode.skill)} ${test.label}`}"
    );

    // Cấp phần (unit) trong 1 đề: data-search phải chứa cả searchText nhận từ
    // cha (đã gộp bộ đề + kỹ năng + tên đề) lẫn tiêu đề riêng của phần.
    expect(test).toContain('data-search={`${searchText} ${unit.title}`}');
  });

  it("lớp lọc đọc data-search và mở nhánh khớp", () => {
    const source = readSource("components/unit-search-filter.tsx");
    expect(source).toContain("matchesSearch");
    expect(source).toContain("data-wizard-node");
    expect(source).toContain("hidden");
  });

  it("lớp lọc toggle cả class Tailwind \"hidden\" cạnh thuộc tính hidden (utility flex ở @layer utilities đè [hidden]:display:none của @layer base nên chỉ set thuộc tính là không đủ)", () => {
    const source = readSource("components/unit-search-filter.tsx");
    expect(source).toContain('classList.toggle("hidden"');
  });

  it("chip bỏ chọn bấm vào chính checkbox để React cập nhật state", () => {
    const source = readSource("components/assignment-wizard.tsx");
    expect(source).toContain('input[name="unitIds"][value=');
    expect(source).toContain(".click()");
  });
});

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

// Học viên có thể thuộc nhiều lớp cùng lúc (vd. Minh ở cả K1 và K2). Bấm chip
// K1 rồi bấm chip K2 rồi tắt K1 không được làm mất tick của Minh, và không
// được làm chip K2 tự tối đi — Minh vẫn còn được K2 "che". Tách hàm thuần để
// test được đủ các trường hợp mà không cần dựng component.
describe("toggleClassChip", () => {
  const studentsByClass = {
    k1: ["minh", "an"], // an chỉ học K1
    k2: ["minh", "binh"] // binh chỉ học K2
  };

  it("bật một lớp: chọn hết học viên lớp đó, chip vào activeClassIds", () => {
    const result = toggleClassChip({
      selected: [],
      activeClassIds: [],
      classId: "k1",
      studentsByClass
    });
    expect(new Set(result.selected)).toEqual(new Set(["minh", "an"]));
    expect(result.activeClassIds).toEqual(["k1"]);
  });

  it("bật K1 rồi bật K2 (Minh ở cả hai): Minh chỉ xuất hiện một lần trong selected", () => {
    const afterK1 = toggleClassChip({
      selected: [],
      activeClassIds: [],
      classId: "k1",
      studentsByClass
    });
    const afterK2 = toggleClassChip({
      selected: afterK1.selected,
      activeClassIds: afterK1.activeClassIds,
      classId: "k2",
      studentsByClass
    });
    const minhCount = afterK2.selected.filter((id) => id === "minh").length;
    expect(minhCount).toBe(1);
    expect(new Set(afterK2.selected)).toEqual(new Set(["minh", "an", "binh"]));
    expect(new Set(afterK2.activeClassIds)).toEqual(new Set(["k1", "k2"]));
  });

  it("bật K1, bật K2, rồi tắt K1: Minh vẫn còn, K2 vẫn bật, an (chỉ K1) bị gỡ", () => {
    const afterK1 = toggleClassChip({
      selected: [],
      activeClassIds: [],
      classId: "k1",
      studentsByClass
    });
    const afterK2 = toggleClassChip({
      selected: afterK1.selected,
      activeClassIds: afterK1.activeClassIds,
      classId: "k2",
      studentsByClass
    });
    const afterOffK1 = toggleClassChip({
      selected: afterK2.selected,
      activeClassIds: afterK2.activeClassIds,
      classId: "k1",
      studentsByClass
    });
    expect(afterOffK1.selected).toContain("minh");
    expect(afterOffK1.selected).toContain("binh");
    expect(afterOffK1.selected).not.toContain("an");
    expect(afterOffK1.activeClassIds).toEqual(["k2"]);
  });

  it("tắt lớp cuối cùng: selected rỗng, activeClassIds rỗng", () => {
    const afterK1 = toggleClassChip({
      selected: [],
      activeClassIds: [],
      classId: "k1",
      studentsByClass
    });
    const afterK2 = toggleClassChip({
      selected: afterK1.selected,
      activeClassIds: afterK1.activeClassIds,
      classId: "k2",
      studentsByClass
    });
    const afterOffK1 = toggleClassChip({
      selected: afterK2.selected,
      activeClassIds: afterK2.activeClassIds,
      classId: "k1",
      studentsByClass
    });
    const afterOffK2 = toggleClassChip({
      selected: afterOffK1.selected,
      activeClassIds: afterOffK1.activeClassIds,
      classId: "k2",
      studentsByClass
    });
    expect(afterOffK2.selected).toEqual([]);
    expect(afterOffK2.activeClassIds).toEqual([]);
  });

  it("không làm thay đổi mảng đầu vào", () => {
    const selected = ["an"];
    const activeClassIds = ["k1"];
    const selectedCopy = [...selected];
    const activeClassIdsCopy = [...activeClassIds];
    toggleClassChip({ selected, activeClassIds, classId: "k2", studentsByClass });
    expect(selected).toEqual(selectedCopy);
    expect(activeClassIds).toEqual(activeClassIdsCopy);
  });
});

describe("student-picker: học viên bị lọc không được rời DOM", () => {
  const source = readSource("components/student-picker.tsx");

  it("render toàn bộ students, không phải một mảng đã lọc riêng", () => {
    // Vòng lặp danh sách phải chạy trên students (mảng gốc đầy đủ) — nếu ai đó
    // đổi sang render từ một mảng đã .filter() theo ô tìm, học viên đã tick mà
    // bị lọc khỏi màn hình sẽ rơi khỏi FormData khi bấm Giao bài.
    expect(source).toMatch(/\{students\.map\(/);
    expect(source).not.toMatch(/\{(visibleStudents|filteredStudents)\.map\(/);
    expect(source).not.toMatch(/students\s*\.filter\([^)]*\)\s*\.map\(/);
  });

  it("học viên bị lọc chỉ ẩn bằng class \"hidden\", không dùng thuộc tính hidden", () => {
    // Tailwind đặt [hidden] ở @layer base nên không thắng được class
    // "flex"/"grid" cùng phần tử — Task 3 đã mất một vòng sửa vì đúng lỗi này.
    expect(source).toContain('${hiddenBySearch ? "hidden" : ""}');
    expect(source).not.toMatch(/<label[^>]*\shidden=\{[^}]*\}/);
    expect(source).not.toMatch(/<label[^>]*\shidden(\s|>)/);
  });
});
