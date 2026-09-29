import { prisma } from "@/lib/prisma";
import { vietnamDateKey } from "@/lib/vocab-day";
import { dateKeyToUtcDate } from "@/lib/vocab-daily";
import type { QuizWord } from "@/lib/vocab-quiz";
import {
  buildReviewSession,
  legacyBox,
  newCardAllowance,
  pickNewWords,
  SESSION_SIZE,
  type DueCard,
  type SessionItem
} from "@/lib/vocab-srs";

// Truy vấn bộ thẻ ôn của học viên. Logic lịch ôn nằm ở lib/vocab-srs.ts (thuần,
// có test); file này chỉ đọc DB rồi đưa dữ liệu cho các hàm đó.

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

// 0h sáng giờ VN của ngày `key`, tính ra mốc UTC thật — để so với createdAt.
function vietnamDayStart(key: string): Date {
  return new Date(dateKeyToUtcDate(key).getTime() - VN_OFFSET_MS);
}

export const CARD_SELECT = {
  id: true,
  wordId: true,
  source: true,
  box: true,
  dueDate: true,
  display: true,
  phonetic: true,
  partOfSpeech: true,
  meaningVi: true,
  definitionEn: true,
  exampleEn: true,
  createdAt: true,
  word: {
    select: {
      display: true,
      phonetic: true,
      partOfSpeech: true,
      meaningVi: true,
      definitionEn: true,
      exampleEn: true,
      hidden: true
    }
  }
} as const;

type CardRow = {
  id: string;
  wordId: string | null;
  source: string;
  box: number;
  dueDate: Date;
  display: string | null;
  phonetic: string | null;
  partOfSpeech: string | null;
  meaningVi: string | null;
  definitionEn: string | null;
  exampleEn: string | null;
  createdAt: Date;
  word: {
    display: string;
    phonetic: string | null;
    partOfSpeech: string | null;
    meaningVi: string;
    definitionEn: string | null;
    exampleEn: string;
    hidden: boolean;
  } | null;
};

export type CardContent = {
  display: string;
  phonetic: string | null;
  partOfSpeech: string | null;
  meaningVi: string;
  definitionEn: string | null;
  exampleEn: string;
};

export type ResolvedCard = {
  id: string;
  wordId: string | null;
  source: string;
  box: number;
  dueDate: string;
  createdAt: Date;
  content: CardContent;
};

// Thẻ có wordId đọc nội dung từ kho (thầy sửa nghĩa là thẻ đổi theo). Từ kho bị
// thầy ẩn → thẻ tạm ẩn luôn (null), không xoá để bỏ ẩn là thẻ quay lại.
export function resolveCard(row: CardRow): ResolvedCard | null {
  let content: CardContent;

  if (row.wordId) {
    if (!row.word || row.word.hidden) {
      return null;
    }

    content = {
      display: row.word.display,
      phonetic: row.word.phonetic,
      partOfSpeech: row.word.partOfSpeech,
      meaningVi: row.word.meaningVi,
      definitionEn: row.word.definitionEn,
      exampleEn: row.word.exampleEn
    };
  } else {
    if (!row.display || !row.meaningVi) {
      return null;
    }

    content = {
      display: row.display,
      phonetic: row.phonetic,
      partOfSpeech: row.partOfSpeech,
      meaningVi: row.meaningVi,
      definitionEn: row.definitionEn,
      exampleEn: row.exampleEn ?? ""
    };
  }

  return {
    id: row.id,
    wordId: row.wordId,
    source: row.source,
    box: row.box,
    dueDate: row.dueDate.toISOString().slice(0, 10),
    createdAt: row.createdAt,
    content
  };
}

// Học viên đã ôn bằng quiz 5 câu cũ: mỗi từ trong VocabProgress chưa có thẻ thì
// tạo thẻ, đến hạn hôm nay. createdAt lấy theo lần ôn cũ để không bị tính vào
// hạn mức "5 thẻ mới hôm nay". Sau lần đầu, truy vấn này trả rỗng.
export async function ensureLegacyCards(studentId: string, now = new Date()) {
  const missing = await prisma.vocabProgress.findMany({
    where: { studentId, word: { deckCards: { none: { studentId } } } },
    select: {
      wordId: true,
      correctCount: true,
      wrongCount: true,
      lastAnswerAt: true,
      word: { select: { word: true } }
    }
  });

  if (missing.length === 0) {
    return;
  }

  const today = dateKeyToUtcDate(vietnamDateKey(now));
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  await prisma.vocabDeckCard.createMany({
    data: missing.map((row) => ({
      studentId,
      wordKey: row.word.word,
      source: "bank",
      wordId: row.wordId,
      box: legacyBox(row.correctCount, row.wrongCount),
      dueDate: today,
      createdAt: row.lastAnswerAt ?? yesterday
    })),
    skipDuplicates: true
  });
}

type BankWord = QuizWord & { releasedOn: string | null };

// Cả kho (bỏ từ bị ẩn và từ thầy ghim cho ngày tương lai). Vừa là nguồn thẻ mới,
// vừa là rổ đáp án nhiễu. ~500 dòng, chỉ lấy cột nhẹ.
async function loadBank(todayKey: string): Promise<BankWord[]> {
  const rows = await prisma.vocabWord.findMany({
    where: { hidden: false },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      display: true,
      phonetic: true,
      meaningVi: true,
      exampleEn: true,
      dailies: { select: { date: true } }
    }
  });

  const bank: BankWord[] = [];

  for (const row of rows) {
    const dates = row.dailies.map((daily) => daily.date.toISOString().slice(0, 10)).sort();
    const released = dates.filter((date) => date <= todayKey);

    // Chỉ có lịch phát trong tương lai = thầy ghim sẵn, chưa được lộ ra.
    if (dates.length > 0 && released.length === 0) {
      continue;
    }

    bank.push({
      id: row.id,
      display: row.display,
      phonetic: row.phonetic,
      meaningVi: row.meaningVi,
      exampleEn: row.exampleEn,
      releasedOn: released[0] ?? null
    });
  }

  return bank;
}

export type ReviewSession = {
  items: SessionItem[];
  dueCount: number;
  newCount: number;
  // Kho còn từ chưa thành thẻ ngoài số thẻ mới của buổi này → hiện "Học thêm 5 từ".
  canLearnMore: boolean;
};

export async function getReviewSession(
  studentId: string,
  options: { extraBatches?: number; now?: Date } = {}
): Promise<ReviewSession> {
  const now = options.now ?? new Date();
  const todayKey = vietnamDateKey(now);
  const todayDate = dateKeyToUtcDate(todayKey);

  await ensureLegacyCards(studentId, now);

  const [dueRows, introducedToday, deckWordIds, todayDaily, bank] = await Promise.all([
    prisma.vocabDeckCard.findMany({
      where: { studentId, dueDate: { lte: todayDate } },
      orderBy: [{ dueDate: "asc" }, { box: "asc" }],
      select: CARD_SELECT
    }),
    prisma.vocabDeckCard.count({
      where: { studentId, source: "bank", createdAt: { gte: vietnamDayStart(todayKey) } }
    }),
    prisma.vocabDeckCard.findMany({
      where: { studentId, wordId: { not: null } },
      select: { wordId: true }
    }),
    prisma.vocabDaily.findUnique({ where: { date: todayDate }, select: { wordId: true } }),
    loadBank(todayKey)
  ]);

  const due: DueCard[] = [];

  for (const row of dueRows) {
    const card = resolveCard(row);

    if (!card) {
      continue;
    }

    due.push({
      cardId: card.id,
      wordId: card.wordId,
      box: card.box,
      dueDate: card.dueDate,
      word: {
        id: card.id,
        display: card.content.display,
        phonetic: card.content.phonetic,
        meaningVi: card.content.meaningVi,
        exampleEn: card.content.exampleEn
      }
    });
  }

  const allowance = newCardAllowance({
    introducedToday,
    extraBatches: Math.max(0, Math.min(options.extraBatches ?? 0, 10))
  });
  const exclude = new Set(deckWordIds.map((row) => row.wordId as string));
  const bankById = new Map(bank.map((word) => [word.id, word]));
  const freshIds = pickNewWords({
    candidates: bank,
    exclude,
    todayWordId: todayDaily?.wordId ?? null,
    limit: allowance
  });
  const remainingInBank = bank.filter((word) => !exclude.has(word.id)).length;

  const items = buildReviewSession({
    due,
    fresh: freshIds.map((id) => ({ wordId: id, word: bankById.get(id)! })),
    pool: bank,
    seed: Math.floor(Math.random() * 1000),
    size: SESSION_SIZE
  });

  return {
    items,
    dueCount: due.length,
    newCount: freshIds.length,
    canLearnMore: remainingInBank > freshIds.length
  };
}

// Cho thẻ "Từ vựng hôm nay" ở trang chủ: số thẻ đến hạn + số thẻ mới còn được học.
export async function countTodayCards(studentId: string, now = new Date()): Promise<number> {
  const todayKey = vietnamDateKey(now);

  await ensureLegacyCards(studentId, now);

  const [dueCount, introducedToday] = await Promise.all([
    prisma.vocabDeckCard.count({
      where: {
        studentId,
        dueDate: { lte: dateKeyToUtcDate(todayKey) },
        OR: [{ wordId: null }, { word: { hidden: false } }]
      }
    }),
    prisma.vocabDeckCard.count({
      where: { studentId, source: "bank", createdAt: { gte: vietnamDayStart(todayKey) } }
    })
  ]);

  return dueCount + newCardAllowance({ introducedToday, extraBatches: 0 });
}
