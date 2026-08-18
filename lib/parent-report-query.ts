import { prisma } from "@/lib/prisma";
import type { ParentReportItem } from "@/lib/parent-report";
import type { AttemptForSeries, StatAnswer } from "@/lib/question-stats";
import { countsForStats, excludePracticeAssignment } from "@/lib/practice";

// CỬA DUY NHẤT đọc DB cho tính năng báo cáo phụ huynh.
//
// QUY TẮC KHÔNG ĐƯỢC PHÁ: không select Question.content, Question.correctAnswerJson,
// Answer.value, AssignableUnit.content/transcript, AnswerAnnotation. Phụ huynh chỉ
// được thấy điểm số và nhận xét — link bị chuyển cho người ngoài cũng không lộ đề.

export type ParentStudent = {
  id: string;
  displayName: string;
  targetBand: number | null;
  className: string | null;
};

export async function findStudentByParentToken(token: string): Promise<ParentStudent | null> {
  if (!token.trim()) {
    return null;
  }

  const student = await prisma.studentProfile.findUnique({
    where: { parentToken: token },
    select: {
      id: true,
      displayName: true,
      targetBand: true,
      parentEmail: true,
      classes: {
        select: { class: { select: { name: true } } },
        orderBy: { joinedAt: "desc" },
        take: 1
      }
    }
  });

  // Xoá email phụ huynh = tắt báo cáo, link cũng ngưng hoạt động luôn.
  if (!student || !student.parentEmail?.trim()) {
    return null;
  }

  return {
    id: student.id,
    displayName: student.displayName,
    targetBand: student.targetBand,
    className: student.classes[0]?.class.name ?? null
  };
}

export async function loadParentReportItems(studentId: string): Promise<ParentReportItem[]> {
  const recipients = await prisma.assignmentRecipient.findMany({
    where: {
      studentId,
      assignment: excludePracticeAssignment
    },
    select: {
      status: true,
      assignedAt: true,
      submittedAt: true,
      assignment: {
        select: {
          title: true,
          deadline: true,
          units: {
            select: { assignableUnit: { select: { skill: true } } }
          }
        }
      },
      attempts: {
        where: countsForStats,
        select: {
          scorePercent: true,
          submittedAt: true,
          review: {
            select: {
              overallBand: true,
              summaryFeedback: true,
              reviewedAt: true
            }
          }
        },
        orderBy: { startedAt: "desc" },
        take: 1
      }
    },
    orderBy: { assignedAt: "desc" }
  });

  return recipients.map((recipient) => {
    const attempt = recipient.attempts[0] ?? null;

    return {
      assignmentTitle: recipient.assignment.title,
      skills: recipient.assignment.units.map((unit) => unit.assignableUnit.skill),
      assignedAt: recipient.assignedAt,
      deadline: recipient.assignment.deadline,
      status: recipient.status,
      submittedAt: recipient.submittedAt ?? attempt?.submittedAt ?? null,
      scorePercent: attempt?.scorePercent ?? null,
      overallBand: attempt?.review?.overallBand ?? null,
      reviewedAt: attempt?.review?.reviewedAt ?? null,
      summaryFeedback: attempt?.review?.summaryFeedback ?? null
    };
  });
}

export async function loadParentStatsData(studentId: string): Promise<{
  series: AttemptForSeries[];
  answers: StatAnswer[];
}> {
  // Cùng bộ lọc với trang "Tiến bộ" của học viên: chỉ bài đã nộp, chỉ lượt đầu.
  const attempts = await prisma.attempt.findMany({
    where: {
      studentId,
      status: { in: ["submitted", "reviewed"] },
      ...countsForStats
    },
    select: {
      submittedAt: true,
      startedAt: true,
      assignmentRecipient: {
        select: { assignment: { select: { title: true } } }
      },
      answers: {
        select: {
          isCorrect: true,
          assignableUnit: { select: { skill: true } },
          question: { select: { questionType: true } }
        }
      }
    }
  });

  const series: AttemptForSeries[] = attempts.map((attempt) => ({
    title: attempt.assignmentRecipient.assignment.title,
    submittedAt: attempt.submittedAt ?? attempt.startedAt,
    answers: attempt.answers.map((answer) => ({
      isCorrect: answer.isCorrect,
      skill: answer.assignableUnit.skill
    }))
  }));

  const answers: StatAnswer[] = attempts.flatMap((attempt) =>
    attempt.answers.map((answer) => ({
      isCorrect: answer.isCorrect,
      skill: answer.assignableUnit.skill,
      questionType: answer.question?.questionType ?? null
    }))
  );

  return { series, answers };
}
