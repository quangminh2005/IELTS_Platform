export type QuizWord = {
  id: string;
  display: string;
  meaningVi: string;
};

export type ProgressRow = {
  wordId: string;
  correctCount: number;
  wrongCount: number;
  lastAnswerAt: Date | null;
};

export type QuizQuestion = {
  wordId: string;
  display: string;
  options: string[];
  correctIndex: number;
};

export const QUIZ_SIZE = 5;

// Cần 1 đáp án đúng + 3 đáp án nhiễu.
export const MIN_POOL_FOR_QUIZ = 4;

// Lấy sẵn một rổ rộng gấp 3 số câu rồi mới xoay theo seed: vừa giữ được ưu tiên
// "sai nhiều / lâu chưa ôn", vừa cho mỗi lượt làm lại bốc bộ từ khác.
const HOT_POOL_FACTOR = 3;

function rotate<T>(items: T[], offset: number): T[] {
  if (items.length === 0) {
    return items;
  }

  const shift = ((offset % items.length) + items.length) % items.length;

  return [...items.slice(shift), ...items.slice(0, shift)];
}

function priorityOf(word: QuizWord, progress: Map<string, ProgressRow>) {
  const row = progress.get(word.id);

  return {
    wrongCount: row?.wrongCount ?? 0,
    // Chưa ôn lần nào coi như ôn từ rất lâu rồi.
    lastAnswerAt: row?.lastAnswerAt?.getTime() ?? Number.NEGATIVE_INFINITY
  };
}

export function buildQuiz(input: {
  pool: QuizWord[];
  progress: ProgressRow[];
  count: number;
  seed: number;
}): QuizQuestion[] {
  if (input.pool.length < MIN_POOL_FOR_QUIZ || input.count <= 0) {
    return [];
  }

  const progress = new Map(input.progress.map((row) => [row.wordId, row]));

  const ranked = [...input.pool].sort((left, right) => {
    const a = priorityOf(left, progress);
    const b = priorityOf(right, progress);

    if (a.wrongCount !== b.wrongCount) {
      return b.wrongCount - a.wrongCount;
    }

    if (a.lastAnswerAt !== b.lastAnswerAt) {
      return a.lastAnswerAt - b.lastAnswerAt;
    }

    return left.id.localeCompare(right.id);
  });

  const hotPool = ranked.slice(0, Math.max(input.count, input.count * HOT_POOL_FACTOR));
  const selected = rotate(hotPool, input.seed).slice(0, input.count);

  return selected.map((word, questionIndex) => {
    const others = input.pool.filter(
      (item) => item.id !== word.id && item.meaningVi !== word.meaningVi
    );

    const distractors: string[] = [];
    const step = input.seed + questionIndex + 1;

    for (let offset = 0; offset < others.length && distractors.length < 3; offset += 1) {
      const candidate = others[(step * (offset + 1)) % others.length];

      if (!distractors.includes(candidate.meaningVi)) {
        distractors.push(candidate.meaningVi);
      }
    }

    // Rổ nhiễu vẫn thiếu (nhiều từ trùng nghĩa) thì vét nốt theo thứ tự.
    for (const other of others) {
      if (distractors.length >= 3) {
        break;
      }

      if (!distractors.includes(other.meaningVi)) {
        distractors.push(other.meaningVi);
      }
    }

    const correctIndex = (input.seed + questionIndex) % 4;
    const options = [...distractors];
    options.splice(correctIndex, 0, word.meaningVi);

    return {
      wordId: word.id,
      display: word.display,
      options,
      correctIndex
    };
  });
}
