import type { Prisma } from "@prisma/client";
import { formatVnd } from "@/lib/ai-grading/pricing";
import { isStalePending } from "@/lib/ai-grading/quota";
import type { AiGradingResult, AiRequester, AiReviewStatus } from "@/lib/ai-grading/types";
import { parseAiGradingResult } from "@/lib/ai-grading/validate";

export const AI_REVIEW_VIEW_SELECT = {
  id: true,
  status: true,
  requestedBy: true,
  errorMessage: true,
  resultJson: true,
  createdAt: true
} satisfies Prisma.AiReviewSelect;

export type AiReviewRow = {
  id: string;
  status: string;
  requestedBy: string;
  errorMessage: string | null;
  resultJson: string | null;
  createdAt: Date;
};

export type AiReviewView = {
  id: string;
  status: AiReviewStatus;
  requestedBy: AiRequester;
  errorMessage: string | null;
  result: AiGradingResult | null;
  createdAt: Date;
};

// Dòng AiReview → dạng hiển thị. Lượt "pending" quá lâu (hàm máy chủ chết giữa chừng)
// và lượt "done" mà resultJson hỏng đều hiện như lỗi.
export function toAiReviewView(row: AiReviewRow, now: Date): AiReviewView {
  const stale = row.status === "pending" && isStalePending(row.createdAt, now);
  const result = row.status === "done" ? parseAiGradingResult(row.resultJson) : null;
  const status: AiReviewStatus =
    stale || (row.status === "done" && !result)
      ? "failed"
      : row.status === "done" || row.status === "pending"
        ? row.status
        : "failed";

  return {
    id: row.id,
    status,
    requestedBy: row.requestedBy === "student" ? "student" : "teacher",
    errorMessage: stale ? "Lượt chấm bị gián đoạn, hãy thử lại." : row.errorMessage,
    result,
    createdAt: row.createdAt
  };
}

// ---- Model / token / chi phí của một lượt (CHỈ trang của thầy) ----
// Tách khỏi AI_REVIEW_VIEW_SELECT vì select đó dùng cả ở trang Kết quả của học viên —
// học viên không được thấy chi phí.
export const AI_REVIEW_USAGE_SELECT = {
  model: true,
  inputTokens: true,
  cachedInputTokens: true,
  outputTokens: true,
  costUsd: true
} satisfies Prisma.AiReviewSelect;

export type AiUsageView = {
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  // null = model chưa có trong bảng giá (lib/ai-grading/pricing.ts).
  costUsd: number | null;
};

export function toAiUsageView(row: {
  model: string;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
}): AiUsageView | null {
  if (row.inputTokens === null || row.outputTokens === null) return null;
  return {
    model: row.model,
    inputTokens: row.inputTokens,
    cachedInputTokens: row.cachedInputTokens ?? 0,
    outputTokens: row.outputTokens,
    costUsd: row.costUsd
  };
}

function formatCount(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function formatAiUsageLine(usage: AiUsageView): string {
  const cached =
    usage.cachedInputTokens > 0 ? ` (${formatCount(usage.cachedInputTokens)} đọc lại từ bộ nhớ đệm)` : "";
  const cost =
    usage.costUsd === null
      ? "chưa có bảng giá"
      : `≈ $${usage.costUsd.toFixed(4).replace(".", ",")} (~${formatVnd(usage.costUsd)})`;
  return [
    `Model ${usage.model}`,
    `${formatCount(usage.inputTokens)} token vào${cached} + ${formatCount(usage.outputTokens)} token ra`,
    cost
  ].join(" · ");
}
