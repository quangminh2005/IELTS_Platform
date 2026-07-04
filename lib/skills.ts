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

// Khử trùng danh sách kỹ năng và sắp theo thứ tự chuẩn (Nghe→Đọc→Viết→Nói).
// Bỏ qua giá trị không nằm trong SKILL_ORDER.
export function distinctSkills(skills: string[]): string[] {
  const present = new Set(skills);
  return SKILL_ORDER.filter((skill) => present.has(skill));
}
