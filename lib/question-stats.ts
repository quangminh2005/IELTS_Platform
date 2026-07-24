// Thống kê tiến bộ & điểm yếu theo dạng câu — logic thuần, dùng chung cho
// trang "Tiến bộ" của học sinh và khu vực giáo viên. Không truy cập DB nên
// import được ở cả server lẫn client component.

// ===== Nhóm dạng câu =====

// 5 nhóm hiển thị. Thứ tự trong mảng = thứ tự hiển thị trên giao diện.
export const QUESTION_GROUPS = [
  { key: "multiple_choice", label: "Trắc nghiệm" },
  { key: "true_false", label: "True/False/Not Given" },
  { key: "matching", label: "Nối (matching)" },
  { key: "completion", label: "Điền từ" },
  { key: "short_answer", label: "Trả lời ngắn" }
] as const;

export type QuestionGroupKey = (typeof QUESTION_GROUPS)[number]["key"];

// Map dạng câu kỹ thuật -> nhóm hiển thị. writing_task/speaking_task chấm tay
// (isCorrect = null) nên không có nhóm. Khi thêm questionType mới vào
// lib/actions/materials.ts PHẢI bổ sung tại đây — tests/question-stats.test.ts
// đọc thẳng nguồn materials.ts để ép điều này.
const TYPE_TO_GROUP: Record<string, QuestionGroupKey> = {
  multiple_choice: "multiple_choice",
  true_false_not_given: "true_false",
  matching: "matching",
  drag_drop_matching: "matching",
  gap_fill: "completion",
  inline_gap_fill: "completion",
  note_completion: "completion",
  table_completion: "completion",
  short_answer: "short_answer"
};

export function groupForQuestionType(questionType: string): QuestionGroupKey | null {
  return TYPE_TO_GROUP[questionType] ?? null;
}

// ===== Tỷ lệ đúng theo nhóm =====

// Ngưỡng dữ liệu: dưới 5 câu -> hiển thị mờ "chưa đủ dữ liệu";
// nhóm yếu nhất chỉ chọn trong các nhóm có >= 10 câu.
export const LOW_DATA_THRESHOLD = 5;
export const WEAKEST_MIN_ANSWERS = 10;

export type StatAnswer = {
  isCorrect: boolean | null;
  skill: string;
  // null khi câu gốc đã bị xóa (re-import tài liệu) -> bỏ qua ở thống kê nhóm.
  questionType: string | null;
};

export type GroupStat = {
  key: QuestionGroupKey;
  label: string;
  correct: number;
  total: number;
  percent: number; // 0-100, làm tròn; total = 0 -> 0
};

export type SkillFilter = "all" | "listening" | "reading";

export type TypeStatsBySkill = Record<SkillFilter, GroupStat[]>;

function statsForFilter(answers: StatAnswer[], filter: SkillFilter): GroupStat[] {
  const tally = new Map<QuestionGroupKey, { correct: number; total: number }>();

  for (const answer of answers) {
    if (answer.isCorrect === null) continue;
    if (filter !== "all" && answer.skill !== filter) continue;
    const group = answer.questionType ? groupForQuestionType(answer.questionType) : null;
    if (!group) continue;
    const row = tally.get(group) ?? { correct: 0, total: 0 };
    row.total += 1;
    if (answer.isCorrect) row.correct += 1;
    tally.set(group, row);
  }

  return QUESTION_GROUPS.map(({ key, label }) => {
    const row = tally.get(key) ?? { correct: 0, total: 0 };
    return {
      key,
      label,
      correct: row.correct,
      total: row.total,
      percent: row.total === 0 ? 0 : Math.round((row.correct / row.total) * 100)
    };
  });
}

export function questionTypeStatsBySkill(answers: StatAnswer[]): TypeStatsBySkill {
  return {
    all: statsForFilter(answers, "all"),
    listening: statsForFilter(answers, "listening"),
    reading: statsForFilter(answers, "reading")
  };
}

// Nhóm yếu nhất: % thấp nhất trong các nhóm đủ dữ liệu (>= WEAKEST_MIN_ANSWERS).
// Hòa % -> chọn nhóm nhiều câu hơn. Không nhóm nào đủ -> null.
export function weakestGroup(stats: GroupStat[]): GroupStat | null {
  let weakest: GroupStat | null = null;

  for (const stat of stats) {
    if (stat.total < WEAKEST_MIN_ANSWERS) continue;
    if (
      weakest === null ||
      stat.percent < weakest.percent ||
      (stat.percent === weakest.percent && stat.total > weakest.total)
    ) {
      weakest = stat;
    }
  }

  return weakest;
}
