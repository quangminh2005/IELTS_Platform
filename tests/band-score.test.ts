import { describe, expect, it } from "vitest";
import { bandScore, formatBand } from "../lib/band-score";

describe("bandScore - Listening", () => {
  it("maps correct counts to the official Listening bands (out of 40)", () => {
    expect(bandScore("listening", 40, 40)).toBe(9);
    expect(bandScore("listening", 39, 40)).toBe(9);
    expect(bandScore("listening", 38, 40)).toBe(8.5);
    expect(bandScore("listening", 35, 40)).toBe(8);
    expect(bandScore("listening", 34, 40)).toBe(7.5);
    expect(bandScore("listening", 30, 40)).toBe(7);
    expect(bandScore("listening", 29, 40)).toBe(6.5);
    expect(bandScore("listening", 23, 40)).toBe(6);
    expect(bandScore("listening", 18, 40)).toBe(5.5);
    expect(bandScore("listening", 16, 40)).toBe(5);
    expect(bandScore("listening", 13, 40)).toBe(4.5);
    expect(bandScore("listening", 11, 40)).toBe(4);
  });

  it("returns null below the lowest Listening threshold", () => {
    expect(bandScore("listening", 10, 40)).toBeNull();
    expect(bandScore("listening", 0, 40)).toBeNull();
  });
});

describe("bandScore - Reading (Academic)", () => {
  it("maps correct counts to the official Reading bands (out of 40)", () => {
    expect(bandScore("reading", 40, 40)).toBe(9);
    expect(bandScore("reading", 37, 40)).toBe(8.5);
    expect(bandScore("reading", 33, 40)).toBe(7.5);
    expect(bandScore("reading", 32, 40)).toBe(7);
    expect(bandScore("reading", 27, 40)).toBe(6.5);
    expect(bandScore("reading", 23, 40)).toBe(6);
    expect(bandScore("reading", 19, 40)).toBe(5.5);
    expect(bandScore("reading", 15, 40)).toBe(5);
    expect(bandScore("reading", 13, 40)).toBe(4.5);
    expect(bandScore("reading", 10, 40)).toBe(4);
    expect(bandScore("reading", 4, 40)).toBe(2.5);
    expect(bandScore("reading", 3, 40)).toBeNull();
  });
});

describe("bandScore - scaling and edge cases", () => {
  it("does NOT scale partial tests — only full 40-question tests get a band", () => {
    // Bài lẻ (không đủ 40 câu) -> null, không tự quy đổi lên thang 40.
    expect(bandScore("reading", 8, 10)).toBeNull();
    expect(bandScore("listening", 9, 10)).toBeNull();
    expect(bandScore("listening", 7, 10)).toBeNull();
    expect(bandScore("reading", 30, 38)).toBeNull();
  });

  it("returns null for non-band skills and non-40 tests", () => {
    expect(bandScore("writing", 40, 40)).toBeNull();
    expect(bandScore("speaking", 40, 40)).toBeNull();
    expect(bandScore("listening", 5, 0)).toBeNull();
  });

  it("formats bands with one decimal, dash for null", () => {
    expect(formatBand(7.5)).toBe("7.5");
    expect(formatBand(9)).toBe("9.0");
    expect(formatBand(null)).toBe("—");
  });
});
