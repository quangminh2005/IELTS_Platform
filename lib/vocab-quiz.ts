import { normalizeAnswer } from "@/lib/grading";

export type QuizWord = {
  id: string;
  display: string;
  meaningVi: string;
  phonetic: string | null;
  exampleEn: string;
};

export type ProgressRow = {
  wordId: string;
  correctCount: number;
  wrongCount: number;
  lastAnswerAt: Date | null;
};

// meaning: nhìn từ → chọn nghĩa Việt · reverse: nghĩa Việt → chọn từ Anh ·
// cloze: điền từ vào chỗ trống trong câu ví dụ (gõ tay, luyện chính tả).
export type QuizKind = "meaning" | "reverse" | "cloze";

export const QUIZ_KINDS: readonly QuizKind[] = ["meaning", "reverse", "cloze"];

// Câu ví dụ đã tách làm ba khúc quanh từ cần học — dùng để in đậm khi chữa bài
// và để đục lỗ ở dạng điền từ.
export type MaskedSentence = {
  before: string;
  match: string;
  after: string;
};

export type QuizQuestion = {
  wordId: string;
  kind: QuizKind;
  display: string;
  phonetic: string | null;
  meaningVi: string;
  exampleEn: string;
  // Đề bài hiển thị: từ (meaning), nghĩa Việt (reverse) hoặc câu đục lỗ (cloze).
  prompt: string;
  // Trắc nghiệm: 4 lựa chọn + vị trí đáp án. Cloze: [] và -1.
  options: string[];
  correctIndex: number;
  example: MaskedSentence | null;
};

export const QUIZ_SIZE = 5;

// Cần 1 đáp án đúng + 3 đáp án nhiễu.
export const MIN_POOL_FOR_QUIZ = 4;

// Mỗi lượt 5 câu: 2 nghĩa, 1 ngược, 2 điền từ. Xoay theo seed nên từ nào rơi vào
// dạng nào đổi mỗi lượt.
const KIND_PATTERN: readonly QuizKind[] = ["meaning", "cloze", "reverse", "cloze", "meaning"];

export const CLOZE_BLANK = "____";

// Lấy sẵn một rổ rộng gấp 3 số câu rồi mới xoay theo seed: vừa giữ được ưu tiên
// "sai nhiều / lâu chưa ôn", vừa cho mỗi lượt làm lại bốc bộ từ khác.
const HOT_POOL_FACTOR = 3;

function rotate<T>(items: readonly T[], offset: number): T[] {
  if (items.length === 0) {
    return [];
  }

  const shift = ((offset % items.length) + items.length) % items.length;

  return [...items.slice(shift), ...items.slice(0, shift)];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function split(sentence: string, start: number, length: number): MaskedSentence {
  return {
    before: sentence.slice(0, start),
    match: sentence.slice(start, start + length),
    after: sentence.slice(start + length)
  };
}

// Tìm từ trong câu ví dụ. Thử khớp nguyên từ trước; không thấy thì khớp theo
// tiền tố để bắt dạng biến thể (strategy → strategies, analyse → analysis).
// Tiền tố giữ tối thiểu 4 ký tự để "region" không ăn nhầm "regular".
export function maskWordInSentence(display: string, sentence: string): MaskedSentence | null {
  const word = display.trim();

  if (word.length === 0) {
    return null;
  }

  const exact = new RegExp(`\\b${escapeRegExp(word)}\\b`, "i").exec(sentence);

  if (exact) {
    return split(sentence, exact.index, exact[0].length);
  }

  const prefixLength = Math.max(4, word.length - 2);

  if (word.length < prefixLength) {
    return null;
  }

  const prefix = word.slice(0, prefixLength);
  const loose = new RegExp(`\\b${escapeRegExp(prefix)}[a-z]*\\b`, "i").exec(sentence);

  return loose ? split(sentence, loose.index, loose[0].length) : null;
}

// Các câu trả lời được chấp nhận cho một dạng câu. Server chấm lại bằng đúng hàm
// này với dữ liệu lấy từ DB, client chỉ dùng để tô màu chữa bài.
export function acceptedAnswers(
  kind: QuizKind,
  word: Pick<QuizWord, "display" | "meaningVi" | "exampleEn">
): string[] {
  switch (kind) {
    case "meaning":
      return [word.meaningVi];
    case "reverse":
      return [word.display];
    case "cloze": {
      const masked = maskWordInSentence(word.display, word.exampleEn);

      return masked ? [masked.match, word.display] : [word.display];
    }
  }
}

export function checkVocabAnswer(
  kind: QuizKind,
  word: Pick<QuizWord, "display" | "meaningVi" | "exampleEn">,
  chosen: string
): boolean {
  const value = normalizeAnswer(chosen);

  if (!value) {
    return false;
  }

  return acceptedAnswers(kind, word).some((answer) => normalizeAnswer(answer) === value);
}

function priorityOf(word: QuizWord, progress: Map<string, ProgressRow>) {
  const row = progress.get(word.id);

  return {
    wrongCount: row?.wrongCount ?? 0,
    // Chưa ôn lần nào coi như ôn từ rất lâu rồi.
    lastAnswerAt: row?.lastAnswerAt?.getTime() ?? Number.NEGATIVE_INFINITY
  };
}

// Bốc 3 đáp án nhiễu từ các từ khác trong rổ, không trùng đáp án đúng và không
// trùng nhau. Rổ nhiễu vẫn thiếu (nhiều từ trùng nghĩa) thì vét nốt theo thứ tự.
function pickDistractors(input: {
  pool: QuizWord[];
  wordId: string;
  field: "meaningVi" | "display";
  correct: string;
  step: number;
}): string[] {
  const others = input.pool.filter(
    (item) => item.id !== input.wordId && item[input.field] !== input.correct
  );
  const distractors: string[] = [];

  for (let offset = 0; offset < others.length && distractors.length < 3; offset += 1) {
    const candidate = others[(input.step * (offset + 1)) % others.length][input.field];

    if (!distractors.includes(candidate)) {
      distractors.push(candidate);
    }
  }

  for (const other of others) {
    if (distractors.length >= 3) {
      break;
    }

    if (!distractors.includes(other[input.field])) {
      distractors.push(other[input.field]);
    }
  }

  return distractors;
}

function buildChoiceQuestion(input: {
  pool: QuizWord[];
  word: QuizWord;
  kind: "meaning" | "reverse";
  seed: number;
  questionIndex: number;
  example: MaskedSentence | null;
}): QuizQuestion {
  const field = input.kind === "meaning" ? "meaningVi" : "display";
  const correct = input.word[field];
  const distractors = pickDistractors({
    pool: input.pool,
    wordId: input.word.id,
    field,
    correct,
    step: input.seed + input.questionIndex + 1
  });

  const correctIndex = (input.seed + input.questionIndex) % 4;
  const options = [...distractors];
  options.splice(correctIndex, 0, correct);

  return {
    wordId: input.word.id,
    kind: input.kind,
    display: input.word.display,
    phonetic: input.word.phonetic,
    meaningVi: input.word.meaningVi,
    exampleEn: input.word.exampleEn,
    prompt: input.kind === "meaning" ? input.word.display : input.word.meaningVi,
    options,
    correctIndex,
    example: input.example
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

  // Mẫu dạng câu lặp cho đủ số câu rồi xoay theo seed.
  const pattern: QuizKind[] = [];

  while (pattern.length < selected.length) {
    pattern.push(...KIND_PATTERN);
  }

  const kinds = rotate(pattern.slice(0, selected.length), input.seed);

  return selected.map((word, questionIndex) => {
    const example = maskWordInSentence(word.display, word.exampleEn);
    const wanted = kinds[questionIndex];

    if (wanted === "cloze" && example) {
      return {
        wordId: word.id,
        kind: "cloze",
        display: word.display,
        phonetic: word.phonetic,
        meaningVi: word.meaningVi,
        exampleEn: word.exampleEn,
        prompt: `${example.before}${CLOZE_BLANK}${example.after}`,
        options: [],
        correctIndex: -1,
        example
      };
    }

    return buildChoiceQuestion({
      pool: input.pool,
      word,
      // Câu ví dụ không tìm thấy từ (không đục lỗ được) thì hỏi nghĩa thay.
      kind: wanted === "reverse" ? "reverse" : "meaning",
      seed: input.seed,
      questionIndex,
      example
    });
  });
}
