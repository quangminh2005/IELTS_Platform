"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudent } from "@/lib/actions/attempts";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import { vietnamDateKey } from "@/lib/vocab-day";
import { dateKeyToUtcDate } from "@/lib/vocab-daily";
import { CARD_SELECT, resolveCard } from "@/lib/vocab-deck";
import { checkVocabAnswer, QUIZ_KINDS, type QuizKind } from "@/lib/vocab-quiz";
import {
  cleanSelection,
  isAddableSelection,
  mergeDictionaryEntries,
  parseDictionaryEntry,
  parseWiktionaryEntry
} from "@/lib/vocab-selection";
import { nextSchedule, normalizeWordKey } from "@/lib/vocab-srs";

// ── Ôn thẻ ──────────────────────────────────────────────────────────────────

const answerSchema = z
  .object({
    cardId: z.string().min(1).nullable().optional(),
    wordId: z.string().min(1).nullable().optional(),
    kind: z.enum(QUIZ_KINDS as [QuizKind, ...QuizKind[]]),
    chosen: z.string().trim().min(1).max(200)
  })
  .refine((value) => Boolean(value.cardId) !== Boolean(value.wordId), {
    message: "Cần đúng một trong hai: cardId hoặc wordId."
  });

export type AnswerCardResult = { ok: boolean; message?: string };

// Mỗi câu trả lời lưu ngay (điện thoại mất mạng giữa buổi không mất phần đã ôn).
// Server chấm lại bằng dữ liệu DB, không tin client. Thẻ kho mới được TẠO lúc trả
// lời câu đầu tiên. Không gọi revalidatePath: trang ôn đang giữ bộ thẻ trong state,
// dựng lại trang giữa chừng sẽ làm bộ thẻ nhảy.
export async function answerVocabCard(input: {
  cardId?: string | null;
  wordId?: string | null;
  kind: QuizKind;
  chosen: string;
}): Promise<AnswerCardResult> {
  try {
    const student = await requireStudent();
    const parsed = answerSchema.parse(input);
    const now = new Date();
    const today = vietnamDateKey(now);

    let card = parsed.cardId
      ? await prisma.vocabDeckCard.findFirst({
          where: { id: parsed.cardId, studentId: student.id },
          select: { ...CARD_SELECT, lastReviewedAt: true }
        })
      : null;

    if (parsed.cardId && !card) {
      throw new Error("Không tìm thấy thẻ.");
    }

    let bankWord: { id: string; word: string } | null = null;

    if (parsed.wordId) {
      bankWord = await prisma.vocabWord.findFirst({
        where: { id: parsed.wordId, hidden: false },
        select: { id: true, word: true }
      });

      if (!bankWord) {
        throw new Error("Không tìm thấy từ.");
      }

      // Hai tab cùng ôn: thẻ có thể vừa được tab kia tạo.
      card = await prisma.vocabDeckCard.findUnique({
        where: { studentId_wordKey: { studentId: student.id, wordKey: bankWord.word } },
        select: { ...CARD_SELECT, lastReviewedAt: true }
      });
    }

    const content = card
      ? resolveCard(card)?.content
      : await prisma.vocabWord
          .findUnique({
            where: { id: bankWord!.id },
            select: { display: true, meaningVi: true, exampleEn: true }
          })
          .then((word) => word ?? undefined);

    if (!content) {
      throw new Error("Từ này đã bị ẩn.");
    }

    const correct = checkVocabAnswer(parsed.kind, content, parsed.chosen);

    // Chỉ lần trả lời đầu tiên trong ngày mới đổi lịch.
    if (card?.lastReviewedAt && vietnamDateKey(card.lastReviewedAt) === today) {
      return { ok: true };
    }

    const schedule = nextSchedule({ box: card?.box ?? 0, correct, today });
    const dueDate = dateKeyToUtcDate(schedule.dueDate);

    if (card) {
      await prisma.vocabDeckCard.update({
        where: { id: card.id },
        data: {
          box: schedule.box,
          dueDate,
          reviewCount: { increment: 1 },
          lapseCount: { increment: !correct && card.box > 0 ? 1 : 0 },
          lastReviewedAt: now
        }
      });
    } else {
      await prisma.vocabDeckCard.createMany({
        data: [
          {
            studentId: student.id,
            wordKey: bankWord!.word,
            source: "bank",
            wordId: bankWord!.id,
            box: schedule.box,
            dueDate,
            reviewCount: 1,
            lastReviewedAt: now
          }
        ],
        skipDuplicates: true
      });
    }

    // Giữ số liệu cũ chạy tiếp: tỉ lệ đúng từ kho (bảng của thầy) và ngày có ôn
    // (chuỗi ngày ôn).
    const progressWordId = card?.wordId ?? bankWord?.id ?? null;

    if (progressWordId) {
      await prisma.vocabProgress.upsert({
        where: { studentId_wordId: { studentId: student.id, wordId: progressWordId } },
        update: {
          correctCount: { increment: correct ? 1 : 0 },
          wrongCount: { increment: correct ? 0 : 1 },
          lastAnswerAt: now
        },
        create: {
          studentId: student.id,
          wordId: progressWordId,
          correctCount: correct ? 1 : 0,
          wrongCount: correct ? 0 : 1,
          lastAnswerAt: now
        }
      });
    }

    await prisma.vocabQuizDay.upsert({
      where: { studentId_date: { studentId: student.id, date: dateKeyToUtcDate(today) } },
      update: { correct: { increment: correct ? 1 : 0 }, total: { increment: 1 } },
      create: {
        studentId: student.id,
        date: dateKeyToUtcDate(today),
        correct: correct ? 1 : 0,
        total: 1
      }
    });

    return { ok: true };
  } catch (error) {
    return actionFail(error, "Lưu câu trả lời");
  }
}

// ── Học viên tự thêm từ ở trang Kết quả ─────────────────────────────────────

export type LookupResult = {
  ok: boolean;
  inBank: boolean;
  alreadyAdded: boolean;
  display: string;
  phonetic: string | null;
  partOfSpeech: string | null;
  meaningVi: string;
  definitionEn: string | null;
};

const DICTIONARY_URL = "https://api.dictionaryapi.dev/api/v2/entries/en/";
const WIKTIONARY_URL = "https://en.wiktionary.org/api/rest_v1/page/definition/";
const LOOKUP_TIMEOUT_MS = 4000;

async function fetchJson(url: string): Promise<unknown> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      cache: "no-store",
      // Wiktionary yêu cầu User-Agent tự giới thiệu.
      headers: { "User-Agent": "ielts-platform-vocab/1.0 (lookup for students)" }
    });

    return response.ok ? await response.json() : null;
  } catch {
    // Mạng chậm/nguồn sập → trả rỗng, học viên tự gõ.
    return null;
  }
}

// Gọi song song hai nguồn: dictionaryapi.dev (có phiên âm) và Wiktionary (dự
// phòng — dictionaryapi có lúc không vào được từ mạng VN). Tối đa ~4 giây.
async function fetchDictionary(key: string) {
  const word = encodeURIComponent(key);
  const [primary, fallback] = await Promise.all([
    fetchJson(`${DICTIONARY_URL}${word}`),
    fetchJson(`${WIKTIONARY_URL}${word}`)
  ]);

  return mergeDictionaryEntries(parseDictionaryEntry(primary), parseWiktionaryEntry(fallback));
}

export async function lookupVocabWord(raw: string): Promise<LookupResult> {
  const empty: LookupResult = {
    ok: false,
    inBank: false,
    alreadyAdded: false,
    display: "",
    phonetic: null,
    partOfSpeech: null,
    meaningVi: "",
    definitionEn: null
  };

  try {
    const student = await requireStudent();
    const display = cleanSelection(String(raw ?? ""));

    if (!isAddableSelection(display)) {
      return empty;
    }

    const key = normalizeWordKey(display);
    const [bank, existing] = await Promise.all([
      prisma.vocabWord.findFirst({
        where: { word: key, hidden: false },
        select: {
          display: true,
          phonetic: true,
          partOfSpeech: true,
          meaningVi: true,
          definitionEn: true
        }
      }),
      prisma.vocabDeckCard.findUnique({
        where: { studentId_wordKey: { studentId: student.id, wordKey: key } },
        select: { id: true }
      })
    ]);

    if (bank) {
      return { ok: true, inBank: true, alreadyAdded: Boolean(existing), ...bank };
    }

    const entry = await fetchDictionary(key);

    return {
      ok: true,
      inBank: false,
      alreadyAdded: Boolean(existing),
      display,
      phonetic: entry?.phonetic ?? null,
      partOfSpeech: entry?.partOfSpeech ?? null,
      meaningVi: "",
      definitionEn: entry?.definitionEn ?? null
    };
  } catch {
    return empty;
  }
}

const optional = (max: number) => z.string().trim().max(max).optional().default("");

const addSchema = z.object({
  display: z.string(),
  meaningVi: optional(200),
  phonetic: optional(80),
  partOfSpeech: optional(40),
  definitionEn: optional(500),
  exampleEn: optional(500),
  attemptId: optional(60)
});

const orNull = (value: string) => (value.length > 0 ? value : null);

export async function addStudentVocabWord(formData: FormData): Promise<ActionResult> {
  try {
    const student = await requireStudent();
    const parsed = addSchema.parse({
      display: formData.get("display") ?? "",
      meaningVi: formData.get("meaningVi") ?? undefined,
      phonetic: formData.get("phonetic") ?? undefined,
      partOfSpeech: formData.get("partOfSpeech") ?? undefined,
      definitionEn: formData.get("definitionEn") ?? undefined,
      exampleEn: formData.get("exampleEn") ?? undefined,
      attemptId: formData.get("attemptId") ?? undefined
    });
    const display = cleanSelection(parsed.display);

    if (!isAddableSelection(display)) {
      throw new Error("Chỉ thêm được 1–3 từ tiếng Anh.");
    }

    const key = normalizeWordKey(display);
    const [bank, existing, attempt] = await Promise.all([
      prisma.vocabWord.findFirst({ where: { word: key, hidden: false }, select: { id: true } }),
      prisma.vocabDeckCard.findUnique({
        where: { studentId_wordKey: { studentId: student.id, wordKey: key } },
        select: { id: true }
      }),
      parsed.attemptId
        ? prisma.attempt.findFirst({
            where: { id: parsed.attemptId, studentId: student.id },
            select: { id: true }
          })
        : null
    ]);

    if (existing) {
      return { ok: false, message: `“${display}” đã có trong Sổ từ của bạn.` };
    }

    if (!bank && parsed.meaningVi.length === 0) {
      throw new Error("Hãy ghi nghĩa tiếng Việt của từ.");
    }

    const base = {
      studentId: student.id,
      wordKey: key,
      source: "student",
      sourceAttemptId: attempt?.id ?? null,
      box: 0,
      dueDate: dateKeyToUtcDate(vietnamDateKey(new Date()))
    };

    // Từ có sẵn trong kho: dùng nghĩa thầy soạn, bỏ qua nghĩa học viên gõ.
    await prisma.vocabDeckCard.create({
      data: bank
        ? { ...base, wordId: bank.id }
        : {
            ...base,
            display,
            meaningVi: parsed.meaningVi,
            phonetic: orNull(parsed.phonetic),
            partOfSpeech: orNull(parsed.partOfSpeech),
            definitionEn: orNull(parsed.definitionEn),
            exampleEn: orNull(parsed.exampleEn)
          }
    });

    revalidatePath("/student/vocab/words");

    return actionOk(`Đã thêm “${display}” vào Sổ từ — thẻ sẽ có trong buổi ôn hôm nay.`);
  } catch (error) {
    return actionFail(error, "Thêm từ");
  }
}

const updateSchema = z.object({
  cardId: z.string().min(1),
  meaningVi: z.string().trim().min(1, "Nghĩa tiếng Việt không được để trống.").max(200),
  exampleEn: optional(500)
});

// Chỉ sửa được từ HỌC VIÊN TỰ GÕ (không có wordId) — từ kho do thầy quản lý.
export async function updateStudentVocabWord(formData: FormData): Promise<ActionResult> {
  try {
    const student = await requireStudent();
    const parsed = updateSchema.parse({
      cardId: formData.get("cardId"),
      meaningVi: formData.get("meaningVi"),
      exampleEn: formData.get("exampleEn") ?? undefined
    });

    const result = await prisma.vocabDeckCard.updateMany({
      where: { id: parsed.cardId, studentId: student.id, source: "student", wordId: null },
      data: { meaningVi: parsed.meaningVi, exampleEn: orNull(parsed.exampleEn) }
    });

    if (result.count === 0) {
      throw new Error("Không sửa được từ này.");
    }

    revalidatePath("/student/vocab/words");

    return actionOk("Đã lưu.");
  } catch (error) {
    return actionFail(error, "Lưu từ");
  }
}

export async function deleteStudentVocabWord(formData: FormData): Promise<ActionResult> {
  try {
    const student = await requireStudent();
    const cardId = z.string().min(1).parse(formData.get("cardId"));

    const result = await prisma.vocabDeckCard.deleteMany({
      where: { id: cardId, studentId: student.id, source: "student" }
    });

    if (result.count === 0) {
      throw new Error("Không xoá được từ này.");
    }

    revalidatePath("/student/vocab/words");

    return actionOk("Đã xoá khỏi Sổ từ.");
  } catch (error) {
    return actionFail(error, "Xoá từ");
  }
}
