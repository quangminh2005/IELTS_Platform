import { matchesSearch } from "@/lib/assignment-wizard";
import { cardState, type CardState } from "@/lib/vocab-srs";

// "unstudied" = từ đã phát nhưng học viên chưa có thẻ (chưa học lần nào).
export type WordStatus = CardState | "unstudied";

// Một dòng trong Sổ từ của học viên: một thẻ ôn, hoặc một từ đã phát chưa học.
export type VocabWordEntry = {
  id: string;
  cardId: string | null;
  display: string;
  phonetic: string | null;
  partOfSpeech: string | null;
  meaningVi: string;
  definitionEn: string | null;
  exampleEn: string;
  exampleVi?: string | null;
  sourceLabel: string | null;
  // Ngày gom nhóm (yyyy-mm-dd giờ VN): ngày thêm thẻ, hoặc ngày phát với từ chưa học.
  dateKey: string;
  status: WordStatus;
  // Ngày ôn tiếp (yyyy-mm-dd), null với từ chưa học.
  dueDate: string | null;
  // Học viên tự bôi đen thêm ở trang Kết quả.
  selfAdded: boolean;
  // Nghĩa do học viên tự gõ (không phải từ kho) → được sửa.
  editable: boolean;
};

export type DeckCardInput = {
  id: string;
  wordId: string | null;
  source: string;
  box: number;
  dueDate: string;
  createdKey: string;
  content: {
    display: string;
    phonetic: string | null;
    partOfSpeech: string | null;
    meaningVi: string;
    definitionEn: string | null;
    exampleEn: string;
    exampleVi?: string | null;
  };
  sourceLabel: string | null;
};

export type ReleasedWordInput = {
  id: string;
  display: string;
  phonetic: string | null;
  partOfSpeech: string | null;
  meaningVi: string;
  definitionEn: string | null;
  exampleEn: string;
  exampleVi?: string | null;
  sourceLabel: string | null;
  releasedOn: string;
};

// Ghép thẻ của học viên với các từ đã phát mà em đó chưa học. Từ phát nhiều lần
// (kho xoay vòng) chỉ giữ lần phát đầu; từ đã có thẻ thì lấy theo thẻ.
export function buildVocabWordEntries(
  cards: DeckCardInput[],
  released: ReleasedWordInput[]
): VocabWordEntry[] {
  const entries: VocabWordEntry[] = cards.map((card) => ({
    id: card.id,
    cardId: card.id,
    ...card.content,
    sourceLabel: card.sourceLabel,
    dateKey: card.createdKey,
    status: cardState(card.box),
    dueDate: card.dueDate,
    selfAdded: card.source === "student",
    editable: card.source === "student" && card.wordId === null
  }));

  const carded = new Set(cards.map((card) => card.wordId).filter(Boolean));
  const firstRelease = new Map<string, ReleasedWordInput>();

  for (const word of released) {
    const seen = firstRelease.get(word.id);

    if (!carded.has(word.id) && (!seen || word.releasedOn < seen.releasedOn)) {
      firstRelease.set(word.id, word);
    }
  }

  for (const word of firstRelease.values()) {
    const { releasedOn, ...rest } = word;
    entries.push({
      ...rest,
      cardId: null,
      dateKey: releasedOn,
      status: "unstudied",
      dueDate: null,
      selfAdded: false,
      editable: false
    });
  }

  return entries;
}

// Tìm theo từ tiếng Anh hoặc nghĩa Việt; gõ không dấu vẫn ra nhờ matchesSearch.
export function filterVocabWords(words: VocabWordEntry[], query: string): VocabWordEntry[] {
  const needle = query.trim();

  if (!needle) {
    return words;
  }

  return words.filter(
    (word) => matchesSearch(word.display, needle) || matchesSearch(word.meaningVi, needle)
  );
}

// "2026-09-03" → "3/9/2026" — không qua Intl để test không phụ thuộc locale máy.
export function formatVietnamDate(key: string): string {
  const [year, month, day] = key.split("-").map(Number);

  return `${day}/${month}/${year}`;
}

export type VocabDateGroup = {
  date: string;
  label: string;
  words: VocabWordEntry[];
};

export function groupVocabWordsByDate(words: VocabWordEntry[]): VocabDateGroup[] {
  const byDate = new Map<string, VocabWordEntry[]>();

  for (const word of words) {
    const bucket = byDate.get(word.dateKey) ?? [];
    bucket.push(word);
    byDate.set(word.dateKey, bucket);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, items]) => ({ date, label: formatVietnamDate(date), words: items }));
}

export function countByStatus(words: VocabWordEntry[]): Record<WordStatus, number> {
  const counts: Record<WordStatus, number> = { unstudied: 0, new: 0, learning: 0, mastered: 0 };

  for (const word of words) {
    counts[word.status] += 1;
  }

  return counts;
}

// Nhóm thẻ để lật (trang Lật thẻ). Lật thẻ chỉ để xem, KHÔNG đổi lịch ôn.
export const FLASHCARD_GROUPS = ["learning", "self", "mastered", "all"] as const;

export type FlashcardGroup = (typeof FLASHCARD_GROUPS)[number];

export const FLASHCARD_GROUP_LABELS: Record<FlashcardGroup, string> = {
  learning: "Đang học",
  self: "Tự thêm",
  mastered: "Đã thuộc",
  all: "Tất cả"
};

export function parseFlashcardGroup(value: string | undefined): FlashcardGroup {
  return (FLASHCARD_GROUPS as readonly string[]).includes(value ?? "")
    ? (value as FlashcardGroup)
    : "learning";
}

// "Đang học" gồm cả thẻ mới — những từ cần nhìn lại nhiều nhất.
export function wordsForFlashcards(
  words: VocabWordEntry[],
  group: FlashcardGroup
): VocabWordEntry[] {
  switch (group) {
    case "learning":
      return words.filter((word) => word.status === "new" || word.status === "learning");
    case "self":
      return words.filter((word) => word.selfAdded);
    case "mastered":
      return words.filter((word) => word.status === "mastered");
    case "all":
      return words;
  }
}
