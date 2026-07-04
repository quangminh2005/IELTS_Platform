import { describe, expect, it } from "vitest";
import {
  SKILL_LABELS,
  SKILL_ORDER,
  SKILL_PILL_CLASSES,
  distinctSkills,
} from "../lib/skills";

describe("distinctSkills", () => {
  it("khử trùng và sắp theo thứ tự chuẩn", () => {
    expect(distinctSkills(["reading", "listening", "reading"])).toEqual([
      "listening",
      "reading",
    ]);
  });

  it("bỏ qua giá trị không hợp lệ", () => {
    expect(distinctSkills(["speaking", "xxx", "writing"])).toEqual([
      "writing",
      "speaking",
    ]);
  });

  it("mảng rỗng trả về rỗng", () => {
    expect(distinctSkills([])).toEqual([]);
  });
});

describe("bảng nhãn & màu", () => {
  it("có đủ nhãn tiếng Việt cho 4 kỹ năng", () => {
    for (const skill of SKILL_ORDER) {
      expect(SKILL_LABELS[skill]).toBeTruthy();
      expect(SKILL_PILL_CLASSES[skill]).toBeTruthy();
    }
    expect(SKILL_LABELS.listening).toBe("Nghe");
    expect(SKILL_LABELS.reading).toBe("Đọc");
    expect(SKILL_LABELS.writing).toBe("Viết");
    expect(SKILL_LABELS.speaking).toBe("Nói");
  });
});
