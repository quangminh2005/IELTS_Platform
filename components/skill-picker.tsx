"use client";

import { SKILL_TIME_LABELS } from "@/lib/skill-times";

export type SkillPickerItem = {
  skill: string;
  status: string; // not_started | in_progress | submitted
  partCount: number;
  questionCount: number;
  minutes: number | null;
};

type SkillPickerProps = {
  title: string;
  items: SkillPickerItem[];
  onOpen: (skill: string) => void;
  onViewResult: (skill: string) => void;
  onExit: () => void;
};

const STATUS_LABEL: Record<string, string> = {
  not_started: "Chưa làm",
  in_progress: "Đang làm",
  submitted: "Đã nộp"
};

export function SkillPicker({ title, items, onOpen, onViewResult, onExit }: SkillPickerProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <button
          type="button"
          onClick={onExit}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-primary hover:border-primary"
        >
          ‹ Bảng điều khiển
        </button>
        <h2 className="truncate text-base font-bold sm:text-lg">{title}</h2>
        <span className="w-24" />
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 space-y-3 overflow-y-auto p-5">
        <p className="text-sm text-muted-foreground">
          Chọn kỹ năng để bắt đầu. Mỗi kỹ năng là một phiên riêng, nộp xong sẽ khoá lại.
        </p>
        {items.map((item) => {
          const label = SKILL_TIME_LABELS[item.skill] ?? item.skill;
          const submitted = item.status === "submitted";
          return (
            <div
              key={item.skill}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-card"
            >
              <div className="min-w-0">
                <p className="text-base font-semibold">{label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.partCount} phần · {item.questionCount} câu
                  {item.minutes ? ` · ${item.minutes} phút` : " · không giới hạn"}
                </p>
                <span
                  className={[
                    "mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    submitted
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                      : item.status === "in_progress"
                        ? "bg-amber-400/15 text-amber-600 dark:text-amber-300"
                        : "bg-muted text-muted-foreground"
                  ].join(" ")}
                >
                  {STATUS_LABEL[item.status] ?? item.status}
                </span>
              </div>
              {submitted ? (
                <button
                  type="button"
                  onClick={() => onViewResult(item.skill)}
                  className="shrink-0 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold hover:border-primary"
                >
                  Xem kết quả
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpen(item.skill)}
                  className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  {item.status === "in_progress" ? "Tiếp tục" : "Bắt đầu"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
