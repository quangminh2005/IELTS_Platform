import { describe, expect, it } from "vitest";
import { durationExceedsLimit, formatDuration } from "../lib/format-duration";

describe("formatDuration", () => {
  it("shows seconds under a minute", () => {
    expect(formatDuration(0)).toBe("0 giây");
    expect(formatDuration(45)).toBe("45 giây");
    expect(formatDuration(59)).toBe("59 giây");
  });

  it("shows minutes (and seconds when not whole)", () => {
    expect(formatDuration(60)).toBe("1 phút");
    expect(formatDuration(90)).toBe("1 phút 30 giây");
    expect(formatDuration(754)).toBe("12 phút 34 giây");
    expect(formatDuration(3599)).toBe("59 phút 59 giây");
  });

  it("shows hours with zero-padded minutes past one hour", () => {
    expect(formatDuration(3600)).toBe("1 giờ 00 phút");
    expect(formatDuration(3900)).toBe("1 giờ 05 phút");
    expect(formatDuration(7380)).toBe("2 giờ 03 phút");
  });

  it("floors fractional seconds and clamps negatives to zero", () => {
    expect(formatDuration(45.9)).toBe("45 giây");
    expect(formatDuration(-10)).toBe("0 giây");
  });
});

describe("durationExceedsLimit", () => {
  it("flags only when a time limit exists and is exceeded", () => {
    expect(durationExceedsLimit(700, 10)).toBe(true); // 700s > 10 phút
    expect(durationExceedsLimit(600, 10)).toBe(false); // đúng bằng giới hạn
    expect(durationExceedsLimit(9999, null)).toBe(false); // bài không giới hạn giờ
    expect(durationExceedsLimit(9999, 0)).toBe(false);
  });
});
