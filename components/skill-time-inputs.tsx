"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SKILL_TIME_LABELS, SKILL_TIME_ORDER } from "@/lib/skill-times";

type SkillTimeInputsProps = {
  // unitId -> skill, để suy ra kỹ năng từ các unit đang được tick.
  unitSkills: Record<string, string>;
  // Giá trị phút mặc định theo kỹ năng (khi sửa bài đã giao).
  defaultValues?: Record<string, number>;
  // Tổng thời gian cả bài đã lưu (khi sửa bài) — có giá trị thì mở sẵn chế độ tổng.
  defaultTotalMinutes?: number | null;
};

const HELP_BY_MODE = {
  skill: "Mỗi kỹ năng là một phiên riêng, có đồng hồ riêng. Bỏ trống = không giới hạn.",
  total:
    "Một đồng hồ chung cho Listening/Reading/Writing: thời gian các kỹ năng cộng dồn. Hết giờ thì nộp cả bài (phần chưa làm tính trống). Speaking không tính giờ. Bỏ trống = không giới hạn."
} as const;

export function SkillTimeInputs({
  unitSkills,
  defaultValues = {},
  defaultTotalMinutes = null
}: SkillTimeInputsProps) {
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [mode, setMode] = useState<"skill" | "total">(defaultTotalMinutes ? "total" : "skill");
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

  // Bài 1 kỹ năng: tổng = giờ của kỹ năng đó, không cần nút gạt.
  const canUseTotal = selectedSkills.length >= 2;
  const activeMode = canUseTotal ? mode : "skill";

  return (
    <div className="space-y-2">
      <span ref={anchorRef} className="hidden" aria-hidden="true" />
      {canUseTotal ? (
        <div
          role="radiogroup"
          aria-label="Cách đặt thời gian"
          className="inline-flex rounded-lg border border-border bg-background p-0.5"
        >
          {(
            [
              ["skill", "Theo từng kỹ năng"],
              ["total", "Tổng cả bài"]
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={activeMode === value}
              onClick={() => setMode(value)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                activeMode === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {text}
            </button>
          ))}
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">{HELP_BY_MODE[activeMode]}</p>
      <input type="hidden" name="timeMode" value={activeMode} />
      {activeMode === "total" ? (
        <div className="flex items-center gap-3">
          <span className="w-24 text-sm font-medium">Cả bài</span>
          <input
            name="totalTimeMinutes"
            type="number"
            min={1}
            defaultValue={defaultTotalMinutes ?? ""}
            placeholder="phút"
            className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
          />
          <span className="text-xs text-muted-foreground">phút</span>
        </div>
      ) : (
        selectedSkills.map((skill) => (
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
        ))
      )}
    </div>
  );
}
