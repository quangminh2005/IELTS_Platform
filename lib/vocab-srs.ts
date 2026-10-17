import {
  buildQuestion,
  normalizeVietnamese,
  type QuizKind,
  type QuizQuestion,
  type QuizWord
} from "@/lib/vocab-quiz";
import { shiftDateKey } from "@/lib/vocab-streak";

/*
  Lịch ôn thẻ từ vựng kiểu hộp Leitner — hàm thuần, không đụng DB.

  Mỗi thẻ nằm trong một hộp 1..6 (0 = thẻ mới chưa trả lời lần nào). Trả lời
  đúng → lên một hộp, khoảng cách tới lần ôn sau giãn ra; sai → về hộp 1, ôn lại
  ngày mai. Chỉ LẦN TRẢ LỜI ĐẦU TIÊN trong ngày mới đổi lịch — câu hỏi lại cuối
  buổi chỉ để luyện (xem lib/actions/vocab-deck.ts).
*/

// Khoảng cách (ngày) theo hộp SAU khi trả lời. Chỉ số = số hộp.
export const BOX_INTERVAL_DAYS = [0, 1, 3, 7, 14, 30, 60] as const;

export const MAX_BOX = 6;

// Hộp 5 = 30 ngày mới ôn lại — coi như đã thuộc.
export const MASTERED_BOX = 5;

export const NEW_CARDS_PER_DAY = 5;

// Mỗi buổi ôn tối đa bấy nhiêu thẻ — đủ ngắn để làm xong trên điện thoại.
export const SESSION_SIZE = 20;

export type CardState = "new" | "learning" | "mastered";

// "Take   Part" → "take part", "children’s" → "children's". Dùng làm khoá chống
// trùng thẻ và để so với VocabWord.word (cũng lưu chữ thường).
export function normalizeWordKey(value: string): string {
  return value.trim().replace(/[’‘]/g, "'").replace(/\s+/g, " ").toLowerCase();
}

export function nextSchedule(input: {
  box: number;
  correct: boolean;
  today: string;
}): { box: number; dueDate: string } {
  const box = input.correct ? Math.min(Math.max(input.box, 0) + 1, MAX_BOX) : 1;

  return { box, dueDate: shiftDateKey(input.today, BOX_INTERVAL_DAYS[box]) };
}

// Các dạng câu được dùng cho mỗi mức hộp — dạng đầu tiên là dạng mặc định (và là
// dạng rơi về khi không dựng được dạng nối). Từ mới/hay quên: nhận ra nghĩa; đã
// quen: chọn/gõ từ, gõ nghĩa; gần thuộc: tự gõ hoàn toàn.
export function questionKindsForBox(box: number): readonly QuizKind[] {
  if (box <= 0) {
    return ["meaning"];
  }

  if (box === 1) {
    return ["meaning", "match"];
  }

  return box <= 3 ? ["reverse", "spell", "translate", "match"] : ["cloze", "spell", "translate"];
}

// `roll` xáo dạng câu trong cùng mức hộp để buổi ôn đỡ nhàm (bỏ qua = dạng mặc định).
export function questionKindForBox(box: number, roll = 0): QuizKind {
  const kinds = questionKindsForBox(box);

  return kinds[Math.abs(roll) % kinds.length];
}

// Mỗi màn nối gom bấy nhiêu từ (ít hơn MIN thì không đáng nối, đổi về dạng mặc định).
export const MATCH_GROUP_SIZE = 4;
export const MIN_MATCH_GROUP = 3;
export const MAX_MATCH_GROUP = 5;

// Băm chuỗi ra số nguyên không âm — xáo dạng câu ổn định theo seed + thẻ.
function hashRoll(text: string): number {
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
}

export function cardState(box: number): CardState {
  if (box <= 0) {
    return "new";
  }

  return box >= MASTERED_BOX ? "mastered" : "learning";
}

// Học viên đã ôn bằng quiz 5 câu cũ: đúng nhiều hơn sai thì cho vào hộp 2.
export function legacyBox(correctCount: number, wrongCount: number): number {
  return correctCount > wrongCount ? 2 : 1;
}

export function newCardAllowance(input: { introducedToday: number; extraBatches: number }): number {
  return Math.max(0, NEW_CARDS_PER_DAY * (1 + input.extraBatches) - input.introducedToday);
}

// Chọn từ kho để thành thẻ mới: từ của ngày hôm nay → các từ đã phát (cũ trước)
// → phần còn lại của kho giữ nguyên thứ tự truyền vào.
export function pickNewWords(input: {
  candidates: Array<{ id: string; releasedOn: string | null }>;
  exclude: Set<string>;
  todayWordId: string | null;
  limit: number;
}): string[] {
  if (input.limit <= 0) {
    return [];
  }

  const open = input.candidates.filter((item) => !input.exclude.has(item.id));
  const today = open.filter((item) => item.id === input.todayWordId);
  const released = open
    .filter((item) => item.id !== input.todayWordId && item.releasedOn !== null)
    .sort((a, b) => (a.releasedOn! < b.releasedOn! ? -1 : a.releasedOn! > b.releasedOn! ? 1 : 0));
  const rest = open.filter((item) => item.id !== input.todayWordId && item.releasedOn === null);

  return [...today, ...released, ...rest].slice(0, input.limit).map((item) => item.id);
}

// Thẻ đã có trong bộ và đến hạn hôm nay (hoặc quá hạn).
export type DueCard = {
  cardId: string;
  wordId: string | null;
  box: number;
  dueDate: string;
  word: QuizWord;
};

// Từ kho sẽ thành thẻ mới — thẻ chỉ được tạo khi học viên trả lời câu đầu tiên.
export type FreshWord = {
  wordId: string;
  word: QuizWord;
};

export type SessionItem = {
  // cardId, hoặc "new:<wordId>" với từ kho chưa có thẻ. Trùng question.wordId.
  key: string;
  cardId: string | null;
  wordId: string | null;
  // Hộp 0 → hiện thẻ giới thiệu trước khi hỏi.
  isNew: boolean;
  box: number;
  // Dạng nối: các thẻ cùng mã nhóm đứng liền nhau và hiện chung một màn nối.
  matchGroup: string | null;
  question: QuizQuestion;
};

type PlannedItem = {
  key: string;
  cardId: string | null;
  wordId: string | null;
  box: number;
  word: QuizWord;
  kind: QuizKind;
  matchGroup: string | null;
};

// Gom các thẻ dạng nối thành nhóm MATCH_GROUP_SIZE thẻ theo thứ tự buổi ôn. Hai
// từ trùng nghĩa không nối chung được (không biết nối cái nào); nhóm cuối quá ít
// thẻ thì nhập vào nhóm trước nếu còn chỗ, không thì đổi về dạng mặc định.
function groupMatchItems(items: PlannedItem[]): PlannedItem[] {
  const groups: PlannedItem[][] = [];
  let current: PlannedItem[] = [];
  const fallback = (item: PlannedItem) => {
    item.kind = questionKindForBox(item.box);
  };

  for (const item of items) {
    if (item.kind !== "match") {
      continue;
    }

    const meaning = normalizeVietnamese(item.word.meaningVi);

    if (current.some((other) => normalizeVietnamese(other.word.meaningVi) === meaning)) {
      fallback(item);
      continue;
    }

    current.push(item);

    if (current.length === MATCH_GROUP_SIZE) {
      groups.push(current);
      current = [];
    }
  }

  if (current.length >= MIN_MATCH_GROUP) {
    groups.push(current);
  } else if (current.length > 0) {
    const last = groups[groups.length - 1];
    const fits =
      last &&
      last.length + current.length <= MAX_MATCH_GROUP &&
      current.every((item) =>
        last.every(
          (other) =>
            normalizeVietnamese(other.word.meaningVi) !== normalizeVietnamese(item.word.meaningVi)
        )
      );

    if (fits) {
      last.push(...current);
    } else {
      current.forEach(fallback);
    }
  }

  for (const group of groups) {
    for (const item of group) {
      item.matchGroup = group[0].key;
    }
  }

  // Cả nhóm dồn về chỗ của thẻ đầu nhóm.
  const ordered: PlannedItem[] = [];

  for (const item of items) {
    if (item.matchGroup === null) {
      ordered.push(item);
    } else if (item.matchGroup === item.key) {
      ordered.push(...items.filter((other) => other.matchGroup === item.key));
    }
  }

  return ordered;
}

export function buildReviewSession(input: {
  due: DueCard[];
  fresh: FreshWord[];
  pool: QuizWord[];
  seed: number;
  size: number;
}): SessionItem[] {
  const ordered = [...input.due].sort(
    (a, b) =>
      (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0) ||
      a.box - b.box ||
      a.cardId.localeCompare(b.cardId)
  );

  const dueItems = ordered.slice(0, input.size).map((card) => ({
    key: card.cardId,
    cardId: card.cardId,
    wordId: card.wordId,
    box: card.box,
    word: card.word
  }));

  const freshItems = input.fresh
    .slice(0, Math.max(0, input.size - dueItems.length))
    .map((item) => ({
      key: `new:${item.wordId}`,
      cardId: null,
      wordId: item.wordId,
      box: 0,
      word: item.word
    }));

  const planned = groupMatchItems(
    [...dueItems, ...freshItems].map((item) => ({
      ...item,
      kind: questionKindForBox(item.box, hashRoll(`${input.seed}:${item.key}`)),
      matchGroup: null
    }))
  );

  return planned.map((item, index) => ({
    key: item.key,
    cardId: item.cardId,
    wordId: item.wordId,
    isNew: item.box === 0,
    box: item.box,
    matchGroup: item.matchGroup,
    question: buildQuestion({
      word: { ...item.word, id: item.key },
      kind: item.kind,
      pool: input.pool,
      seed: input.seed,
      index
    })
  }));
}
