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

// Sinh các mẫu regex khớp một đáp án trong text (không phân biệt hoa/thường):
//  1. Khớp thường: nguyên văn, khoảng trắng trong đáp án nới thành \s+.
//  2. Khớp linh hoạt khoảng trắng: CHỈ cho đáp án "mã" (lẫn chữ VÀ số) — nối ký tự
//     bằng \s* để "GT82LC" ↔ "GT8 2LC". Không áp dụng đáp án thuần chữ/thuần số
//     (tránh "at" khớp "a t-shirt").
//  3. Khớp đọc đánh vần: >= 3 ký tự chữ-số, dấu ngăn cách BẮT BUỘC [-.\s] giữa mỗi
//     cặp — "Hardie" ↔ "H-A-R-D-I-E". Không khớp cách viết sai gây nhiễu ("Hardy").
function answerPatterns(answer: string): string[] {
  const alnum = answer.replace(/[^\p{L}\p{N}]/gu, "");
  const patterns: string[] = [];

  // 1. Khớp thường.
  const exact = escapeRegExp(answer).replace(/(?:\\)?\s+/g, "\\s+");
  patterns.push(`\\b${exact}\\b`);

  // 2. Khớp linh hoạt khoảng trắng (chỉ đáp án mã lẫn chữ và số).
  if (/\p{L}/u.test(alnum) && /\p{N}/u.test(alnum)) {
    patterns.push(`\\b${alnum.split("").map(escapeRegExp).join("\\s*")}\\b`);
  }

  // 3. Khớp đọc đánh vần.
  if (alnum.length >= 3) {
    patterns.push(`\\b${alnum.split("").map(escapeRegExp).join("[-.\\s]")}\\b`);
  }

  return patterns;
}

// Tách text thành các đoạn { text, match } — phần match=true là chỗ trùng đáp án
// (khớp linh hoạt khoảng trắng, không phân biệt hoa/thường). Không có đáp án nào
// khớp -> trả nguyên text (match=false).
export function splitByAnswerMatches(
  text: string,
  answers: string[]
): Array<{ text: string; match: boolean }> {
  const candidates = answers
    .map((answer) => answer.trim())
    .filter(Boolean)
    // Ưu tiên đáp án dài hơn (tính theo số ký tự không kể khoảng trắng).
    .sort((a, b) => b.replace(/\s+/g, "").length - a.replace(/\s+/g, "").length);

  const patterns = candidates.flatMap(answerPatterns).filter(Boolean);
  if (patterns.length === 0) {
    return [{ text, match: false }];
  }

  const combined = new RegExp(patterns.join("|"), "gi");

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

// Thay [[n]] trong nguồn (bài đọc/transcript) bằng đáp án đúng của câu order=n để đọc
// liền mạch; thiếu đáp án -> "____". Không có [[n]] -> trả nguyên nguồn.
export function fillSourceBlanks(
  source: string,
  answersByOrder: Record<number, string>
): string {
  return source.replace(/\[\[(\d+)\]\]/g, (_match, n) => {
    const answer = answersByOrder[Number(n)];
    return answer && answer.trim() ? answer : "____";
  });
}
