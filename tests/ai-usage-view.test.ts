import { describe, expect, it } from "vitest";
import { formatAiUsageLine, toAiUsageView } from "@/lib/ai-grading/views";

describe("dòng model / token / chi phí cho thầy", () => {
  const row = {
    model: "gpt-6.1-sol",
    inputTokens: 3244,
    cachedInputTokens: 2887,
    outputTokens: 1120,
    costUsd: 0.018
  };

  it("đủ số liệu → hiện model, token, tiền USD + VNĐ", () => {
    expect(formatAiUsageLine(toAiUsageView(row)!)).toBe(
      "Model gpt-6.1-sol · 3.244 token vào (2.887 đọc lại từ bộ nhớ đệm) + 1.120 token ra · ≈ $0,0180 (~500đ)"
    );
  });

  it("không có token đọc lại thì bỏ phần ngoặc", () => {
    expect(formatAiUsageLine(toAiUsageView({ ...row, cachedInputTokens: 0 })!)).toBe(
      "Model gpt-6.1-sol · 3.244 token vào + 1.120 token ra · ≈ $0,0180 (~500đ)"
    );
  });

  it("model chưa có trong bảng giá → không đoán tiền", () => {
    expect(formatAiUsageLine(toAiUsageView({ ...row, model: "gpt-7", costUsd: null })!)).toBe(
      "Model gpt-7 · 3.244 token vào (2.887 đọc lại từ bộ nhớ đệm) + 1.120 token ra · chưa có bảng giá"
    );
  });

  it("lượt cũ / lỗi không có số token → null", () => {
    expect(toAiUsageView({ ...row, inputTokens: null, outputTokens: null })).toBeNull();
  });
});
