"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudent } from "@/lib/actions/attempts";
import { requireTeacher } from "@/lib/actions/classes";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import { vietnamDateKey } from "@/lib/vocab-day";
import { dateKeyToUtcDate } from "@/lib/vocab-daily";
import { shiftDateKey } from "@/lib/vocab-streak";
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

const optionalText = z.string().trim().optional().default("");

const createSchema = z.object({
  display: z
    .string()
    .trim()
    .min(1, "Chưa nhập từ.")
    .max(60, "Từ quá dài.")
    .regex(/^[A-Za-z][A-Za-z' -]*$/, "Từ chỉ gồm chữ cái tiếng Anh."),
  phonetic: optionalText,
  partOfSpeech: optionalText,
  meaningVi: z.string().trim().min(1, "Nghĩa tiếng Việt không được để trống."),
  definitionEn: optionalText,
  exampleEn: z.string().trim().min(1, "Câu ví dụ không được để trống.")
});

// Cô thêm từ tay — không gắn phần đề nào, sourceSkill = "manual" để phân biệt với
// từ rút tự động (listening/reading).
export async function createVocabWord(formData: FormData): Promise<ActionResult> {
  try {
    await requireTeacher();

    const parsed = createSchema.parse({
      display: formData.get("display"),
      phonetic: formData.get("phonetic"),
      partOfSpeech: formData.get("partOfSpeech"),
      meaningVi: formData.get("meaningVi"),
      definitionEn: formData.get("definitionEn"),
      exampleEn: formData.get("exampleEn")
    });

    const word = parsed.display.toLowerCase();

    const existing = await prisma.vocabWord.findUnique({
      where: { word },
      select: { hidden: true }
    });

    if (existing) {
      const reason = existing.hidden
        ? `“${parsed.display}” đã có trong kho nhưng đang ẩn — tìm rồi bấm Bỏ ẩn.`
        : `“${parsed.display}” đã có trong kho.`;

      return actionFail(new Error(reason), "Thêm từ");
    }

    await prisma.vocabWord.create({
      data: {
        word,
        display: parsed.display,
        phonetic: parsed.phonetic || null,
        partOfSpeech: parsed.partOfSpeech || null,
        meaningVi: parsed.meaningVi,
        definitionEn: parsed.definitionEn || null,
        exampleEn: parsed.exampleEn,
        sourceSkill: "manual"
      }
    });

    revalidatePath("/teacher/vocab");

    return actionOk(`Đã thêm “${parsed.display}” vào kho.`);
  } catch (error) {
    return actionFail(error, "Thêm từ");
  }
}

function tomorrowDate(now = new Date()): Date {
  return dateKeyToUtcDate(shiftDateKey(vietnamDateKey(now), 1));
}

const pinSchema = z.object({ wordId: z.string().min(1) });

// Ghim = ghi sẵn dòng VocabDaily cho ngày mai. getWordOfTheDay thấy đã có dòng
// thì dùng luôn, không tự chọn. Ghim đè: ngày mai chỉ có một từ.
export async function pinVocabWordForTomorrow(formData: FormData): Promise<ActionResult> {
  try {
    await requireTeacher();

    const parsed = pinSchema.parse({ wordId: formData.get("wordId") });

    const word = await prisma.vocabWord.findUnique({
      where: { id: parsed.wordId },
      select: { display: true, hidden: true }
    });

    if (!word) {
      return actionFail(new Error("Không tìm thấy từ."), "Ghim từ");
    }

    if (word.hidden) {
      return actionFail(new Error("Từ đang ẩn — bỏ ẩn trước rồi mới ghim."), "Ghim từ");
    }

    const date = tomorrowDate();

    await prisma.vocabDaily.upsert({
      where: { date },
      update: { wordId: parsed.wordId },
      create: { date, wordId: parsed.wordId }
    });

    revalidatePath("/teacher/vocab");

    return actionOk(`Ngày mai sẽ phát “${word.display}”.`);
  } catch (error) {
    return actionFail(error, "Ghim từ");
  }
}

export async function unpinVocabTomorrow(): Promise<ActionResult> {
  try {
    await requireTeacher();

    await prisma.vocabDaily.deleteMany({ where: { date: tomorrowDate() } });

    revalidatePath("/teacher/vocab");

    return actionOk("Đã bỏ ghim, ngày mai hệ thống tự chọn từ.");
  } catch (error) {
    return actionFail(error, "Bỏ ghim");
  }
}
