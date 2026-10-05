import { aiCriteriaKeys } from "@/lib/ai-grading/criteria";
import { locateQuote } from "@/lib/ai-grading/locate";
import {
  AI_ERROR_CATEGORIES,
  type AiCriterionScore,
  type AiError,
  type AiErrorCategory,
  type AiGradedTask,
  type AiGradingResult,
  type AiSkill,
  type GradingTaskInput
} from "@/lib/ai-grading/types";
import { overallBandFromTasks, roundToHalfBand, WRITING_CRITERIA } from "@/lib/writing-review";

// Lỗi do model trả sai khuôn — thông điệp tiếng Việt hiện thẳng cho người dùng.
export class AiOutputError extends Error {}

const MAX_REASON = 600;
const MAX_SUMMARY = 1500;
const MAX_FIELD = 400;
const MAX_ERRORS = 40;

function clip(value: unknown, max: number): string {
  const text = String(value ?? "").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function isValidBand(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 9 &&
    Number.isInteger(value * 2)
  );
}

export function validateTaskOutput(
  raw: unknown,
  task: GradingTaskInput,
  skill: AiSkill,
  taskIndex: number
): AiGradedTask {
  if (!raw || typeof raw !== "object") {
    throw new AiOutputError("AI trả về dữ liệu không đúng khuôn.");
  }

  const output = raw as { criteria?: unknown; summary?: unknown; errors?: unknown };
  if (!Array.isArray(output.criteria)) {
    throw new AiOutputError("AI trả về thiếu phần chấm tiêu chí.");
  }

  const keys = aiCriteriaKeys(skill);
  const byKey = new Map<string, AiCriterionScore>();

  for (const item of output.criteria as { key?: unknown; band?: unknown; reason?: unknown }[]) {
    const key = String(item?.key ?? "");
    if (!keys.includes(key)) {
      throw new AiOutputError(`AI chấm một tiêu chí lạ: ${key || "(trống)"}.`);
    }
    if (byKey.has(key)) {
      throw new AiOutputError(`AI chấm trùng tiêu chí ${key}.`);
    }
    if (!isValidBand(item.band)) {
      throw new AiOutputError(`AI cho band không hợp lệ (${String(item.band)}) ở tiêu chí ${key}.`);
    }
    byKey.set(key, { key, band: item.band, reason: clip(item.reason, MAX_REASON) });
  }

  if (byKey.size !== keys.length) {
    throw new AiOutputError("AI chấm thiếu tiêu chí.");
  }

  const criteria = keys.map((key) => byKey.get(key)!);
  if (skill === "speaking") {
    criteria.push({
      key: "pronunciation",
      band: null,
      reason: "AI không nghe được giọng nên không chấm tiêu chí này."
    });
  }

  const answersByRef = new Map(task.answers.map((answer) => [answer.ref, answer]));
  const errors: AiError[] = [];
  const rawErrors = Array.isArray(output.errors) ? output.errors : [];

  for (const item of rawErrors.slice(0, MAX_ERRORS) as Record<string, unknown>[]) {
    const answer =
      answersByRef.get(String(item?.answer_ref ?? "")) ??
      (task.answers.length === 1 ? task.answers[0] : undefined);
    const quote = String(item?.quote ?? "").trim();

    // Đoạn trích không có trong bài = model bịa → bỏ lỗi đó, không hỏng cả lượt.
    if (!answer || !quote || !locateQuote(answer.text, quote)) continue;

    const category = (AI_ERROR_CATEGORIES as readonly string[]).includes(String(item.category))
      ? (item.category as AiErrorCategory)
      : "grammar";

    errors.push({
      id: `${taskIndex}-${errors.length}`,
      answerId: answer.answerId,
      quote: clip(quote, MAX_FIELD),
      correction: clip(item.correction, MAX_FIELD),
      explanation: clip(item.explanation, MAX_FIELD),
      category
    });
  }

  return {
    unitId: task.unitId,
    label: task.label,
    taskNumber: task.taskNumber,
    criteria,
    summary: clip(output.summary, MAX_SUMMARY),
    errors
  };
}

// Band một phần = trung bình các tiêu chí AI chấm được, làm tròn 0,5.
export function aiTaskBand(task: AiGradedTask): number | null {
  const bands = task.criteria
    .map((criterion) => criterion.band)
    .filter((band): band is number => band !== null);
  if (bands.length === 0) return null;
  return roundToHalfBand(bands.reduce((sum, band) => sum + band, 0) / bands.length);
}

// Band tổng: Writing dùng đúng công thức phiếu chấm (Task 1 : Task 2 = 1 : 2);
// Speaking là band của phần duy nhất (chưa có Pronunciation).
export function aiOverallBand(result: AiGradingResult): number | null {
  if (result.skill === "speaking") {
    return result.tasks[0] ? aiTaskBand(result.tasks[0]) : null;
  }

  const tasks = result.tasks.map((task) => ({
    unitId: task.unitId,
    label: task.label,
    taskNumber: task.taskNumber,
    scores: Object.fromEntries(
      task.criteria
        .filter((criterion) => criterion.band !== null)
        .map((criterion) => [criterion.key, criterion.band as number])
    )
  }));

  return overallBandFromTasks(tasks, WRITING_CRITERIA).band;
}

export function parseAiGradingResult(json: string | null | undefined): AiGradingResult | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as Partial<AiGradingResult>;
    if (
      parsed?.version !== 1 ||
      (parsed.skill !== "writing" && parsed.skill !== "speaking") ||
      !Array.isArray(parsed.tasks)
    ) {
      return null;
    }
    return parsed as AiGradingResult;
  } catch {
    return null;
  }
}
