// Danh sách từ học thuật (Academic Word List) dùng làm tầng lọc chính khi rút từ
// từ đề Listening/Reading. Đang có Sublist 1-2 (120 headword) — đủ dùng nhiều
// tháng ở nhịp 1 từ/ngày. Muốn mở rộng chỉ cần thêm chuỗi vào mảng dưới đây,
// không phải sửa code cũng không phải sửa test.
export const AWL_HEADWORDS: readonly string[] = [
  // Sublist 1
  "analyse", "approach", "area", "assess", "assume", "authority", "available",
  "benefit", "concept", "consist", "constitute", "context", "contract", "create",
  "data", "define", "derive", "distribute", "economy", "environment", "establish",
  "estimate", "evident", "export", "factor", "finance", "formula", "function",
  "identify", "income", "indicate", "individual", "interpret", "involve", "issue",
  "labour", "legal", "legislate", "major", "method", "occur", "percent", "period",
  "policy", "principle", "proceed", "process", "require", "research", "respond",
  "role", "section", "sector", "significant", "similar", "source", "specific",
  "structure", "theory", "vary",
  // Sublist 2
  "achieve", "acquire", "administrate", "affect", "appropriate", "aspect",
  "assist", "category", "chapter", "commission", "community", "complex",
  "compute", "conclude", "conduct", "consequent", "construct", "consume",
  "credit", "culture", "design", "distinct", "element", "equate", "evaluate",
  "feature", "final", "focus", "impact", "injure", "institute", "invest", "item",
  "journal", "maintain", "normal", "obtain", "participate", "perceive",
  "positive", "potential", "previous", "primary", "purchase", "range", "region",
  "regulate", "relevant", "reside", "resource", "restrict", "secure", "seek",
  "select", "site", "strategy", "survey", "text", "tradition", "transfer"
];

// Gốc từ dùng để so khớp cả họ từ.
// - Bỏ "e" cuối để "create" bắt được "creating", "creation"...
// - Bỏ "t" cuối ở đuôi -ant/-ent để "significant" bắt được "significance".
// - Từ ngắn (<= 4 chữ) giữ nguyên, nếu không "role" sẽ thành "rol" và ăn nhầm
//   sang "rolling".
export function academicRoot(headword: string): string {
  const lower = headword.toLowerCase();

  if (lower.length > 4 && lower.endsWith("e")) {
    return lower.slice(0, -1);
  }

  if (lower.length > 5 && (lower.endsWith("ant") || lower.endsWith("ent"))) {
    return lower.slice(0, -1);
  }

  return lower;
}

const ROOTS = AWL_HEADWORDS.map(academicRoot);

// Đuôi dài quá 5 chữ gần như chắc chắn là từ khác, không phải biến thể.
const MAX_SUFFIX_LENGTH = 5;

export function isAcademicWord(word: string): boolean {
  const lower = word.toLowerCase();

  return ROOTS.some(
    (root) =>
      lower.startsWith(root) && lower.length - root.length <= MAX_SUFFIX_LENGTH
  );
}
