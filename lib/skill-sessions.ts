import { SKILL_TIME_ORDER } from "@/lib/skill-times";

type HasSkill = { assignableUnit: { skill: string } };

// Danh sách kỹ năng phân biệt của một bài, theo thứ tự IELTS (kỹ năng lạ xếp cuối).
export function orderedSkillsOfAssignment(units: HasSkill[]): string[] {
  const set = new Set(units.map((u) => u.assignableUnit.skill));
  const known = SKILL_TIME_ORDER.filter((s) => set.has(s));
  const extra = Array.from(set).filter(
    (s) => !SKILL_TIME_ORDER.includes(s as (typeof SKILL_TIME_ORDER)[number])
  );
  return [...known, ...extra];
}

export function unitsForSkill<T extends HasSkill>(units: T[], skill: string): T[] {
  return units.filter((u) => u.assignableUnit.skill === skill);
}

// Đã nộp hết khi có ít nhất 1 kỹ năng và tất cả đều "submitted".
export function allSkillsSubmitted(skills: Array<{ status: string }>): boolean {
  return skills.length > 0 && skills.every((s) => s.status === "submitted");
}

// Trạng thái hiện ở màn chọn kỹ năng. Dữ liệu AttemptSkill từ server chỉ mới tới
// lúc tải trang (startSkillSession không render lại trang), nên kỹ năng học viên
// vừa mở trong phiên trang này phải tự hiện "Đang làm" thay vì "Chưa làm".
export function pickerSkillStatus(serverStatus: string | undefined, openedThisPage: boolean): string {
  const status = serverStatus ?? "not_started";
  return status === "not_started" && openedThisPage ? "in_progress" : status;
}
