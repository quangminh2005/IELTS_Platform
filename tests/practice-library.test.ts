import { describe, expect, it } from "vitest";
import { practiceProgressLabel } from "@/lib/practice-library";

describe("practiceProgressLabel", () => {
  it("chưa luyện lần nào", () => {
    expect(practiceProgressLabel(0, null, 40)).toBe("Chưa luyện");
  });

  it("đã luyện và có điểm cao nhất", () => {
    expect(practiceProgressLabel(3, 32, 40)).toBe("Đã luyện 3 lần · cao nhất 32/40");
  });

  it("đã luyện nhưng chưa có điểm (bài chờ chấm)", () => {
    expect(practiceProgressLabel(1, null, 2)).toBe("Đã luyện 1 lần · chờ chấm");
  });
});
