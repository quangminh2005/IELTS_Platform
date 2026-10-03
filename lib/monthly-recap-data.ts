import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { MANUAL_QUESTION_TYPES } from "@/lib/manual-grading";
import { dateKeyToUtcDate } from "@/lib/vocab-daily";
import {
  buildMonthlyRecap,
  monthKeyOf,
  monthRange,
  recapMonthToShow,
  shiftMonthKey,
  studentRecapView,
  type MonthlyRecap,
  type RecapStudentInfo,
  type RecapSubmitRow,
  type RecapUnitRow,
  type StudentRecapView
} from "@/lib/monthly-recap";

// Đọc dữ liệu Tổng kết tháng cho CẢ TRƯỜNG. Không có bảng riêng: suy ra từ giờ
// nộp từng kỹ năng, kết quả chấm từng câu và ngày ôn Sổ từ.
// Export để script hồi tố Xu (chạy ngoài Next, không dùng được unstable_cache) gọi thẳng.
export async function loadMonthlyRecap(monthKey: string): Promise<MonthlyRecap> {
  const { start, end } = monthRange(monthKey);

  const [skillRows, legacyAttempts, vocabRows] = await Promise.all([
    prisma.attemptSkill.findMany({
      where: { submittedAt: { gte: start, lt: end } },
      select: {
        attemptId: true,
        skill: true,
        submittedAt: true,
        attempt: { select: { studentId: true, attemptRound: true } }
      }
    }),
    // Bài nộp cũ không có giờ nộp từng kỹ năng → mọi phần lấy giờ nộp cả bài
    // (cùng quy ước với lib/activity-heatmap-data.ts).
    prisma.attempt.findMany({
      where: {
        submittedAt: { gte: start, lt: end },
        skills: { none: { submittedAt: { not: null } } }
      },
      select: { id: true, studentId: true, attemptRound: true, submittedAt: true }
    }),
    prisma.vocabQuizDay.findMany({
      where: {
        date: {
          gte: dateKeyToUtcDate(`${monthKey}-01`),
          lt: dateKeyToUtcDate(`${shiftMonthKey(monthKey, 1)}-01`)
        }
      },
      select: { studentId: true, date: true, total: true }
    })
  ]);

  type Submit = { studentId: string; attemptRound: number; submittedAt: Date };
  // Khoá "attemptId:skill" → giờ nộp kỹ năng đó trong tháng.
  const skillSubmits = new Map<string, Submit>();
  const legacySubmits = new Map<string, Submit>();
  const submits: RecapSubmitRow[] = [];

  for (const row of skillRows) {
    if (!row.submittedAt) continue;
    const submit = {
      studentId: row.attempt.studentId,
      attemptRound: row.attempt.attemptRound,
      submittedAt: row.submittedAt
    };
    skillSubmits.set(`${row.attemptId}:${row.skill}`, submit);
    submits.push(submit);
  }

  for (const row of legacyAttempts) {
    if (!row.submittedAt) continue;
    const submit = { studentId: row.studentId, attemptRound: row.attemptRound, submittedAt: row.submittedAt };
    legacySubmits.set(row.id, submit);
    submits.push(submit);
  }

  const attemptIds = Array.from(
    new Set([...skillRows.map((row) => row.attemptId), ...legacyAttempts.map((row) => row.id)])
  );

  const [gradedGroups, manualGroups] = attemptIds.length
    ? await Promise.all([
        // Câu tự chấm đã có kết quả — đếm đúng/sai theo từng phần, không tải value.
        prisma.answer.groupBy({
          by: ["attemptId", "assignableUnitId", "isCorrect"],
          where: {
            attemptId: { in: attemptIds },
            isCorrect: { not: null },
            question: { questionType: { notIn: [...MANUAL_QUESTION_TYPES] } }
          },
          _count: { _all: true }
        }),
        // Câu chấm tay (Writing task / Speaking) có bài làm.
        prisma.answer.groupBy({
          by: ["attemptId", "assignableUnitId"],
          where: {
            attemptId: { in: attemptIds },
            value: { not: "" },
            question: { questionType: { in: [...MANUAL_QUESTION_TYPES] } }
          },
          _count: { _all: true }
        })
      ])
    : [[], []];

  type UnitCounts = { attemptId: string; unitId: string; graded: number; correct: number; manual: boolean };
  const unitCounts = new Map<string, UnitCounts>();

  function countsOf(attemptId: string, unitId: string): UnitCounts {
    const key = `${attemptId}:${unitId}`;
    let row = unitCounts.get(key);
    if (!row) {
      row = { attemptId, unitId, graded: 0, correct: 0, manual: false };
      unitCounts.set(key, row);
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

  const unitIds = Array.from(new Set(Array.from(unitCounts.values(), (row) => row.unitId)));
  const unitSkills = new Map(
    (unitIds.length
      ? await prisma.assignableUnit.findMany({
          where: { id: { in: unitIds } },
          select: { id: true, skill: true }
        })
      : []
    ).map((unit) => [unit.id, unit.skill])
  );

  const units: RecapUnitRow[] = [];
  unitCounts.forEach((row) => {
    const skill = unitSkills.get(row.unitId);
    if (!skill) return;
    // Kỹ năng chưa nộp (câu nháp) hoặc nộp ở tháng khác → không có trong map.
    const submit = skillSubmits.get(`${row.attemptId}:${skill}`) ?? legacySubmits.get(row.attemptId);
    if (!submit) return;
    units.push({
      studentId: submit.studentId,
      skill,
      submittedAt: submit.submittedAt,
      attemptRound: submit.attemptRound,
      gradedCount: row.graded,
      correctCount: row.correct,
      manualAnswered: row.manual
    });
  });

  const vocab = vocabRows.map((row) => ({
    studentId: row.studentId,
    // VocabQuizDay.date lưu nửa đêm UTC của ngày VN → cắt chuỗi là ra khoá ngày.
    date: row.date.toISOString().slice(0, 10),
    total: row.total
  }));

  const studentIds = Array.from(
    new Set([...submits.map((row) => row.studentId), ...vocab.map((row) => row.studentId)])
  );
  const students: RecapStudentInfo[] = studentIds.length
    ? (
        await prisma.studentProfile.findMany({
          where: { id: { in: studentIds } },
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            avatarPreset: true,
            equippedFrame: true,
            user: { select: { image: true } }
          }
        })
      ).map((student) => ({
        id: student.id,
        displayName: student.displayName,
        avatarUrl: student.avatarUrl,
        avatarPreset: student.avatarPreset,
        userImage: student.user?.image ?? null,
        equippedFrame: student.equippedFrame
      }))
    : [];

  return buildMonthlyRecap({ monthKey, units, submits, vocab, students });
}

// Tháng đã kết thúc gần như không đổi → cache 1 ngày cho nhẹ Neon. v2: thêm khung
// avatar (Xu & Cửa hàng) — HS đổi khung thì bảng tháng cũ có thể trễ tới 1 ngày.
const loadClosedMonthRecap = unstable_cache(loadMonthlyRecap, ["monthly-recap-v2"], {
  revalidate: 86400
});

export async function getMonthlyRecap(monthKey: string, now = new Date()): Promise<MonthlyRecap> {
  return monthKey < monthKeyOf(now) ? loadClosedMonthRecap(monthKey) : loadMonthlyRecap(monthKey);
}

export async function getStudentRecap(
  studentId: string,
  monthKey: string,
  now = new Date()
): Promise<{ recap: MonthlyRecap; view: StudentRecapView }> {
  const [recap, previous] = await Promise.all([
    getMonthlyRecap(monthKey, now),
    getMonthlyRecap(shiftMonthKey(monthKey, -1), now)
  ]);

  return { recap, view: studentRecapView(recap, studentId, previous) };
}

// Popup ở trang chủ: chỉ 7 ngày đầu tháng, chỉ khi tháng trước học viên có học.
// Lỗi ở đây KHÔNG được làm hỏng trang chủ → nuốt lỗi, bỏ popup.
export async function getStudentRecapPopup(
  studentId: string,
  now = new Date()
): Promise<{ recap: MonthlyRecap; view: StudentRecapView } | null> {
  const monthKey = recapMonthToShow(now);
  if (!monthKey) return null;

  try {
    const result = await getStudentRecap(studentId, monthKey, now);
    return result.view.entry ? result : null;
  } catch (error) {
    console.error("[monthly-recap] không tính được tổng kết tháng", error);
    return null;
  }
}
