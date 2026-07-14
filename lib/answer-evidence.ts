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

// Trả câu trong sourceText chứa nguyên văn một trong các answers (ranh giới từ, không
// phân biệt hoa/thường); ưu tiên answer dài nhất. Không thấy -> null.
export function findEvidenceSentence(
  sourceText: string | null,
  answers: string[]
): string | null {
  if (!sourceText) {
    return null;
  }

  const sentences = sourceText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  // Ưu tiên đáp án dài nhất để khớp cụm chính xác hơn từ đơn.
  const candidates = answers
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

// Trả câu trong sourceText chứa đáp án nguyên văn, hoặc null. Chỉ dùng cho câu điền từ
// (đáp án nằm nguyên văn trong bài); câu nhãn (MC/TF-NG/matching) trả null.
export function deriveAnswerEvidence(
  questionType: string,
  correctAnswers: string[],
  sourceText: string | null
): string | null {
  if (!LITERAL_ANSWER_TYPES.has(questionType)) {
    return null;
  }
  return findEvidenceSentence(sourceText, correctAnswers);
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

export type EvidenceTarget = {
  order: number; // số thứ tự câu
  evidence: string; // evidenceSnapshot (câu văn, có thể còn [[n]])
  answers: string[]; // các biến thể đáp án đúng
};

export type EvidenceSegment = {
  text: string;
  sentenceOrders: number[]; // order có "câu dẫn chứng" phủ đoạn này
  answerOrders: number[]; // order có "đúng từ đáp án" là đoạn này
};

// Cắt filledSource thành các đoạn, mỗi đoạn biết thuộc câu dẫn chứng nào và có phải
// đúng từ đáp án của câu nào. Định vị câu dẫn chứng bằng cách điền [[n]] cho evidence
// rồi tìm chuỗi con trong filledSource (con trỏ chạy tăng theo order để phân biệt câu
// trùng). Không định vị được -> bỏ câu đó (không liên kết).
export function buildEvidenceSegments(
  filledSource: string,
  targets: EvidenceTarget[],
  answersByOrder: Record<number, string>
): { segments: EvidenceSegment[]; linkedOrders: number[] } {
  type Interval = { start: number; end: number; order: number; kind: "sentence" | "answer" };
  const intervals: Interval[] = [];
  const linkedOrders: number[] = [];

  const sorted = [...targets].sort((a, b) => a.order - b.order);
  let cursor = 0;

  for (const target of sorted) {
    const filledEvidence = fillSourceBlanks(target.evidence, answersByOrder).trim();
    if (!filledEvidence) continue;

    let start = filledSource.indexOf(filledEvidence, cursor);
    if (start === -1) start = filledSource.indexOf(filledEvidence);
    if (start === -1) continue; // không định vị được -> bỏ

    const end = start + filledEvidence.length;
    cursor = end;
    linkedOrders.push(target.order);
    intervals.push({ start, end, order: target.order, kind: "sentence" });

    // Tìm đúng từ/cụm đáp án trong khoảng câu (ưu tiên đáp án dài, khớp linh hoạt).
    const patterns = target.answers
      .map((a) => a.trim())
      .filter(Boolean)
      .sort((a, b) => b.replace(/\s+/g, "").length - a.replace(/\s+/g, "").length)
      .flatMap(answerPatterns)
      .filter(Boolean);
    if (patterns.length > 0) {
      const re = new RegExp(patterns.join("|"), "gi");
      const sentence = filledSource.slice(start, end);
      const m = re.exec(sentence);
      if (m && m[0].length > 0) {
        intervals.push({
          start: start + m.index,
          end: start + m.index + m[0].length,
          order: target.order,
          kind: "answer"
        });
      }
    }
  }

  if (intervals.length === 0) {
    return {
      segments: [{ text: filledSource, sentenceOrders: [], answerOrders: [] }],
      linkedOrders
    };
  }

  // Tô khoảng: gộp mọi điểm ranh giới, cắt chuỗi thành đoạn liền kề.
  const points = new Set<number>([0, filledSource.length]);
  for (const iv of intervals) {
    points.add(iv.start);
    points.add(iv.end);
  }
  const bounds = [...points].sort((a, b) => a - b);

  const segments: EvidenceSegment[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const segStart = bounds[i];
    const segEnd = bounds[i + 1];
    if (segStart >= segEnd) continue;
    const sentenceOrders: number[] = [];
    const answerOrders: number[] = [];
    for (const iv of intervals) {
      if (iv.start <= segStart && segEnd <= iv.end) {
        if (iv.kind === "sentence" && !sentenceOrders.includes(iv.order)) {
          sentenceOrders.push(iv.order);
        }
        if (iv.kind === "answer" && !answerOrders.includes(iv.order)) {
          answerOrders.push(iv.order);
        }
      }
    }
    segments.push({ text: filledSource.slice(segStart, segEnd), sentenceOrders, answerOrders });
  }

  return { segments, linkedOrders };
}

// Nhãn đáp án đúng/sai — không phải từ khóa dò được trong bài ("yes"/"no" còn xuất hiện
// nhan nhản trong hội thoại nên dò sẽ tô bừa).
const LABEL_ANSWER_TOKENS = new Set(["true", "false", "not given", "yes", "no", "ng"]);

// Tách correctAnswerSnapshot ("a | b") thành từng đáp án, bỏ nhãn phương án đầu
// ("A. " / "b) ") để lấy từ khóa dùng tô đậm và dò trong nguồn.
export function answerKeywords(correctAnswerSnapshot: string | null): string[] {
  if (!correctAnswerSnapshot) {
    return [];
  }
  return correctAnswerSnapshot
    .split(" | ")
    .map((answer) => answer.replace(/^[A-Za-z][.)]\s+/, "").trim())
    .filter(Boolean);
}

// Từ khóa đủ "chắc" để đi dò trong nguồn: bỏ nhãn đúng/sai và token quá ngắn (chữ cái lẻ
// của câu matching) — tránh tô bừa.
function isSearchableKeyword(keyword: string): boolean {
  if (LABEL_ANSWER_TOKENS.has(keyword.toLowerCase())) {
    return false;
  }
  return keyword.replace(/[^\p{L}\p{N}]/gu, "").length >= 2;
}

export type EvidenceTargetInput = {
  order: number | null;
  evidenceSnapshot: string | null;
  correctAnswerSnapshot: string | null;
};

// Dựng danh sách đích dẫn chứng cho một part:
//  - Đã có evidenceSnapshot (câu điền từ tự sinh khi chấm, hoặc giáo viên nhập) -> dùng
//    câu đó; từ khóa đáp án chỉ để tô đậm bên trong.
//  - Chưa có (câu trắc nghiệm...) -> với MỖI từ khóa dò được câu chứa nó, tạo một đích
//    cùng order; nhờ vậy câu "chọn nhiều đáp án" tô được nhiều chỗ. Không dò ra -> bỏ.
export function buildEvidenceTargets(
  items: EvidenceTargetInput[],
  filledSource: string
): EvidenceTarget[] {
  const targets: EvidenceTarget[] = [];

  for (const item of items) {
    if (item.order === null) {
      continue;
    }
    const keywords = answerKeywords(item.correctAnswerSnapshot);
    const evidence = item.evidenceSnapshot?.trim();

    if (evidence) {
      targets.push({ order: item.order, evidence, answers: keywords });
      continue;
    }

    for (const keyword of keywords.filter(isSearchableKeyword)) {
      const sentence = findEvidenceSentence(filledSource, [keyword]);
      if (sentence) {
        targets.push({ order: item.order, evidence: sentence, answers: [keyword] });
      }
    }
  }

  return targets;
}
