// Logic thuần cho form giao bài dạng stepper. Tách riêng khỏi component để
// test được bằng vitest và để vỏ modal chỉ còn việc dựng giao diện.

export type WizardStep = 1 | 2 | 3;

export type WizardCounts = {
  units: number;
  students: number;
};

export const WIZARD_STEPS: { id: WizardStep; label: string }[] = [
  { id: 1, label: "Chọn đề" },
  { id: 2, label: "Học viên" },
  { id: 3, label: "Cài đặt" }
];

// Lý do khoá nút "Tiếp tục" ở bước hiện tại; null = đi tiếp được.
export function stepBlocker(step: WizardStep, counts: WizardCounts): string | null {
  if (step === 1 && counts.units === 0) {
    return "Chọn ít nhất 1 phần";
  }
  if (step === 2 && counts.students === 0) {
    return "Chọn ít nhất 1 học viên";
  }
  return null;
}

// Bước xa nhất được phép nhảy tới khi bấm thẳng vào thanh bước.
export function maxReachableStep(counts: WizardCounts): WizardStep {
  if (counts.units === 0) {
    return 1;
  }
  if (counts.students === 0) {
    return 2;
  }
  return 3;
}

// Dòng tóm tắt luôn hiện ở thanh chân modal.
export function summaryLabel(counts: WizardCounts): string {
  const units = counts.units === 0 ? "Chưa chọn phần" : `${counts.units} phần`;
  const students =
    counts.students === 0 ? "chưa chọn học viên" : `${counts.students} học viên`;
  return `${units} · ${students}`;
}

// Nhãn nút cuối, ghi rõ việc sắp làm.
export function submitLabel(counts: WizardCounts): string {
  return counts.students === 0 ? "Giao bài" : `Giao bài cho ${counts.students} học viên`;
}

// Dải dấu thanh Unicode (U+0300–U+036F). Dựng bằng fromCharCode để không phải
// gõ escape \u trong mã nguồn.
const COMBINING_MARKS = new RegExp(
  `[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`,
  "g"
);

// Hạ chữ thường + bỏ dấu để gõ không dấu vẫn tìm được tên học viên có dấu.
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

export function matchesSearch(haystack: string, query: string): boolean {
  const needle = normalizeSearch(query);
  if (!needle) {
    return true;
  }
  return normalizeSearch(haystack).includes(needle);
}
