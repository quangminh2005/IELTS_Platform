// Nguồn dữ liệu duy nhất cho nhãn + màu hiển thị của 4 kỹ năng IELTS.
export const SKILL_ORDER = [
  "listening",
  "reading",
  "writing",
  "speaking",
] as const;

export type Skill = (typeof SKILL_ORDER)[number];

export const SKILL_LABELS: Record<string, string> = {
  listening: "Nghe",
  reading: "Đọc",
  writing: "Viết",
  speaking: "Nói",
};

// Pill: nền nhạt + chữ đậm, hoạt động tốt ở cả light/dark mode.
export const SKILL_PILL_CLASSES: Record<string, string> = {
  listening: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  reading: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  writing: "bg-orange-500/10 text-orange-600 dark:text-orange-300",
  speaking: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
};

// Vị trí của một kỹ năng trong thứ tự chuẩn; kỹ năng lạ đẩy xuống cuối.
export function skillRank(skill: string): number {
  const index = SKILL_ORDER.indexOf(skill as Skill);
  return index === -1 ? SKILL_ORDER.length : index;
}

// Khử trùng danh sách kỹ năng và sắp theo thứ tự chuẩn (Nghe→Đọc→Viết→Nói).
// Bỏ qua giá trị không nằm trong SKILL_ORDER.
export function distinctSkills(skills: string[]): string[] {
  const present = new Set(skills);
  return SKILL_ORDER.filter((skill) => present.has(skill));
}

// Badge đầy đủ (viền + nền nhạt + chữ đậm) cho thẻ bài ở Lịch giao bài. Cùng
// tông màu với SKILL_PILL_CLASSES để một kỹ năng luôn có một màu trong cả app.
export const SKILL_BADGE_CLASSES: Record<string, string> = {
  listening:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  reading:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300",
  writing:
    "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300",
  speaking:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300",
};

// Badge cho bài kiểm tra định kỳ / thi thử — màu chàm, tách khỏi 4 màu kỹ năng.
export const MOCK_TEST_BADGE_CLASSES =
  "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300";
