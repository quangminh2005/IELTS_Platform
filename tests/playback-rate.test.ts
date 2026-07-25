import { describe, expect, it } from "vitest";
import { PLAYBACK_RATES, formatPlaybackRate, nextPlaybackRate } from "@/lib/playback-rate";

describe("nextPlaybackRate", () => {
  it("đi lần lượt 1x → 1.25x → 1.5x → 0.75x rồi vòng lại 1x", () => {
    expect(nextPlaybackRate(1)).toBe(1.25);
    expect(nextPlaybackRate(1.25)).toBe(1.5);
    expect(nextPlaybackRate(1.5)).toBe(0.75);
    expect(nextPlaybackRate(0.75)).toBe(1);
  });

  it("bấm đủ số mức thì trở về đúng mức ban đầu", () => {
    let rate = 1;
    for (let i = 0; i < PLAYBACK_RATES.length; i += 1) {
      rate = nextPlaybackRate(rate);
    }
    expect(rate).toBe(1);
  });

  it("tốc độ lạ (trình duyệt tự đổi) thì đưa về 1x", () => {
    expect(nextPlaybackRate(2)).toBe(1);
    expect(nextPlaybackRate(0)).toBe(1);
    expect(nextPlaybackRate(Number.NaN)).toBe(1);
  });
});

describe("formatPlaybackRate", () => {
  it("bỏ số 0 vô nghĩa", () => {
    expect(formatPlaybackRate(1)).toBe("1x");
    expect(formatPlaybackRate(1.25)).toBe("1.25x");
    expect(formatPlaybackRate(1.5)).toBe("1.5x");
    expect(formatPlaybackRate(0.75)).toBe("0.75x");
  });
});
