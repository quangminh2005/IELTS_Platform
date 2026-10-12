import { VN_OFFSET_MS } from "@/lib/streak";
import { vietnamDateKey } from "@/lib/vocab-day";
import { shiftDateKey } from "@/lib/vocab-streak";

// Chỉ tiêu tự luyện hàng tuần (spec docs/superpowers/specs/2026-10-11-chi-tieu-tu-luyen-design.md).
// Module thuần: không import prisma. Phần đọc/ghi DB ở lib/practice-goal-data.ts.
//
// Tuần = thứ Hai 00:00 → Chủ nhật 23:59 giờ VN, khoá tuần = ngày thứ Hai "YYYY-MM-DD".
// Tuần trước PRACTICE_GOAL_START không tồn tại với mọi luật ở đây (không hồi tố).

export const PRACTICE_GOAL_START = "2026-10-12";
export const DEFAULT_PRACTICE_GOAL = 1;
export const MAX_PRACTICE_GOAL = 20;
export const PRACTICE_GOAL_REWARD = 30;
export const PRACTICE_GOAL_PENALTY = 30;
export const MIN_PART_SECONDS = 180;
export const MIN_WRITING_WORDS = 50;
export const MIN_ANSWERED_RATIO = 0.5;
// Số tuần xét cho thành phần "Tự luyện" của điểm xếp hạng.
export const RECENT_WEEKS = 4;

export function vnWeekKey(at: Date): string {
  const dayKey = vietnamDateKey(at);
  const weekday = new Date(`${dayKey}T00:00:00Z`).getUTCDay(); // 0 = CN
  return shiftDateKey(dayKey, -((weekday + 6) % 7));
}

// Mốc tuần kết thúc = thứ Hai tuần sau 00:00 giờ VN.
export function weekEndsAt(weekKey: string): Date {
  return new Date(Date.parse(`${shiftDateKey(weekKey, 7)}T00:00:00Z`) - VN_OFFSET_MS);
}

function dayMonth(key: string): string {
  const [, month, day] = key.split("-").map(Number);
  return `${day}/${month}`;
}

export function weekLabel(weekKey: string): string {
  return `${dayMonth(weekKey)}–${dayMonth(shiftDateKey(weekKey, 6))}`;
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// Một phần kỹ năng (AssignableUnit) trong một lượt tự luyện ĐÃ NỘP — mọi lượt, kể cả luyện lại.
export type PracticePart = {
  skill: string;
  submittedAt: Date; // giờ nộp kỹ năng chứa phần này
  seconds: number; // thời gian làm thực của phần
  questionCount: number;
  answeredCount: number; // câu có trả lời (Nói: có ghi âm)
  isEssay: boolean; // phần có câu writing_task → xét số từ
  writingWords: number;
};

export type PartVerdict = "ok" | "too_short" | "too_few_answers";

export function judgePart(part: PracticePart): PartVerdict {
  if (part.seconds < MIN_PART_SECONDS) return "too_short";

  if (part.isEssay && part.skill === "writing") {
    return part.writingWords >= MIN_WRITING_WORDS ? "ok" : "too_few_answers";
  }

  if (part.questionCount <= 0) return "too_few_answers";

  return part.answeredCount / part.questionCount >= MIN_ANSWERED_RATIO ? "ok" : "too_few_answers";
}

export type WeekStatus = {
  weekKey: string;
  done: number; // số phần đạt
  goal: number;
  met: boolean;
  ended: boolean; // tuần đã kết thúc tại `now`
  rejected: { too_short: number; too_few_answers: number };
};

// Mọi tuần từ PRACTICE_GOAL_START tới tuần chứa `now`, MỚI NHẤT TRƯỚC.
export function practiceWeeks(parts: PracticePart[], goal: number, now: Date): WeekStatus[] {
  const current = vnWeekKey(now);
  if (current < PRACTICE_GOAL_START) return [];

  const byWeek = new Map<string, WeekStatus>();
  for (let key = PRACTICE_GOAL_START; key <= current; key = shiftDateKey(key, 7)) {
    byWeek.set(key, {
      weekKey: key,
      done: 0,
      goal,
      met: false,
      ended: weekEndsAt(key).getTime() <= now.getTime(),
      rejected: { too_short: 0, too_few_answers: 0 }
    });
  }

  for (const part of parts) {
    if (part.submittedAt.getTime() > now.getTime()) continue;
    const week = byWeek.get(vnWeekKey(part.submittedAt));
    if (!week) continue;

    const verdict = judgePart(part);
    if (verdict === "ok") week.done += 1;
    else week.rejected[verdict] += 1;
  }

  const weeks = Array.from(byWeek.values());
  for (const week of weeks) week.met = week.done >= goal;

  return weeks.reverse();
}

export function recentWeeks(weeks: WeekStatus[]): WeekStatus[] {
  return weeks.slice(0, RECENT_WEEKS);
}

// Thành phần "Tự luyện" của điểm xếp hạng (0–100). Tuần đang chạy chỉ được xét khi đã
// đạt — chỉ cộng, không trừ giữa tuần. Không có tuần nào được xét → 100.
export function practiceGoalPercent(weeks: WeekStatus[], goal: number): number {
  if (goal <= 0) return 100;

  const considered = recentWeeks(weeks).filter((week) => week.ended || week.met);
  if (considered.length === 0) return 100;

  const met = considered.filter((week) => week.met).length;
  return Math.round((met / considered.length) * 100);
}

export function practiceGoalKey(weekKey: string): string {
  return `practice-goal:${weekKey}`;
}

export function practiceMissKey(weekKey: string): string {
  return `practice-miss:${weekKey}`;
}

export type GoalLedgerStep = {
  kind: "practice_goal" | "practice_miss";
  key: string;
  weekKey: string;
};

// Kế hoạch ghi sổ Xu, CŨ → MỚI (số tiền trừ phụ thuộc số dư lần lượt). Đã thưởng tuần nào
// thì không bao giờ trừ tuần đó; đã trừ thì không thưởng bù.
export function planPracticeGoalLedger(
  weeks: WeekStatus[],
  goal: number,
  existingKeys: Set<string>
): GoalLedgerStep[] {
  if (goal <= 0) return [];

  const steps: GoalLedgerStep[] = [];
  for (const week of [...weeks].reverse()) {
    const goalKey = practiceGoalKey(week.weekKey);
    const missKey = practiceMissKey(week.weekKey);
    if (existingKeys.has(goalKey) || existingKeys.has(missKey)) continue;

    if (week.met) steps.push({ kind: "practice_goal", key: goalKey, weekKey: week.weekKey });
    else if (week.ended) steps.push({ kind: "practice_miss", key: missKey, weekKey: week.weekKey });
  }
  return steps;
}

// Trừ tối đa PRACTICE_GOAL_PENALTY, không để số dư âm. Kết quả ≤ 0.
export function missAmount(balance: number): number {
  // "0 - x" thay vì "-x" để số dư 0 ra 0 chứ không ra -0.
  return 0 - Math.min(PRACTICE_GOAL_PENALTY, Math.max(0, balance));
}

