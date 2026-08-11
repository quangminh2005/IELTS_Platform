import { prisma } from "@/lib/prisma";
import { pickNextWord, vietnamDateKey, vietnamDayNumber } from "@/lib/vocab-day";
import { calculateVocabStreak } from "@/lib/vocab-streak";
import { MIN_POOL_FOR_QUIZ } from "@/lib/vocab-quiz";

export type DailyWord = {
  id: string;
  display: string;
  phonetic: string | null;
  partOfSpeech: string | null;
  meaningVi: string;
  exampleEn: string;
  sourceUnitId: string | null;
  // Tên đề gốc, vd "Cambridge 20 · Reading Test 1 — Passage 1". Null với từ nhập
  // tay không gắn phần đề nào.
  sourceLabel: string | null;
};

// Cột date kiểu DATE — quy ước lưu bằng nửa đêm UTC của đúng ngày VN đó.
export function dateKeyToUtcDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

const WORD_FIELDS = {
  id: true,
  display: true,
  phonetic: true,
  partOfSpeech: true,
  meaningVi: true,
  exampleEn: true,
  sourceUnitId: true,
  // select tường minh, không include: content/transcript của phần đề rất nặng.
  sourceUnit: {
    select: { title: true, material: { select: { title: true } } }
  }
} as const;

type WordRow = {
  id: string;
  display: string;
  phonetic: string | null;
  partOfSpeech: string | null;
  meaningVi: string;
  exampleEn: string;
  sourceUnitId: string | null;
  sourceUnit: { title: string; material: { title: string } } | null;
};

function toDailyWord(row: WordRow): DailyWord {
  const { sourceUnit, ...rest } = row;

  return {
    ...rest,
    sourceLabel: sourceUnit
      ? `${sourceUnit.material.title} — ${sourceUnit.title}`
      : null
  };
}

export async function getWordOfTheDay(now = new Date()): Promise<DailyWord | null> {
  const key = vietnamDateKey(now);
  const date = dateKeyToUtcDate(key);

  const today = await prisma.vocabDaily.findUnique({
    where: { date },
    select: { word: { select: WORD_FIELDS } }
  });

  if (today) {
    return toDailyWord(today.word);
  }

  const [pool, used] = await Promise.all([
    prisma.vocabWord.findMany({
      where: { hidden: false },
      orderBy: { id: "asc" },
      select: { id: true }
    }),
    prisma.vocabDaily.findMany({ select: { wordId: true } })
  ]);

  const wordId = pickNextWord({
    candidates: pool.map((row) => row.id),
    usedIds: used.map((row) => row.wordId),
    dayNumber: vietnamDayNumber(now)
  });

  if (!wordId) {
    return null;
  }

  // Hai người vào cùng lúc thì chỉ một bản ghi được tạo. Dùng createMany +
  // skipDuplicates thay vì create + bắt lỗi P2002: cùng kết quả, nhưng không
  // ném lỗi nên log Vercel không bị rác một dòng đỏ mỗi sáng.
  await prisma.vocabDaily.createMany({
    data: [{ date, wordId }],
    skipDuplicates: true
  });

  const saved = await prisma.vocabDaily.findUnique({
    where: { date },
    select: { word: { select: WORD_FIELDS } }
  });

  return saved ? toDailyWord(saved.word) : null;
}

export async function getVocabSidebar(studentId: string, now = new Date()) {
  const [quizDays, learnedCount, poolCount] = await Promise.all([
    prisma.vocabQuizDay.findMany({
      where: { studentId },
      select: { date: true }
    }),
    prisma.vocabProgress.count({ where: { studentId } }),
    // Đếm đúng rổ mà trang quiz sẽ dùng: chỉ từ ĐÃ TỪNG được phát. Đếm cả kho
    // thì nút "Ôn 5 từ cũ" hiện ra trong khi trang quiz lại báo chưa đủ từ.
    prisma.vocabWord.count({ where: { hidden: false, dailies: { some: {} } } })
  ]);

  const streak = calculateVocabStreak({
    days: quizDays.map((row) => row.date.toISOString().slice(0, 10)),
    today: vietnamDateKey(now)
  });

  return {
    streakDays: streak.days,
    learnedCount,
    canQuiz: poolCount >= MIN_POOL_FOR_QUIZ
  };
}
