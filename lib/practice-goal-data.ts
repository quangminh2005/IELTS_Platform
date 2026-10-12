import { prisma } from "@/lib/prisma";
import { MANUAL_QUESTION_TYPES } from "@/lib/manual-grading";
import { onlyPracticeRecipient } from "@/lib/practice";
import {
  PRACTICE_GOAL_REWARD,
  PRACTICE_GOAL_START,
  countWords,
  missAmount,
  planPracticeGoalLedger,
  practiceGoalPercent,
  practiceWeeks,
  weekLabel,
  type PracticePart,
  type WeekStatus
} from "@/lib/practice-goal";
import { parsePartTimes } from "@/lib/skill-times";
import { lockStudent, recomputeCoins } from "@/lib/wallet";

// Đọc DB cho chỉ tiêu tự luyện. Luật nằm hết ở lib/practice-goal.ts.

const START_AT = new Date(`${PRACTICE_GOAL_START}T00:00:00+07:00`);

// Mọi phần tự luyện ĐÃ NỘP (mọi lượt) từ mốc áp dụng, gom theo học viên.
export async function loadPracticeParts(studentIds: string[]): Promise<Map<string, PracticePart[]>> {
  const result = new Map<string, PracticePart[]>(studentIds.map((id) => [id, []]));
  if (studentIds.length === 0) return result;

  const attempts = await prisma.attempt.findMany({
    where: {
      studentId: { in: studentIds },
      assignmentRecipient: onlyPracticeRecipient,
      skills: { some: { submittedAt: { gte: START_AT } } }
    },
    select: {
      id: true,
      studentId: true,
      partTimesJson: true,
      skills: { select: { skill: true, submittedAt: true, elapsedSeconds: true } }
    }
  });
  if (attempts.length === 0) return result;

  const attemptIds = attempts.map((attempt) => attempt.id);

  // Sau khi nộp, mỗi câu của phần có đúng một dòng Answer (submitSkill xoá rồi tạo lại đủ).
  const [allGroups, answeredGroups, essays] = await Promise.all([
    prisma.answer.groupBy({
      by: ["attemptId", "assignableUnitId"],
      where: { attemptId: { in: attemptIds } },
      _count: { _all: true }
    }),
    prisma.answer.groupBy({
      by: ["attemptId", "assignableUnitId"],
      where: { attemptId: { in: attemptIds }, value: { not: "" } },
      _count: { _all: true }
    }),
    prisma.answer.findMany({
      where: { attemptId: { in: attemptIds }, question: { questionType: "writing_task" } },
      select: { attemptId: true, assignableUnitId: true, value: true }
    })
  ]);

  const unitIds = Array.from(new Set(allGroups.map((group) => group.assignableUnitId)));
  const units = new Map(
    (
      await prisma.assignableUnit.findMany({
        where: { id: { in: unitIds } },
        select: {
          id: true,
          skill: true,
          questions: {
            where: { questionType: { in: [...MANUAL_QUESTION_TYPES] } },
            select: { id: true },
            take: 1
          }
        }
      })
    ).map((unit) => [unit.id, { skill: unit.skill, isEssay: unit.questions.length > 0 }])
  );

  const answered = new Map(
    answeredGroups.map((group) => [`${group.attemptId}:${group.assignableUnitId}`, group._count._all])
  );
  const words = new Map<string, number>();
  for (const essay of essays) {
    const key = `${essay.attemptId}:${essay.assignableUnitId}`;
    words.set(key, (words.get(key) ?? 0) + countWords(essay.value));
  }

  const attemptById = new Map(attempts.map((attempt) => [attempt.id, attempt]));
  // Số phần mỗi kỹ năng trong một lượt — chia đều thời gian khi thiếu partTimesJson.
  const unitsPerSkill = new Map<string, number>();
  for (const group of allGroups) {
    const unit = units.get(group.assignableUnitId);
    if (!unit) continue;
    const key = `${group.attemptId}:${unit.skill}`;
    unitsPerSkill.set(key, (unitsPerSkill.get(key) ?? 0) + 1);
  }

  for (const group of allGroups) {
    const attempt = attemptById.get(group.attemptId);
    const unit = units.get(group.assignableUnitId);
    if (!attempt || !unit) continue;

    const skill = attempt.skills.find((row) => row.skill === unit.skill);
    // Kỹ năng chưa nộp: dòng Answer chỉ là nháp tự lưu.
    if (!skill?.submittedAt || skill.submittedAt < START_AT) continue;

    const partTimes = parsePartTimes(attempt.partTimesJson);
    const share = unitsPerSkill.get(`${attempt.id}:${unit.skill}`) ?? 1;
    const seconds = partTimes[group.assignableUnitId] ?? Math.floor(skill.elapsedSeconds / share);
    const key = `${group.attemptId}:${group.assignableUnitId}`;

    result.get(attempt.studentId)?.push({
      skill: unit.skill,
      submittedAt: skill.submittedAt,
      seconds,
      questionCount: group._count._all,
      answeredCount: answered.get(key) ?? 0,
      isEssay: unit.isEssay,
      writingWords: words.get(key) ?? 0
    });
  }

  return result;
}

export type PracticeGoalStatus = {
  goal: number;
  weeks: WeekStatus[]; // mới nhất trước, từ PRACTICE_GOAL_START
  current: WeekStatus | null; // tuần đang chạy; null trước mốc áp dụng
  percent: number; // thành phần Tự luyện của điểm xếp hạng
};

export async function getPracticeGoalStatuses(
  students: Array<{ id: string; practiceWeeklyGoal: number }>,
  now = new Date()
): Promise<Map<string, PracticeGoalStatus>> {
  const parts = await loadPracticeParts(students.map((student) => student.id));
  return new Map(
    students.map((student) => {
      const goal = student.practiceWeeklyGoal;
      const weeks = practiceWeeks(parts.get(student.id) ?? [], goal, now);
      return [student.id, { goal, weeks, current: weeks[0] ?? null, percent: practiceGoalPercent(weeks, goal) }];
    })
  );
}

export async function getPracticeGoalStatus(studentId: string, now = new Date()): Promise<PracticeGoalStatus> {
  const student = await prisma.studentProfile.findUniqueOrThrow({
    where: { id: studentId },
    select: { id: true, practiceWeeklyGoal: true }
  });
  const statuses = await getPracticeGoalStatuses([student], now);
  return statuses.get(studentId)!;
}

// Ghi thưởng/trừ còn thiếu. Idempotent: khoá dòng + kiểm key trong transaction.
export async function syncPracticeGoal(studentId: string, now = new Date()): Promise<number> {
  const status = await getPracticeGoalStatus(studentId, now);
  if (status.goal <= 0 || status.weeks.length === 0) return 0;

  return prisma.$transaction(async (tx) => {
    await lockStudent(tx, studentId);
    const existing = await tx.coinTransaction.findMany({
      where: { studentId, kind: { in: ["practice_goal", "practice_miss"] } },
      select: { key: true }
    });
    const steps = planPracticeGoalLedger(status.weeks, status.goal, new Set(existing.map((row) => row.key)));
    if (steps.length === 0) return 0;

    let balance = (await tx.studentProfile.findUniqueOrThrow({ where: { id: studentId }, select: { coins: true } }))
      .coins;
    for (const step of steps) {
      const amount = step.kind === "practice_goal" ? PRACTICE_GOAL_REWARD : missAmount(balance);
      await tx.coinTransaction.create({
        data: {
          studentId,
          kind: step.kind,
          key: step.key,
          amount,
          note:
            step.kind === "practice_goal"
              ? `Đạt chỉ tiêu tự luyện tuần ${weekLabel(step.weekKey)}`
              : `Chưa đạt chỉ tiêu tự luyện tuần ${weekLabel(step.weekKey)}`
        }
      });
      balance = await recomputeCoins(tx, studentId);
    }
    return steps.length;
  });
}

// Cron trưa: mọi học viên có chỉ tiêu ≥ 1. Lỗi một em không chặn các em khác.
export async function syncAllPracticeGoals(now = new Date()): Promise<number> {
  const students = await prisma.studentProfile.findMany({
    where: { practiceWeeklyGoal: { gt: 0 } },
    select: { id: true }
  });
  let written = 0;
  for (const student of students) {
    try {
      written += await syncPracticeGoal(student.id, now);
    } catch (error) {
      console.error("[chi-tieu-tu-luyen] không ghi được sổ Xu", student.id, error);
    }
  }
  return written;
}
