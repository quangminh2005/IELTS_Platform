"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SKILL_TIME_LABELS, SKILL_TIME_ORDER } from "@/lib/skill-times";

type SkillTimeInputsProps = {
  // unitId -> skill, để suy ra kỹ năng từ các unit đang được tick.
  unitSkills: Record<string, string>;
  // Giá trị phút mặc định theo kỹ năng (khi sửa bài đã giao).
  defaultValues?: Record<string, number>;
};

export function SkillTimeInputs({ unitSkills, defaultValues = {} }: SkillTimeInputsProps) {
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  // Neo để tìm đúng <form> bao quanh component này — trang sửa bài có thể
  // render nhiều form cùng lúc (mỗi bài giao một form), nên không thể
  // document.querySelector("form") lấy form đầu tiên trên trang.
  const anchorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const form = anchorRef.current?.closest("form");
    if (!form) return;

    const recompute = () => {
      const checked = form.querySelectorAll<HTMLInputElement>(
        'input[name="unitIds"]:checked'
      );
      const skills = new Set<string>();
      checked.forEach((input) => {
        const skill = unitSkills[input.value];
        if (skill) skills.add(skill);
      });
      const knownOrder: readonly string[] = SKILL_TIME_ORDER;
      const ordered: string[] = knownOrder
        .filter((s) => skills.has(s))
        .concat(Array.from(skills).filter((s) => !knownOrder.includes(s)));
      setSelectedSkills(ordered);
    };

    recompute();
    form.addEventListener("change", recompute);
    return () => form.removeEventListener("change", recompute);
  }, [unitSkills]);

  const label = useMemo(
    () => (skill: string) => SKILL_TIME_LABELS[skill] ?? skill,
    []
  );

  if (selectedSkills.length === 0) {
    return (
      <>
        <span ref={anchorRef} className="hidden" aria-hidden="true" />
        <p className="rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Chọn phần ở trên để đặt thời gian cho từng kỹ năng.
        </p>
      </>
    );
  }

  return (
    <div className="space-y-2">
      <span ref={anchorRef} className="hidden" aria-hidden="true" />
      {selectedSkills.map((skill) => (
        <div key={skill} className="flex items-center gap-3">
          <span className="w-24 text-sm font-medium">{label(skill)}</span>
          <input
            name={`skillTime_${skill}`}
            type="number"
            min={1}
            defaultValue={defaultValues[skill] ?? ""}
            placeholder="phút"
            className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
          />
          <span className="text-xs text-muted-foreground">phút</span>
        </div>
      ))}
    </div>
  );
}
