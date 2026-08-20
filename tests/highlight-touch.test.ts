import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { placeHighlightPopup } from "../lib/highlight-popup-position";

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const layer = read("components/highlight-layer.tsx");
const region = read("components/highlight-region.tsx");
const hook = read("components/use-selection-capture.ts");

// Trên điện thoại, nhấn–giữ để bôi đen KHÔNG sinh ra `mouseup` (trình duyệt cảm
// ứng chỉ giả lập sự kiện chuột cho cú chạm đơn). Chỉ nghe `mouseup` là học
// sinh làm bài trên điện thoại không tô màu được — đã dính lỗi này một lần.
describe("bắt vùng chọn trên cảm ứng", () => {
  it("cả hai vùng tô màu đều dùng hook bắt vùng chọn", () => {
    for (const source of [layer, region]) {
      expect(source).toContain("useSelectionCapture");
    }
  });

  it("hook nghe selectionchange chứ không chỉ dựa vào mouseup", () => {
    expect(hook).toContain('addEventListener("selectionchange"');
    expect(hook).toContain('removeEventListener("selectionchange"');
  });

  it("hook chờ nhấc tay rồi mới mở popup", () => {
    expect(hook).toContain('addEventListener("pointerup"');
    expect(hook).toContain('addEventListener("pointerdown"');
  });
});

describe("đặt popup tô màu trong màn hình", () => {
  const size = { width: 224, height: 88 };
  const screen = { viewportWidth: 375, viewportHeight: 812 };

  it("bôi đen sát mép trái vẫn thấy đủ popup", () => {
    const place = placeHighlightPopup({ x: 20, top: 400, bottom: 420, ...size, ...screen });

    expect(place.left).toBeGreaterThanOrEqual(0);
  });

  it("bôi đen sát mép phải vẫn thấy đủ popup", () => {
    const place = placeHighlightPopup({ x: 370, top: 400, bottom: 420, ...size, ...screen });

    expect(place.left + size.width).toBeLessThanOrEqual(screen.viewportWidth);
  });

  it("bôi đen sát mép trên thì popup lật xuống dưới", () => {
    const place = placeHighlightPopup({ x: 180, top: 10, bottom: 30, ...size, ...screen });

    expect(place.top).toBeGreaterThanOrEqual(30);
    expect(place.top + size.height).toBeLessThanOrEqual(screen.viewportHeight);
  });

  it("còn chỗ phía trên thì popup nằm trên vùng bôi đen", () => {
    const place = placeHighlightPopup({ x: 180, top: 400, bottom: 420, ...size, ...screen });

    expect(place.top + size.height).toBeLessThanOrEqual(400);
  });

  it("màn hình hẹp hơn popup thì vẫn ghim mép trái", () => {
    const place = placeHighlightPopup({
      x: 100,
      top: 300,
      bottom: 320,
      width: 400,
      height: 88,
      viewportWidth: 320,
      viewportHeight: 640
    });

    expect(place.left).toBe(0);
  });
});
