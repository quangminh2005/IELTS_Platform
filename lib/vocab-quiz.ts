import { normalizeAnswer } from "@/lib/grading";

export type QuizWord = {
  id: string;
  display: string;
  meaningVi: string;
  phonetic: string | null;
  exampleEn: string;
  // Bản dịch câu ví dụ — chỉ hiện ở lúc giới thiệu từ và lúc chữa bài (lộ nghĩa).
  exampleVi?: string | null;
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
  exampleVi: string | null;
  // Đề bài hiển thị: từ (meaning), nghĩa Việt (reverse) hoặc câu đục lỗ (cloze).
  prompt: string;
  // Trắc nghiệm: 4 lựa chọn + vị trí đáp án. Cloze: [] và -1.
  options: string[];
  correctIndex: number;
  example: MaskedSentence | null;
};

// Cần 1 đáp án đúng + 3 đáp án nhiễu.
export const MIN_POOL_FOR_QUIZ = 4;

export const CLOZE_BLANK = "____";

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
    exampleVi: input.word.exampleVi ?? null,
    prompt: input.kind === "meaning" ? input.word.display : input.word.meaningVi,
    options,
    correctIndex,
    example: input.example
  };
}

// Dựng một câu hỏi cho một từ theo dạng đã chọn (lịch ôn quyết định dạng —
// lib/vocab-srs.ts). Rổ `pool` chỉ để bốc đáp án nhiễu; từ được hỏi không cần nằm
// trong rổ (từ học viên tự thêm). Câu ví dụ không tìm thấy từ thì không đục lỗ
// được → dạng điền từ rơi về dạng chọn từ.
export function buildQuestion(input: {
  word: QuizWord;
  kind: QuizKind;
  pool: QuizWord[];
  seed: number;
  index: number;
}): QuizQuestion {
  const { word } = input;
  const example = maskWordInSentence(word.display, word.exampleEn);

  if (input.kind === "cloze" && example) {
    return {
      wordId: word.id,
      kind: "cloze",
      display: word.display,
      phonetic: word.phonetic,
      meaningVi: word.meaningVi,
      exampleEn: word.exampleEn,
      exampleVi: word.exampleVi ?? null,
      prompt: `${example.before}${CLOZE_BLANK}${example.after}`,
      options: [],
      correctIndex: -1,
      example
    };
  }

  return buildChoiceQuestion({
    pool: input.pool,
    word,
    kind: input.kind === "meaning" ? "meaning" : "reverse",
    seed: input.seed,
    questionIndex: input.index,
    example
  });
}
