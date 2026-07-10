// Dò "đoạn chứa đáp án" (dẫn chứng) từ bài đọc/transcript và tách phần khớp
// đáp án để gạch chân khi hiển thị. Chỉ dùng cho các câu điền từ có đáp án nằm
// nguyên văn trong nguồn; câu nhãn (MC/TF-NG/matching) trả null.

// Loại câu có đáp án là từ/cụm nguyên văn trong bài.
const LITERAL_ANSWER_TYPES = new Set(["note_completion", "table_completion", "short_answer"]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Regex khớp đáp án theo ranh giới từ, không phân biệt hoa/thường.
function answerRegExp(answer: string): RegExp {
  return new RegExp(`\\b${escapeRegExp(answer)}\\b`, "i");
}

// Trả câu trong sourceText chứa đáp án nguyên văn, hoặc null.
export function deriveAnswerEvidence(
  questionType: string,
  correctAnswers: string[],
  sourceText: string | null
): string | null {
  if (!sourceText || !LITERAL_ANSWER_TYPES.has(questionType)) {
    return null;
  }

  const sentences = sourceText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  // Ưu tiên đáp án dài nhất để khớp cụm chính xác hơn từ đơn.
  const candidates = correctAnswers
    .map((answer) => answer.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const answer of candidates) {
    const pattern = answerRegExp(answer);
    const hit = sentences.find((sentence) => pattern.test(sentence));
    if (hit) {
      return hit;
    }
  }

  return null;
}

// Tách text thành các đoạn { text, match } — phần match=true là chỗ trùng đáp án
// nguyên văn (để bọc gạch chân). Không tìm thấy -> trả nguyên text (match=false).
export function splitByAnswerMatches(
  text: string,
  answers: string[]
): Array<{ text: string; match: boolean }> {
  const candidates = answers
    .map((answer) => answer.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  if (candidates.length === 0) {
    return [{ text, match: false }];
  }

  const combined = new RegExp(`\\b(${candidates.map(escapeRegExp).join("|")})\\b`, "gi");

  const parts: Array<{ text: string; match: boolean }> = [];
  let lastIndex = 0;
  let found: RegExpExecArray | null;

  while ((found = combined.exec(text)) !== null) {
    if (found.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, found.index), match: false });
    }
    parts.push({ text: found[0], match: true });
    lastIndex = found.index + found[0].length;
    if (found[0].length === 0) {
      combined.lastIndex += 1; // tránh vòng lặp vô hạn
    }
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), match: false });
  }

  return parts.length > 0 ? parts : [{ text, match: false }];
}
