import { SKILL_LABELS, SKILL_PILL_CLASSES, distinctSkills } from "@/lib/skills";

// Hiển thị các pill màu theo kỹ năng chứa trong một bài. Bài trộn nhiều kỹ
// năng -> nhiều pill. Không có kỹ năng hợp lệ -> không render gì.
export function SkillTags({ skills }: { skills: string[] }) {
  const ordered = distinctSkills(skills);

  if (ordered.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {ordered.map((skill) => (
        <span
          key={skill}
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            SKILL_PILL_CLASSES[skill] ?? "bg-muted text-muted-foreground"
          }`}
        >
          {SKILL_LABELS[skill] ?? skill}
        </span>
      ))}
    </div>
  );
}
