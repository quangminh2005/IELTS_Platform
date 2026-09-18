"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudent } from "@/lib/actions/attempts";
import { requireTeacher } from "@/lib/actions/classes";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import { vietnamDateKey } from "@/lib/vocab-day";
import { dateKeyToUtcDate } from "@/lib/vocab-daily";
import { checkVocabAnswer, QUIZ_KINDS } from "@/lib/vocab-quiz";

const submitSchema = z.object({
  answers: z
    .array(
      z.object({
        wordId: z.string().min(1),
        kind: z.enum(QUIZ_KINDS as [string, ...string[]]).default("meaning"),
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

    // Không tin điểm client gửi lên — chấm lại bằng dữ liệu lưu trong DB, cùng
    // một hàm với phần tô màu chữa bài ở client.
    const words = await prisma.vocabWord.findMany({
      where: { id: { in: parsed.answers.map((item) => item.wordId) } },
      select: { id: true, display: true, meaningVi: true, exampleEn: true }
    });

    const byId = new Map(words.map((word) => [word.id, word]));
    let correct = 0;

    for (const answer of parsed.answers) {
      const word = byId.get(answer.wordId);

      if (!word) {
        continue;
      }

      const isCorrect = checkVocabAnswer(
        answer.kind as (typeof QUIZ_KINDS)[number],
        word,
        answer.chosen
      );

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

const hideSchema = z.object({
  wordId: z.string().min(1),
  hidden: z.enum(["true", "false"])
});

export async function hideVocabWord(formData: FormData): Promise<ActionResult> {
  try {
    await requireTeacher();

    const parsed = hideSchema.parse({
      wordId: formData.get("wordId"),
      hidden: formData.get("hidden")
    });

    // Ẩn từ KHÔNG xoá bản ghi VocabDaily cũ — lịch sử ngày nào phát từ nào phải
    // giữ nguyên, nếu không quiz "từ hôm qua" sẽ hỏi sai.
    await prisma.vocabWord.update({
      where: { id: parsed.wordId },
      data: { hidden: parsed.hidden === "true" }
    });

    revalidatePath("/teacher/vocab");

    return actionOk(parsed.hidden === "true" ? "Đã ẩn từ." : "Đã bỏ ẩn từ.");
  } catch (error) {
    return actionFail(error, "Cập nhật từ");
  }
}

const updateSchema = z.object({
  wordId: z.string().min(1),
  meaningVi: z.string().trim().min(1, "Nghĩa tiếng Việt không được để trống."),
  phonetic: z.string().trim(),
  exampleEn: z.string().trim().min(1, "Câu ví dụ không được để trống.")
});

export async function updateVocabWord(formData: FormData): Promise<ActionResult> {
  try {
    await requireTeacher();

    const parsed = updateSchema.parse({
      wordId: formData.get("wordId"),
      meaningVi: formData.get("meaningVi"),
      phonetic: formData.get("phonetic"),
      exampleEn: formData.get("exampleEn")
    });

    await prisma.vocabWord.update({
      where: { id: parsed.wordId },
      data: {
        meaningVi: parsed.meaningVi,
        phonetic: parsed.phonetic.length > 0 ? parsed.phonetic : null,
        exampleEn: parsed.exampleEn
      }
    });

    revalidatePath("/teacher/vocab");
    revalidatePath("/student");

    return actionOk("Đã lưu thay đổi.");
  } catch (error) {
    return actionFail(error, "Lưu từ");
  }
}
