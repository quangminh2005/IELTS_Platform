import type { AiGradingResult } from "@/lib/ai-grading/types";
import { SPEAKING_CRITERIA, WRITING_CRITERIA } from "@/lib/writing-review";

// Dữ liệu chép vào ReviewForm khi thầy bấm "Điền từ bản nháp AI".
export type AiReviewSuggestion = {
  // unitId → (key tiêu chí → band dạng chuỗi, đúng kiểu state của ReviewForm).
  scores: Record<string, Record<string, string>>;
  summary: string;
  detailed: string;
};

const LABELS = new Map([...WRITING_CRITERIA, ...SPEAKING_CRITERIA].map((c) => [c.key, c.label]));

export function aiSuggestionForReview(result: AiGradingResult): AiReviewSuggestion {
  const multi = result.tasks.length > 1;
  const scores: AiReviewSuggestion["scores"] = {};
  const detailedBlocks: string[] = [];

  for (const task of result.tasks) {
    const taskScores: Record<string, string> = {};
    const lines: string[] = [];

    for (const criterion of task.criteria) {
      if (criterion.band === null) continue;
      taskScores[criterion.key] = String(criterion.band);
      if (criterion.reason) {
        lines.push(`- ${LABELS.get(criterion.key) ?? criterion.key} (${criterion.band}): ${criterion.reason}`);
      }
    }
    scores[task.unitId] = taskScores;

    // Writing: lỗi đã thành ghi chú tại chỗ (nút Giữ). Speaking: không gắn được vào
    // URL audio nên chép danh sách lỗi vào nhận xét chi tiết.
    if (result.skill === "speaking" && task.errors.length > 0) {
      lines.push("", "Lỗi cần sửa:");
      for (const error of task.errors) {
        lines.push(`• "${error.quote}" → "${error.correction}": ${error.explanation}`);
      }
    }
    if (lines.length > 0) {
      detailedBlocks.push(multi ? `${task.label}\n${lines.join("\n")}` : lines.join("\n"));
    }
  }

  const summary = result.tasks
    .filter((task) => task.summary)
    .map((task) => (multi ? `${task.label}: ${task.summary}` : task.summary))
    .join("\n\n");

  return { scores, summary, detailed: detailedBlocks.join("\n\n") };
}
