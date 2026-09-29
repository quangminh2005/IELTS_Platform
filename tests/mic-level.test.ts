import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DEAD_MIC_WARN_MS,
  hasSignal,
  isMicSilent,
  meterPercent,
  peakOf
} from "@/lib/mic-level";

// 29/9/2026: học viên ghi 5 câu Speaking, file nào cũng câm tuyệt đối (mẫu = 0)
// vì micro bị tắt/chọn nhầm, mà màn ghi âm không báo gì.
describe("đo tín hiệu micro", () => {
  it("micro chết (toàn số 0) là không có tín hiệu", () => {
    expect(peakOf(new Float32Array(2048))).toBe(0);
    expect(hasSignal(0)).toBe(false);
  });

  it("nhiễu nền rất nhỏ của micro thật vẫn tính là có tín hiệu", () => {
    // ~ -70 dB: phòng yên tĩnh, đã qua lọc ồn.
    expect(hasSignal(0.0003)).toBe(true);
    expect(peakOf([0.001, -0.02, 0.005])).toBeCloseTo(0.02);
  });

  it("thanh âm lượng theo thang dB, kẹp 0–100", () => {
    expect(meterPercent(0)).toBe(0);
    expect(meterPercent(1)).toBe(100);
    expect(meterPercent(2)).toBe(100);
    expect(meterPercent(0.001)).toBe(0); // -60 dB
    expect(meterPercent(0.0316)).toBe(50); // ~ -30 dB
  });

  it("cảnh báo sau đủ thời gian im lặng tuyệt đối", () => {
    expect(isMicSilent(1000, 1000 + DEAD_MIC_WARN_MS - 1)).toBe(false);
    expect(isMicSilent(1000, 1000 + DEAD_MIC_WARN_MS)).toBe(true);
  });
});

describe("ô ghi âm dùng bộ đo", () => {
  const recorder = readFileSync(
    join(process.cwd(), "components", "audio-recorder-answer.tsx"),
    "utf8"
  );

  it("hiện thanh âm lượng + cảnh báo micro không thu được tiếng", () => {
    expect(recorder).toContain('role="meter"');
    expect(recorder).toMatch(/micSilent \?/);
    expect(recorder).toMatch(/Micro không thu được tiếng/);
  });

  it("không báo nhầm khi AudioContext còn treo", () => {
    expect(recorder).toMatch(/context\.state !== "running"/);
  });

  it("bản ghi câm vẫn được lưu nhưng có cảnh báo cạnh trình phát", () => {
    expect(recorder).toMatch(/setSavedSilent\(source === "recorded" && heardRef\.current === false\)/);
    expect(recorder).toMatch(/Bản ghi này không có tiếng/);
  });
});
