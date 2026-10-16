import { describe, expect, it } from "vitest";
import { formatAiUsageLine, improvedTextFor, toAiUsageView } from "@/lib/ai-grading/views";

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

describe("improvedTextFor — bản nâng cấp để thầy gửi học viên", () => {
  const result = {
    version: 1 as const,
    skill: "writing" as const,
    tasks: [
      { unitId: "u1", label: "T1", taskNumber: 1 as const, criteria: [], summary: "", errors: [] },
      {
        unitId: "u2",
        label: "T2",
        taskNumber: 2 as const,
        criteria: [],
        summary: "",
        errors: [],
        improved: [{ answerId: "a2", text: "Better essay." }]
      }
    ]
  };

  it("tìm đúng bài, lượt cũ/Speaking/không có thì null", () => {
    expect(improvedTextFor(result, "a2")).toBe("Better essay.");
    expect(improvedTextFor(result, "a1")).toBeNull();
    expect(improvedTextFor({ ...result, skill: "speaking" }, "a2")).toBeNull();
    expect(improvedTextFor(null, "a2")).toBeNull();
  });
});
