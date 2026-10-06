// Kiểu dữ liệu của tính năng AI chấm Writing/Speaking
// (spec docs/superpowers/specs/2026-10-05-ai-cham-writing-speaking-design.md).
import type { FluencyStats } from "@/lib/speech-fluency";

export type AiRequester = "teacher" | "student";
export type AiReviewStatus = "pending" | "done" | "failed";
export type AiSkill = "writing" | "speaking";

export const AI_ERROR_CATEGORIES = [
  "grammar",
  "vocabulary",
  "spelling",
  "punctuation",
  "coherence"
] as const;
export type AiErrorCategory = (typeof AI_ERROR_CATEGORIES)[number];

export const AI_ERROR_CATEGORY_LABELS: Record<AiErrorCategory, string> = {
  grammar: "Ngữ pháp",
  vocabulary: "Từ vựng",
  spelling: "Chính tả",
  punctuation: "Dấu câu",
  coherence: "Mạch lạc"
};

export type AiCriterionScore = {
  key: string;
  // null = AI không chấm tiêu chí này (Pronunciation của Speaking).
  band: number | null;
  reason: string;
};

export type AiError = {
  // "<thứ tự task>-<thứ tự lỗi>", ổn định trong một lượt chấm (dùng cho nút Bỏ).
  id: string;
  answerId: string;
  // Nguyên văn trong bài làm / bản phiên âm.
  quote: string;
  correction: string;
  explanation: string;
  category: AiErrorCategory;
};

export type AiGradedTask = {
  // Writing: id của AssignableUnit; Speaking: "" (một bộ tiêu chí cho cả bài, khớp ReviewForm).
  unitId: string;
  label: string;
  taskNumber: 1 | 2 | null;
  criteria: AiCriterionScore[];
  summary: string;
  errors: AiError[];
};

export type AiGradingResult = {
  version: 1;
  skill: AiSkill;
  tasks: AiGradedTask[];
};

// ---- Đầu vào một lượt chấm ----

export type GradingAnswer = {
  answerId: string;
  // Mã ngắn gửi cho model ("A1", "A2"…) thay cho id thật.
  ref: string;
  questionPrompt: string | null;
  // Writing: bài viết; Speaking: bản phiên âm.
  text: string;
  // Speaking có mốc thời gian (lib/speech-fluency.ts): số đo độ trôi chảy và bản
  // phiên âm chèn "(pause Ns)" — CHỈ dùng trong prompt; "text" vẫn là chữ sạch để
  // đối chiếu đoạn trích lỗi.
  fluency?: FluencyStats;
  promptText?: string;
};

export type GradingTaskInput = {
  unitId: string;
  label: string;
  taskNumber: 1 | 2 | null;
  prompt: string;
  images: string[];
  minWords: number | null;
  answers: GradingAnswer[];
};

export type GradingInput = {
  skill: AiSkill;
  tasks: GradingTaskInput[];
};

// ---- Đầu ra thô của model (khớp lib/ai-grading/schema.ts) ----

export type ModelTaskOutput = {
  criteria: { key: string; band: number; reason: string }[];
  summary: string;
  errors: {
    answer_ref: string;
    quote: string;
    correction: string;
    explanation: string;
    category: string;
  }[];
};

export type ModelUsage = {
  // Tổng token đầu vào, ĐÃ GỒM phần cached (đúng cách OpenAI báo).
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
};
