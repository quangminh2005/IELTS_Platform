"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudent } from "@/lib/actions/attempts";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import { vietnamDateKey } from "@/lib/vocab-day";
import { dateKeyToUtcDate } from "@/lib/vocab-daily";

const submitSchema = z.object({
  answers: z
    .array(
      z.object({
        wordId: z.string().min(1),
        chosen: z.string().min(1)
      })
    )
    .min(1)
    .max(20)
});

export async function submitVocabQuiz(formData: FormData): Promise<ActionResult> {
  try {
    const student = await requireStudent();
    const parsed = submitSchema.parse(
      JSON.parse(String(formData.get("answersJson") ?? "{}"))
    );

    // Không tin điểm client gửi lên — chấm lại bằng nghĩa lưu trong DB.
    const words = await prisma.vocabWord.findMany({
      where: { id: { in: parsed.answers.map((item) => item.wordId) } },
      select: { id: true, meaningVi: true }
    });

    const meanings = new Map(words.map((word) => [word.id, word.meaningVi]));
    let correct = 0;

    for (const answer of parsed.answers) {
      const expected = meanings.get(answer.wordId);

      if (!expected) {
        continue;
      }

      const isCorrect = expected === answer.chosen;

      if (isCorrect) {
        correct += 1;
      }

      await prisma.vocabProgress.upsert({
        where: {
          studentId_wordId: { studentId: student.id, wordId: answer.wordId }
        },
        update: {
          correctCount: { increment: isCorrect ? 1 : 0 },
          wrongCount: { increment: isCorrect ? 0 : 1 },
          lastAnswerAt: new Date()
        },
        create: {
          studentId: student.id,
          wordId: answer.wordId,
          correctCount: isCorrect ? 1 : 0,
          wrongCount: isCorrect ? 0 : 1,
          lastAnswerAt: new Date()
        }
      });
    }

    const total = parsed.answers.length;
    const date = dateKeyToUtcDate(vietnamDateKey(new Date()));

    const existing = await prisma.vocabQuizDay.findUnique({
      where: { studentId_date: { studentId: student.id, date } },
      select: { correct: true }
    });

    // Làm lại thoải mái, nhưng chỉ giữ kết quả TỐT NHẤT trong ngày.
    if (!existing) {
      await prisma.vocabQuizDay.create({
        data: { studentId: student.id, date, correct, total }
      });
    } else if (correct > existing.correct) {
      await prisma.vocabQuizDay.update({
        where: { studentId_date: { studentId: student.id, date } },
        data: { correct, total }
      });
    }

    revalidatePath("/student");
    revalidatePath("/student/vocab");

    return actionOk(`Bạn đúng ${correct}/${total} câu.`);
  } catch (error) {
    return actionFail(error, "Nộp bài từ vựng");
  }
}
