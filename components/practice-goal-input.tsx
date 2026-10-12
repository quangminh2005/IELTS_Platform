"use client";

import { useRef, useTransition } from "react";
import { useToast } from "@/components/toast";
import { setPracticeGoal } from "@/lib/actions/practice-goal";
import { MAX_PRACTICE_GOAL } from "@/lib/practice-goal";

// Ô số chỉ tiêu tự luyện/tuần của một học viên. Lưu khi rời ô (hoặc Enter); giá trị
// không đổi thì không gọi server.
export function PracticeGoalInput({ studentId, goal }: { studentId: string; goal: number }) {
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const saved = useRef(goal);

  function save(input: HTMLInputElement) {
    const next = Number(input.value);
    if (input.value.trim() === "" || !Number.isInteger(next) || next === saved.current) {
      input.value = String(saved.current);
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("studentId", studentId);
      formData.set("goal", String(next));
      try {
        const result = await setPracticeGoal(formData);
        if (result.ok) saved.current = next;
        else input.value = String(saved.current);
        notify(result);
      } catch {
        input.value = String(saved.current);
        notify({ ok: false, message: "Không lưu được, kiểm tra kết nối rồi thử lại." });
      }
    });
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={MAX_PRACTICE_GOAL}
      defaultValue={goal}
      disabled={pending}
      aria-label="Chỉ tiêu tự luyện mỗi tuần (số phần)"
      title="Số phần tự luyện mỗi tuần — 0 là miễn"
      onBlur={(event) => save(event.currentTarget)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      className="w-14 rounded-md border border-border bg-background px-2 py-1 text-center text-sm tabular-nums outline-none ring-primary/40 focus:border-primary focus:ring-2 disabled:opacity-60"
    />
  );
}
