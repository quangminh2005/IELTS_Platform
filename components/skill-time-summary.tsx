import { formatDuration } from "@/lib/format-duration";
import { orderedSkillTimes, SKILL_TIME_LABELS } from "@/lib/skill-times";

// Dòng gộp thời gian làm bài theo kỹ năng, vd: "⏱ Reading 45 phút · Listening 30 phút".
// Không hiện gì nếu bài chưa có dữ liệu thời gian theo phần (bài cũ).
export function SkillTimeSummary({
  skillTimes,
  className
}: {
  skillTimes: Record<string, number>;
  className?: string;
}) {
  const rows = orderedSkillTimes(skillTimes);
  if (rows.length === 0) {
    return null;
  }

  const text = rows
    .map((row) => `${SKILL_TIME_LABELS[row.skill] ?? row.skill} ${formatDuration(row.seconds)}`)
    .join(" · ");

  return (
    <p className={className}>
      <span aria-hidden="true">⏱ </span>
      {text}
    </p>
  );
}
