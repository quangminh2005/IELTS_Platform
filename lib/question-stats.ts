import { bandsBySkill } from "@/lib/band-score";
import { parseCorrectAnswers } from "@/lib/attempt-grading";

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

// ===== Chuỗi điểm cho biểu đồ tiến bộ =====

export const MAX_POINTS_PER_SKILL = 20;

export type AttemptForSeries = {
  title: string;
  submittedAt: Date;
  answers: Array<{ isCorrect: boolean | null; skill: string }>;
};

export type SeriesPoint = {
  timeMs: number;
  dateLabel: string; // vd "24/7" — dùng cho tooltip & nhãn trục
  label: string; // tên bài giao
  percent: number;
  correct: number;
  total: number;
  band: number | null; // chỉ khác null với bài đủ 40 câu (bandScore)
};

export type ProgressSeries = {
  listening: SeriesPoint[];
  reading: SeriesPoint[];
};

const DATE_LABEL = new Intl.DateTimeFormat("vi-VN", {
  day: "numeric",
  month: "numeric",
  timeZone: "Asia/Ho_Chi_Minh"
});

// attempts: đã lọc submitted/reviewed từ phía truy vấn. Mỗi kỹ năng lấy tối đa
// MAX_POINTS_PER_SKILL bài gần nhất, trả về theo thứ tự thời gian tăng dần.
export function buildProgressSeries(attempts: AttemptForSeries[]): ProgressSeries {
  const sorted = [...attempts].sort(
    (a, b) => a.submittedAt.getTime() - b.submittedAt.getTime()
  );
  const series: ProgressSeries = { listening: [], reading: [] };

  for (const attempt of sorted) {
    for (const row of bandsBySkill(attempt.answers)) {
      if (row.total === 0) continue;
      if (row.skill !== "listening" && row.skill !== "reading") continue;
      series[row.skill].push({
        timeMs: attempt.submittedAt.getTime(),
        dateLabel: DATE_LABEL.format(attempt.submittedAt),
        label: attempt.title,
        percent: Math.round((row.correct / row.total) * 100),
        correct: row.correct,
        total: row.total,
        band: row.band
      });
    }
  }

  return {
    listening: series.listening.slice(-MAX_POINTS_PER_SKILL),
    reading: series.reading.slice(-MAX_POINTS_PER_SKILL)
  };
}

// ===== Đáp án sai phổ biến (khu vực giáo viên) =====

export type WrongAnswerCount = {
  value: string; // "" = bỏ trống (phía hiển thị tự thay nhãn)
  count: number;
};

// Gộp các giá trị sai giống nhau (trim + không phân biệt hoa thường, lấy bản
// đầu tiên gặp làm nhãn hiển thị), xếp giảm dần theo số lần, cắt top `limit`.
export function tallyWrongAnswers(values: string[], limit = 3): WrongAnswerCount[] {
  const counts = new Map<string, WrongAnswerCount>();

  for (const raw of values) {
    const display = raw.trim();
    const key = display.toLowerCase();
    const row = counts.get(key);
    if (row) {
      row.count += 1;
    } else {
      counts.set(key, { value: display, count: 1 });
    }
  }

  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

// ===== Thống kê theo câu của một bài giao =====

export const TOP_MISSED_LIMIT = 5;

export type QuestionMissStat = {
  questionId: string;
  order: number;
  prompt: string;
  correctAnswer: string | null;
  wrongCount: number;
  totalCount: number; // số học sinh đã nộp
  percentWrong: number;
  wrongValues: WrongAnswerCount[];
};

export type UnitQuestionStats = {
  unitId: string;
  unitTitle: string;
  skill: string;
  manual: boolean; // Viết/Nói -> chấm tay, không có bảng câu
  questions: QuestionMissStat[];
};

export type AssignmentStats = {
  units: UnitQuestionStats[];
  top: QuestionMissStat[];
};

type UnitInput = {
  id: string;
  title: string;
  skill: string;
  questions: Array<{
    id: string;
    order: number;
    prompt: string;
    correctAnswerJson: string | null;
  }>;
};

type AnswerInput = {
  questionId: string | null;
  isCorrect: boolean | null;
  value: string;
  correctAnswerSnapshot: string | null;
};

// units: câu hỏi lấy từ ĐỀ GỐC (không phải từ bài nộp) — câu chưa ai trả lời
// vẫn có dòng "0/N sai". answers: gộp từ mọi attempt đã nộp của bài giao.
export function assignmentQuestionStats(
  units: UnitInput[],
  answers: AnswerInput[],
  submittedCount: number
): AssignmentStats {
  const byQuestion = new Map<string, AnswerInput[]>();
  for (const answer of answers) {
    if (!answer.questionId) continue;
    const list = byQuestion.get(answer.questionId) ?? [];
    list.push(answer);
    byQuestion.set(answer.questionId, list);
  }

  const unitStats: UnitQuestionStats[] = units.map((unit) => {
    const manual = unit.skill === "writing" || unit.skill === "speaking";
    const questions = manual
      ? []
      : unit.questions.map((question) => {
          const answered = byQuestion.get(question.id) ?? [];
          const wrong = answered.filter((a) => a.isCorrect === false);
          const correctAnswer =
            answered.find((a) => a.correctAnswerSnapshot)?.correctAnswerSnapshot ??
            (parseCorrectAnswers(question.correctAnswerJson).join(" | ") || null);

          return {
            questionId: question.id,
            order: question.order,
            prompt: question.prompt,
            correctAnswer,
            wrongCount: wrong.length,
            totalCount: submittedCount,
            percentWrong:
              submittedCount === 0
                ? 0
                : Math.round((wrong.length / submittedCount) * 100),
            wrongValues: tallyWrongAnswers(wrong.map((a) => a.value))
          };
        });

    return {
      unitId: unit.id,
      unitTitle: unit.title,
      skill: unit.skill,
      manual,
      questions
    };
  });

  const top = unitStats
    .flatMap((unit) => unit.questions)
    .filter((question) => question.wrongCount > 0)
    .sort((a, b) => b.percentWrong - a.percentWrong || b.wrongCount - a.wrongCount)
    .slice(0, TOP_MISSED_LIMIT);

  return { units: unitStats, top };
}
