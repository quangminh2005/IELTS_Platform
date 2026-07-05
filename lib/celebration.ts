import { SKILL_ORDER } from "@/lib/skills";

export type CelebrationTier = "manual" | "encourage" | "good" | "great";

export type CelebrationInput = {
  scorePercent: number | null;
  isManualOnly: boolean;
  dominantSkill: string | null;
};

export type Celebration = {
  tier: CelebrationTier;
  title: string;
  message: string;
  confetti: "none" | "small" | "medium" | "big";
};

// Danh hiệu vui khi đạt điểm cao, theo kỹ năng chiếm ưu thế của bài.
const GREAT_TITLES: Record<string, string> = {
  listening: "Cao thủ Listening",
  reading: "Kẻ hủy diệt Reading",
  writing: "Bậc thầy Writing",
  speaking: "Ngôi sao Speaking",
};

// Quyết định nội dung + độ mạnh pháo hoa của pop-up chúc mừng.
// LUÔN có pháo hoa (owner chọn "luôn bắn, cường độ theo điểm"): nhẹ khi điểm
// thấp / bài chấm tay, mạnh dần khi điểm cao.
export function getCelebration(input: CelebrationInput): Celebration {
  if (input.isManualOnly || input.scorePercent === null) {
    return {
      tier: "manual",
      title: "Đã nộp bài!",
      message: "Bài của bạn đang chờ giáo viên chấm.",
      confetti: "small",
    };
  }

  if (input.scorePercent < 50) {
    return {
      tier: "encourage",
      title: "Đã nộp!",
      message: "Lần sau bùng nổ hơn nhé 💪",
      confetti: "small",
    };
  }

  if (input.scorePercent < 80) {
    return {
      tier: "good",
      title: "Làm tốt lắm!",
      message: "Bạn đang tiến bộ đấy, giữ phong độ nhé!",
      confetti: "medium",
    };
  }

  const title =
    (input.dominantSkill && GREAT_TITLES[input.dominantSkill]) || "Xuất sắc!";

  return {
    tier: "great",
    title,
    message: "Điểm số bùng nổ! Tiếp tục phát huy nhé 🎉",
    confetti: "big",
  };
}

// Kỹ năng xuất hiện nhiều nhất trong danh sách (một phần tử / câu đã chấm tự động).
// Hòa -> ưu tiên theo SKILL_ORDER. Rỗng -> null.
export function pickDominantSkill(skills: string[]): string | null {
  const counts = new Map<string, number>();
  for (const skill of skills) {
    counts.set(skill, (counts.get(skill) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const skill of SKILL_ORDER) {
    const count = counts.get(skill) ?? 0;
    if (count > bestCount) {
      best = skill;
      bestCount = count;
    }
  }

  return best;
}
