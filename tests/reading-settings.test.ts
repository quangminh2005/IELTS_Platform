import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEFAULT_FONT_SCALE,
  FONT_PRESETS,
  parseReadingTone,
  snapFontScale
} from "@/lib/reading-settings";

describe("snapFontScale", () => {
  it("giá trị hỏng / thiếu -> mặc định Vừa", () => {
    expect(snapFontScale(null)).toBe(DEFAULT_FONT_SCALE);
    expect(snapFontScale("abc")).toBe(DEFAULT_FONT_SCALE);
    expect(snapFontScale(0)).toBe(DEFAULT_FONT_SCALE);
    expect(FONT_PRESETS.find((p) => p.scale === DEFAULT_FONT_SCALE)?.label).toBe("Vừa");
  });

  it("giá trị cũ của nút A−/A+ (0.9–1.6) về mức gần nhất", () => {
    expect(snapFontScale("0.9")).toBe(0.95);
    expect(snapFontScale("1.2")).toBe(1.25);
    expect(snapFontScale("1.6")).toBe(1.45);
    expect(snapFontScale("1.25")).toBe(1.25);
  });
});

describe("parseReadingTone", () => {
  it("chỉ nhận màu có trong danh sách", () => {
    expect(parseReadingTone("sepia")).toBe("sepia");
    expect(parseReadingTone("green")).toBe("green");
    expect(parseReadingTone("pink")).toBe("default");
    expect(parseReadingTone(null)).toBe("default");
  });
});

describe("CSS nền dịu mắt", () => {
  const css = readFileSync("app/globals.css", "utf8");

  it("mỗi màu nền có khối biến riêng, chỉ áp ở chế độ sáng", () => {
    for (const tone of ["sepia", "green"]) {
      expect(css).toContain(`html:not([data-theme="dark"]) [data-reading-tone="${tone}"]`);
    }
  });
});
