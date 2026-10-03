import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { planUnitEntries, planVocabEntries, vocabKey, type CoinEntryDraft, type CoinUnitRow } from "@/lib/coins";
import { MANUAL_QUESTION_TYPES } from "@/lib/manual-grading";
import type { MonthlyRecap } from "@/lib/monthly-recap";
import { getMonthlyRecap } from "@/lib/monthly-recap-data";
import { PRACTICE_MODE } from "@/lib/practice";
import { achievementItemsFor, closedMonthKeys, type AchievementItem } from "@/lib/shop-catalog";
import { vietnamDateKey } from "@/lib/vocab-day";
import { dateKeyToUtcDate } from "@/lib/vocab-daily";

// Ví Xu: ĐỌC dữ liệu học → lập kế hoạch (lib/coins.ts, thuần) → GHI trong một
// transaction có khoá dòng học viên. Idempotent: chạy lại bao nhiêu lần cũng không
// cộng trùng nhờ @@unique([studentId, key]).

export type RecapLoader = (monthKey: string) => Promise<MonthlyRecap>;

// Khoá dòng StudentProfile tới hết transaction: hai thao tác ví song song của cùng
// một học viên (nộp bài + bấm Mua) chạy lần lượt, số dư không lệch, không âm.
export async function lockStudent(tx: Prisma.TransactionClient, studentId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "StudentProfile" WHERE "id" = ${studentId} FOR UPDATE`;
}

// Số dư luôn = tổng sổ. Gọi SAU khi đã ghi sổ, trong cùng transaction đã khoá.
export async function recomputeCoins(tx: Prisma.TransactionClient, studentId: string): Promise<number> {
  const sum = await tx.coinTransaction.aggregate({ where: { studentId }, _sum: { amount: true } });
  const coins = sum._sum.amount ?? 0;
  await tx.studentProfile.update({ where: { id: studentId }, data: { coins } });
  return coins;
}

async function loadUnitRows(studentId: string, attemptId?: string): Promise<CoinUnitRow[]> {
  const attempts = await prisma.attempt.findMany({
    where: { studentId, attemptRound: 1, ...(attemptId ? { id: attemptId } : {}) },
    select: {
      id: true,
      submittedAt: true,
      skills: { select: { skill: true, submittedAt: true } },
      assignmentRecipient: { select: { assignment: { select: { id: true, mode: true } } } }
    }
  });

  if (attempts.length === 0) return [];

  const attemptIds = attempts.map((attempt) => attempt.id);

  // Đếm đúng/sai theo phần, không tải value (cùng cách lib/monthly-recap-data.ts).
  const [gradedGroups, manualGroups] = await Promise.all([
    prisma.answer.groupBy({
      by: ["attemptId", "assignableUnitId", "isCorrect"],
      where: {
        attemptId: { in: attemptIds },
        isCorrect: { not: null },
        question: { questionType: { notIn: [...MANUAL_QUESTION_TYPES] } }
      },
      _count: { _all: true }
    }),
    prisma.answer.groupBy({
      by: ["attemptId", "assignableUnitId"],
      where: {
        attemptId: { in: attemptIds },
        value: { not: "" },
        question: { questionType: { in: [...MANUAL_QUESTION_TYPES] } }
      },
      _count: { _all: true }
    })
  ]);

  type Counts = { attemptId: string; unitId: string; graded: number; correct: number; manual: boolean };
  const counts = new Map<string, Counts>();

  function countsOf(attemptKey: string, unitId: string): Counts {
    const key = `${attemptKey}:${unitId}`;
    let row = counts.get(key);
    if (!row) {
      row = { attemptId: attemptKey, unitId, graded: 0, correct: 0, manual: false };
      counts.set(key, row);
    }
    return row;
  }

  for (const group of gradedGroups) {
    const row = countsOf(group.attemptId, group.assignableUnitId);
    row.graded += group._count._all;
    if (group.isCorrect) {
      row.correct += group._count._all;
    }
  }

  for (const group of manualGroups) {
    countsOf(group.attemptId, group.assignableUnitId).manual = true;
  }

  const unitIds = Array.from(new Set(Array.from(counts.values(), (row) => row.unitId)));
  const units = new Map(
    (
      await prisma.assignableUnit.findMany({
        where: { id: { in: unitIds } },
        select: { id: true, skill: true, title: true, material: { select: { title: true } } }
      })
    ).map((unit) => [unit.id, unit])
  );
  const attemptById = new Map(attempts.map((attempt) => [attempt.id, attempt]));

  const rows: CoinUnitRow[] = [];

  counts.forEach((row) => {
    const attempt = attemptById.get(row.attemptId);
    const unit = units.get(row.unitId);
    if (!attempt || !unit) return;

    // Giờ nộp của kỹ năng chứa phần này; Attempt cũ không có giờ từng kỹ năng thì
    // lấy giờ nộp cả bài (cùng quy ước lib/monthly-recap-data.ts).
    const hasSkillTimes = attempt.skills.some((skill) => skill.submittedAt);
    const submittedAt = hasSkillTimes
      ? attempt.skills.find((skill) => skill.skill === unit.skill)?.submittedAt ?? null
      : attempt.submittedAt;
    const assignment = attempt.assignmentRecipient.assignment;

    rows.push({
      attemptId: attempt.id,
      assignmentId: assignment.id,
      isPractice: assignment.mode === PRACTICE_MODE,
      unitId: unit.id,
      submittedAt,
      gradedCount: row.graded,
      correctCount: row.correct,
      manualAnswered: row.manual,
      note: `${unit.material.title} – ${unit.title}`
    });
  });

  return rows;
}

// Đồ thành tích của mọi tháng đã khép, cả trường. Script hồi tố gọi một lần rồi
// truyền vào syncWallet cho từng học viên (khỏi tính lại Tổng kết tháng mỗi người).
export async function loadAchievementItems(loadRecap: RecapLoader, now = new Date()): Promise<AchievementItem[]> {
  const recaps = await Promise.all(closedMonthKeys(now).map((monthKey) => loadRecap(monthKey)));
  return recaps.flatMap(achievementItemsFor);
}

async function applyWalletChanges(
  studentId: string,
  create: CoinEntryDraft[],
  raise: { key: string; amount: number }[],
  items: string[]
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await lockStudent(tx, studentId);

    if (create.length > 0) {
      await tx.coinTransaction.createMany({
        data: create.map((entry) => ({ ...entry, studentId })),
        skipDuplicates: true
      });
    }

    for (const entry of raise) {
      await tx.coinTransaction.updateMany({
        where: { studentId, key: entry.key, amount: { lt: entry.amount } },
        data: { amount: entry.amount }
      });
    }

    if (items.length > 0) {
      await tx.studentItem.createMany({
        data: items.map((itemKey) => ({ studentId, itemKey, source: "achievement" })),
        skipDuplicates: true
      });
    }

    await recomputeCoins(tx, studentId);
  });
}

// attemptId: chỉ quét một lượt (ngay sau khi nộp — nhanh). Không truyền: đồng bộ
// đầy đủ (bài, Sổ từ, đồ thành tích) — dùng ở trang Cửa hàng và script hồi tố.
export async function syncWallet(
  studentId: string,
  options: { attemptId?: string; achievements?: AchievementItem[]; now?: Date } = {}
): Promise<{ created: number; raised: number; items: number }> {
  const full = !options.attemptId;
  const now = options.now ?? new Date();

  const [existingRows, unitRows, vocabDays, ownedItems] = await Promise.all([
    prisma.coinTransaction.findMany({ where: { studentId }, select: { key: true, amount: true } }),
    loadUnitRows(studentId, options.attemptId),
    full
      ? prisma.vocabQuizDay.findMany({ where: { studentId }, select: { date: true, total: true } })
      : Promise.resolve([]),
    full
      ? prisma.studentItem.findMany({ where: { studentId }, select: { itemKey: true } })
      : Promise.resolve([])
  ]);

  const existingKeys = new Set(existingRows.map((row) => row.key));
  const create = planUnitEntries(unitRows, existingKeys);
  const vocabPlan = planVocabEntries(
    // VocabQuizDay.date lưu nửa đêm UTC của ngày VN → cắt chuỗi là ra khoá ngày.
    vocabDays.map((day) => ({ date: day.date.toISOString().slice(0, 10), total: day.total })),
    new Map(existingRows.map((row) => [row.key, row.amount]))
  );
  create.push(...vocabPlan.create);

  let items: string[] = [];

  if (full) {
    const achievements = options.achievements ?? (await loadAchievementItems(getMonthlyRecap, now));
    const owned = new Set(ownedItems.map((item) => item.itemKey));
    items = achievements
      .filter((item) => item.studentId === studentId && !owned.has(item.itemKey))
      .map((item) => item.itemKey);
  }

  if (create.length === 0 && vocabPlan.raise.length === 0 && items.length === 0) {
    return { created: 0, raised: 0, items: 0 };
  }

  await applyWalletChanges(studentId, create, vocabPlan.raise, items);
  return { created: create.length, raised: vocabPlan.raise.length, items: items.length };
}

// Gọi sau mỗi câu ôn thẻ: chỉ ngày hôm nay, rẻ.
export async function syncVocabToday(studentId: string, now = new Date()): Promise<void> {
  const today = vietnamDateKey(now);
  const key = vocabKey(today);

  const [day, existing] = await Promise.all([
    prisma.vocabQuizDay.findUnique({
      where: { studentId_date: { studentId, date: dateKeyToUtcDate(today) } },
      select: { total: true }
    }),
    prisma.coinTransaction.findUnique({
      where: { studentId_key: { studentId, key } },
      select: { amount: true }
    })
  ]);

  if (!day) return;

  const plan = planVocabEntries(
    [{ date: today, total: day.total }],
    new Map(existing ? [[key, existing.amount]] : [])
  );

  if (plan.create.length === 0 && plan.raise.length === 0) return;

  await applyWalletChanges(studentId, plan.create, plan.raise, []);
}
