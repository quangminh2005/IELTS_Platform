import { prisma } from "@/lib/prisma";
import { PRACTICE_MODE } from "@/lib/practice";
import { buildUnitHistory, type UnitHistory } from "@/lib/unit-history";

// Đọc lịch sử "ai đã làm phần nào" của mọi bài (giao + tự luyện) thuộc thầy này.
// Chỉ lấy id/trạng thái — không đụng content/câu trả lời nên rất nhẹ.
export async function loadUnitHistory(teacherId: string): Promise<UnitHistory> {
  const recipients = await prisma.assignmentRecipient.findMany({
    where: { assignment: { teacherId } },
    select: {
      studentId: true,
      status: true,
      assignment: {
        select: {
          mode: true,
          units: {
            select: { assignableUnit: { select: { id: true, skill: true } } }
          }
        }
      },
      attempts: {
        select: {
          submittedAt: true,
          skills: { where: { status: "submitted" }, select: { skill: true } }
        }
      }
    }
  });

  return buildUnitHistory(
    recipients.map((recipient) => ({
      studentId: recipient.studentId,
      recipientStatus: recipient.status,
      isPractice: recipient.assignment.mode === PRACTICE_MODE,
      units: recipient.assignment.units.map((link) => link.assignableUnit),
      submittedSkills: recipient.attempts.flatMap((attempt) =>
        attempt.skills.map((skill) => skill.skill)
      ),
      anyAttemptSubmitted: recipient.attempts.some((attempt) => attempt.submittedAt !== null)
    }))
  );
}
