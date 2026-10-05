import { SPEAKING_CRITERIA, WRITING_CRITERIA } from "@/lib/writing-review";
import type { AiSkill } from "@/lib/ai-grading/types";

// AI chỉ đọc chữ (bài viết / bản phiên âm) nên không chấm được Pronunciation.
export const AI_UNSCORED_KEYS = ["pronunciation"];

// Key tiêu chí AI phải chấm, đúng thứ tự của phiếu chấm.
export function aiCriteriaKeys(skill: AiSkill): string[] {
  const criteria = skill === "speaking" ? SPEAKING_CRITERIA : WRITING_CRITERIA;
  return criteria.map((criterion) => criterion.key).filter((key) => !AI_UNSCORED_KEYS.includes(key));
}
