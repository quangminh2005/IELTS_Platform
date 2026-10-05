import type { Prisma } from "@prisma/client";
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
