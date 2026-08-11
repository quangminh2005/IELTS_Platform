import { matchAcademicRoot } from "@/lib/vocab-awl";

export type VocabCandidate = {
  word: string; // dạng chuẩn hoá, chữ thường
  display: string; // dạng như trong đề
  root: string; // gốc từ học thuật — dùng để gom các từ cùng họ
  sentence: string; // câu đầu tiên chứa từ, nguyên văn
  unitId: string;
  skill: string;
};

// Câu ví dụ quá ngắn thì không dạy được gì, quá dài thì tràn thẻ trên trang chủ.
const MIN_SENTENCE_LENGTH = 30;
const MAX_SENTENCE_LENGTH = 300;

// Đề nhập vào có fence :::box/:::flow... và ô trống [[3]] — đây là cú pháp dựng
// giao diện, không phải nội dung đọc, nên bỏ trước khi tách từ.
export function cleanExamText(raw: string): string {
  return raw
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(":::"))
    .join("\n")
    .replace(/\[\[\d+\]\]/g, "");
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length > 0);
}

export function extractCandidates(input: {
  text: string;
  skill: string;
  unitId: string;
}): VocabCandidate[] {
  const sentences = splitSentences(cleanExamText(input.text));

  // Lượt 1: đếm xem mỗi từ từng xuất hiện ở dạng chữ thường hay chưa, để nhận
  // diện tên riêng (từ LUÔN viết hoa giữa câu).
  const seenLowercase = new Set<string>();
  const seenCapitalMidSentence = new Set<string>();

  for (const sentence of sentences) {
    const tokens = sentence.match(/[A-Za-z]+/g) ?? [];

    tokens.forEach((token, index) => {
      const lower = token.toLowerCase();
      const isCapitalised = token[0] === token[0].toUpperCase();

      if (!isCapitalised) {
        seenLowercase.add(lower);
        return;
      }

      if (index > 0) {
        seenCapitalMidSentence.add(lower);
      }
    });
  }

  // Lượt 2: gom ứng viên theo GỐC TỪ, mỗi gốc lấy một mục duy nhất. Gặp
  // "computer" rồi "computers" thì giữ dạng ngắn hơn — nó gần dạng nguyên thể
  // nhất, dạy học viên dễ hơn.
  const found = new Map<string, VocabCandidate>();

  for (const sentence of sentences) {
    if (
      sentence.length < MIN_SENTENCE_LENGTH ||
      sentence.length > MAX_SENTENCE_LENGTH
    ) {
      continue;
    }

    for (const token of sentence.match(/[A-Za-z]+/g) ?? []) {
      const lower = token.toLowerCase();

      if (lower.length < 4) {
        continue;
      }

      const root = matchAcademicRoot(lower);

      if (!root) {
        continue;
      }

      // Tên riêng: viết hoa giữa câu và không bao giờ xuất hiện dạng chữ thường.
      if (seenCapitalMidSentence.has(lower) && !seenLowercase.has(lower)) {
        continue;
      }

      const kept = found.get(root);

      if (kept && kept.word.length <= lower.length) {
        continue;
      }

      found.set(root, {
        word: lower,
        display: lower,
        root,
        // Luôn lấy câu chứa đúng dạng từ đang giữ — nếu mượn câu của dạng cũ thì
        // câu ví dụ sẽ không chứa từ được hiển thị.
        sentence,
        unitId: input.unitId,
        skill: input.skill
      });
    }
  }

  return [...found.values()];
}
