import { describe, expect, it } from "vitest";
import {
  effectiveDailyLimit,
  isStalePending,
  remainingAiQuota,
  vnDayStart,
  vnMonthStart
} from "@/lib/ai-grading/quota";
import { costUsd, formatVnd, sumUsage } from "@/lib/ai-grading/pricing";

describe("lượt AI chấm theo ngày giờ VN", () => {
  it("23:59 giờ VN vẫn thuộc ngày cũ, 00:00 sang ngày mới", () => {
    expect(vnDayStart(new Date("2026-10-05T16:59:00Z")).toISOString()).toBe("2026-10-04T17:00:00.000Z");
    expect(vnDayStart(new Date("2026-10-05T17:00:00Z")).toISOString()).toBe("2026-10-05T17:00:00.000Z");
  });

  it("đầu tháng giờ VN", () => {
    // 01:00 ngày 1/11 giờ VN
    expect(vnMonthStart(new Date("2026-10-31T18:00:00Z")).toISOString()).toBe("2026-10-31T17:00:00.000Z");
    expect(vnMonthStart(new Date("2026-10-15T03:00:00Z")).toISOString()).toBe("2026-09-30T17:00:00.000Z");
  });

  it("giới hạn mặc định 3, kẹp trong 0..20", () => {
    expect(effectiveDailyLimit(null)).toBe(3);
    expect(effectiveDailyLimit(undefined)).toBe(3);
    expect(effectiveDailyLimit(5)).toBe(5);
    expect(effectiveDailyLimit(-1)).toBe(0);
    expect(effectiveDailyLimit(99)).toBe(20);
    expect(remainingAiQuota(3, 1)).toBe(2);
    expect(remainingAiQuota(3, 7)).toBe(0);
  });

  it("lượt pending quá 5 phút là hỏng", () => {
    const now = new Date("2026-10-05T10:00:00Z");
    expect(isStalePending(new Date("2026-10-05T09:56:00Z"), now)).toBe(false);
    expect(isStalePending(new Date("2026-10-05T09:54:00Z"), now)).toBe(true);
  });
});

describe("giá", () => {
  it("tính USD theo token thường + cached + output", () => {
    const usd = costUsd("gpt-6.1-sol", { inputTokens: 5000, cachedInputTokens: 3000, outputTokens: 4000 });
    expect(usd).toBeCloseTo(0.0443, 6);
  });

  it("tên model kèm đuôi phiên bản vẫn ra giá", () => {
    expect(costUsd("gpt-6.1-sol-2026-09-01", { inputTokens: 1_000_000, cachedInputTokens: 0, outputTokens: 0 })).toBe(2);
  });

  it("model lạ → null", () => {
    expect(costUsd("model-la", { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 })).toBeNull();
  });

  it("cộng usage và hiện VND làm tròn trăm đồng", () => {
    expect(sumUsage([
      { inputTokens: 1, cachedInputTokens: 2, outputTokens: 3 },
      { inputTokens: 10, cachedInputTokens: 20, outputTokens: 30 }
    ])).toEqual({ inputTokens: 11, cachedInputTokens: 22, outputTokens: 33 });
    expect(formatVnd(0.0443)).toBe("1.200đ");
  });
});
