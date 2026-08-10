import { notFound, redirect } from "next/navigation";
import { AttemptWorkspace } from "@/components/attempt-workspace";
import { ensureAttemptSkills, startAttempt } from "@/lib/actions/attempts";
import { auth } from "@/lib/auth";
import { examUnitsForStudent } from "@/lib/exam-payload";
import { detectMultiSelectGroups } from "@/lib/multi-select";
import { parseQuestionOptions } from "@/lib/question-interactions";
import { prisma } from "@/lib/prisma";

type AssignmentAttemptPageProps = {
  params: {
    recipientId: string;
  };
};

export default async function AssignmentAttemptPage({ params }: AssignmentAttemptPageProps) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "student") {
    redirect("/login");
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  });

  if (!student) {
    redirect("/waiting");
  }

  const existingRecipient = await prisma.assignmentRecipient.findFirst({
    where: {
      id: params.recipientId,
      studentId: student.id
    },
    select: { id: true }
  });

  if (!existingRecipient) {
    notFound();
  }

  const attempt = await startAttempt(params.recipientId);
  // Đảm bảo có đủ hàng AttemptSkill (một hàng mỗi kỹ năng) trước khi nạp để dựng
  // màn chọn kỹ năng + đồng hồ theo kỹ năng.
  await ensureAttemptSkills(attempt.id);
  // Đề bài và bài làm đã lưu không phụ thuộc nhau (đều chỉ cần attempt.id đã có ở
  // trên) — tải song song để bớt một lượt đi/về database ở đúng trang nặng nhất.
  const [recipient, savedAnswerRows] = await Promise.all([
    prisma.assignmentRecipient.findFirst({
      where: {
        id: params.recipientId,
        studentId: student.id
      },
      include: {
        assignment: {
          include: {
            units: {
              orderBy: { order: "asc" },
              include: {
                assignableUnit: {
                  include: {
                    questions: {
                      orderBy: { order: "asc" }
                    }
                  }
                }
              }
            }
          }
        },
        attempts: {
          where: { id: attempt.id },
          include: {
            highlights: {
              orderBy: { createdAt: "desc" }
            },
            skills: true
          }
        }
      }
    }),
    prisma.answer.findMany({
      where: { attemptId: attempt.id },
      select: { questionId: true, value: true }
    })
  ]);

  if (!recipient || !recipient.attempts[0]) {
    notFound();
  }

  const activeAttempt = recipient.attempts[0];

  if (activeAttempt.status === "submitted") {
    redirect(`/student/results/${activeAttempt.id}`);
  }

  const savedAnswers: Record<string, string> = {};
  savedAnswerRows.forEach((row) => {
    if (row.questionId) {
      savedAnswers[row.questionId] = row.value;
    }
  });

  // Nhận diện các nhóm "Choose N" để client gộp thành một khối tick nhiều ô.
  // Tính ở server (chỉ truyền id + số lượng, không lộ đáp án cho client).
  const multiSelectGroups = recipient.assignment.units.flatMap((unit) =>
    detectMultiSelectGroups(
      unit.assignableUnit.questions.map((question) => ({
        id: question.id,
        questionType: question.questionType,
        options: parseQuestionOptions(question.optionsJson),
        correctAnswers: parseQuestionOptions(question.correctAnswerJson)
      }))
    )
  );

  // Đáp án đúng/giải thích/dẫn chứng/transcript CHỈ được dùng ở server (ngay phía
  // trên để dò nhóm "Choose N", và lúc chấm bài) — tuyệt đối không đi kèm xuống
  // client, vì Next serialize mọi prop của client component vào HTML trang.
  const examUnits = examUnitsForStudent(recipient.assignment.units);

  return (
    <AttemptWorkspace
      recipientId={recipient.id}
      attempt={activeAttempt}
      assignment={{
        title: recipient.assignment.title,
        instructions: recipient.assignment.instructions,
        timeLimitMinutes: recipient.assignment.timeLimitMinutes,
        skillTimeLimitsJson: recipient.assignment.skillTimeLimitsJson,
        lockAudio: recipient.assignment.lockAudio,
        units: examUnits
      }}
      highlights={activeAttempt.highlights}
      savedAnswers={savedAnswers}
      multiSelectGroups={multiSelectGroups}
      attemptSkills={activeAttempt.skills}
    />
  );
}
